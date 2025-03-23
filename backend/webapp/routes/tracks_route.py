__all__ = [
    "user"
]

import datetime
import json
import traceback
import uuid

import boto3
import flask
import magic
from botocore.exceptions import ClientError
from sqlalchemy.orm import joinedload

import config
from .. import middleware, models
from .utils import jsonify


tracks = flask.Blueprint("tracks", __name__, url_prefix="/tracks")

def generate_presigned_url(key: str, type: str, expiration=3600):
    try:
        response = config.S3_CLIENT.generate_presigned_url(
            "get_object" if key == "download" else "put_object",
            Params={"Bucket": config.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expiration
        )
    except ClientError:
        traceback.print_exc()
        return None

    return response

def source_if_valid(track: models.Track, generate_new = False):
    now = datetime.datetime.now(datetime.timezone.utc)
    source = track.source
    if track.source_expiration > now:
        return source
    if generate_new:
        expiration_date = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=3600)
        pre_signed_url = generate_presigned_url(track.object_key, "download")
        if pre_signed_url is None:
            return None
        
        track.source = pre_signed_url
        track.source_expiration = expiration_date
        return pre_signed_url

    return None

@tracks.route("", methods=["GET"])
@jsonify
@middleware.auth.requires_login
def get_tracks():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    
    playlists: list[models.Playlist] = models.Playlist.query.options(
        joinedload(models.Playlist.tracks)
    ).filter_by(
        owner_id=user.id
    ).all()

    return {
        playlist.name: [
            {
                "id": track.id,
                "name": track.name,
                "source": source_if_valid(track),
                "size": track.size,
            } for track in playlist.tracks
        ] for playlist in playlists
    }

@tracks.route("/<track_id>", methods=["GET"])
@jsonify
@middleware.auth.requires_login
def get_track(track_id):
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    track = models.Track.query.filter_by(
        track_id=track_id,
        owner_id=middleware.auth.user.id
    ).first()

    if track is None:
        return {"error": "Invalid track"}
    
    track_source = source_if_valid(track, True)
    models.db.session.commit()
    
    return {
        "id": track.id,
        "name": track.name,
        "source": track_source,
        "size": track.size,
    }

@tracks.route("/new", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def create_track():
    uploaded_file = flask.request.files.get("file")

    if uploaded_file is None:
        return {"error": "No file provided"}

    metadata = json.loads(flask.request.form["metadata"])
    track_name = metadata.get("track_name")
    playlists = metadata.get("playlists", [])

    if track_name is None:
        return {"error": "Invalid request"}

    file_sample = uploaded_file.stream.read(2048)
    uploaded_file.stream.seek(0)

    mime = magic.from_buffer(file_sample, mime=True)

    if not mime.startswith("audio/"):
        return {"error": "Invalid file type (only audio allowed)"}
    
    uploaded_file.seek(0, 2)
    file_size = uploaded_file.tell()
    uploaded_file.seek(0)

    if file_size > middleware.auth.user.available_space():
        return {"error": "File size exceeds your quota"}
    
    extension = uploaded_file.filename.rsplit(".", 1)[-1].lower()
    object_key = f"user_{middleware.auth.user.id}/track_{uuid.uuid4()}.{extension}"

    try:
        config.S3_CLIENT.upload_fileobj(
            uploaded_file,
            config.S3_BUCKET_NAME,
            object_key,
            ExtraArgs={
                "ContentType": uploaded_file.mimetype,
                "ACL": "private"
            }
        )
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Upload failed: {str(e)}", "status_code": 500}

    try:
        new_track = models.Track(
            owner_id=middleware.auth.user.id,
            name=track_name,
            size=file_size,
            object_key=object_key
        )
        models.db.session.add(new_track)
        models.db.session.commit()
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Track creation failed: {str(e)}", "status_code": 500}

    return {
        "id": new_track.id,
        "name": new_track.name,
        "source": None,
        "size": new_track.size,
    }

@tracks.route("/<track_id>", methods=["DELETE"])
@jsonify
@middleware.auth.requires_login
def delete_track(track_id):
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    track = models.Track.query.filter_by(
        track_id=track_id,
        owner_id=middleware.auth.user.id
    ).first()

    if track is None:
        return {"error": "Invalid track"}

    try:
        config.S3_CLIENT.delete_object(Bucket=config.S3_BUCKET_NAME, Key=track.object_key)
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Couldn't delete trac ({str(e)})", "status_code": 500}
    
    return {"result": "Success"}
