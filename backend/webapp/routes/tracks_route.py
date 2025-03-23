__all__ = [
    "user"
]

import datetime
import io
import json
import os
import re
import traceback
import uuid
from urllib.parse import urlparse, unquote

import flask
import magic
import requests
from botocore.exceptions import ClientError
from sqlalchemy.orm import joinedload

import config
from .. import middleware, models
from .utils import jsonify


tracks = flask.Blueprint("tracks", __name__, url_prefix="/tracks")

class FakeFlaskFile:
    def __init__(self, stream, filename):
        self.filename = filename
        self.stream = stream

def generate_presigned_url(key: str, type: str, expiration=3600):
    try:
        response = config.S3_CLIENT.generate_presigned_url(
            "get_object" if type == "download" else "put_object",
            Params={"Bucket": config.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expiration
        )
    except ClientError:
        traceback.print_exc()
        return None

    return response

def source_if_valid(track: models.Track, generate_new = False):
    now = datetime.datetime.now(datetime.timezone.utc)
    tz_aware_expiration = track.source_expiration
    if tz_aware_expiration is not None:
        tz_aware_expiration = tz_aware_expiration.replace(tzinfo=datetime.timezone.utc)
    if tz_aware_expiration is not None and tz_aware_expiration > now:
        return track.source, tz_aware_expiration.timestamp()
    if generate_new:
        expiration_date = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=3600)
        pre_signed_url = generate_presigned_url(track.object_key, "download")
        if pre_signed_url is None:
            return None, None
        track.source = pre_signed_url
        track.source_expiration = expiration_date
        return pre_signed_url, expiration_date.timestamp()

    return None, None

def download_file(source: str):
    response = requests.get(source, stream=True, timeout=60)
    response.raise_for_status()

    # Try to get filename from URL
    path = urlparse(source).path
    filename = unquote(os.path.basename(path)) or None
    
    # Try to get filename from Content-Disposition header
    if filename is None:
        content_disposition = response.headers.get("Content-Disposition")
        if content_disposition:
            match = re.search(r'filename="?([^\";]+)"?', content_disposition)
            if match:
                filename = match.group(1)

    if filename is None:
        raise NameError("Filename not specified")

    total_bytes = 0
    buffer = io.BytesIO()
    chunk_size = 8192
    for chunk in response.iter_content(chunk_size=chunk_size):
        if chunk:
            total_bytes += len(chunk)
            if total_bytes > 1024 * 1024 * 1024:
                raise ValueError("File too large")
            buffer.write(chunk)

    buffer.seek(0)
    return FakeFlaskFile(stream=buffer, filename=filename)

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
                **(dict(zip(("source", "source_expiration"), source_if_valid(track)))),
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
    track: models.Track = models.Track.query.filter_by(
        id=int(track_id),
        owner_id=middleware.auth.user.id
    ).first()

    if track is None:
        return {"error": "Invalid track"}
    
    track_source, source_expiration = source_if_valid(track, True)
    models.db.session.commit()
    
    return {
        "id": track.id,
        "name": track.name,
        "source": track_source,
        "source_expiration": source_expiration,
        "size": track.size,
        "playlists": [playlist.name for playlist in track.playlists]
    }

@tracks.route("/new", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def create_track():
    metadata = json.loads(flask.request.form.get("metadata", "{}"))
    track_name = metadata.get("track_name")
    playlists = metadata.get("playlists", [])
    file_source = metadata.get("source")
    uploaded_file = flask.request.files.get("file")

    if uploaded_file is None and file_source is None:
        return {"error": "No file provided"}

    if uploaded_file is None:
        try:
            uploaded_file = download_file(file_source)
        except Exception as e:
            return {"error": f"Error downloading file ({str(e)})"}

    if track_name is None:
        return {"error": "Invalid request"}

    uploaded_file.stream.seek(0)

    file_sample = uploaded_file.stream.read(2048)
    mime = magic.from_buffer(file_sample, mime=True)

    if not mime.startswith("audio/"):
        return {"error": "Invalid file type (only audio allowed)"}
    
    uploaded_file.stream.seek(0, 2)
    file_size = uploaded_file.stream.tell()
    uploaded_file.stream.seek(0)

    if file_size > middleware.auth.user.available_storage():
        return {"error": "File size exceeds your quota"}
    
    extension = uploaded_file.filename.rsplit(".", 1)[-1].lower()
    object_key = f"user_{middleware.auth.user.id}/track_{uuid.uuid4()}.{extension}"

    try:
        config.S3_CLIENT.upload_fileobj(
            uploaded_file.stream,
            config.S3_BUCKET_NAME,
            object_key,
            ExtraArgs={
                "ContentType": mime,
                "ACL": "private"
            }
        )
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Upload failed: {str(e)}", "status_code": 500}

    try:
        set_playlists = set(playlists)
        existing_playlists = models.Playlist.query.filter_by(
            owner_id=middleware.auth.user.id
        ).all()
        existing_playlist_names = set(playlist.name for playlist in existing_playlists)

        new_playlists = set_playlists.difference(existing_playlist_names)
        new_playlist_objects = [
            models.Playlist(
                name=playlist_name,
                owner_id=middleware.auth.user.id
            )
            for playlist_name in new_playlists
        ]
        models.db.session.add_all(new_playlist_objects)

        total_playlists = [playlist for playlist in existing_playlists if playlist.name in set_playlists] + [playlist for playlist in new_playlist_objects]
        new_track = models.Track(
            owner_id=middleware.auth.user.id,
            name=track_name,
            size=file_size,
            object_key=object_key,
            playlists=total_playlists
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
        "playlists": [playlist.name for playlist in total_playlists]
    }

@tracks.route("/<track_id>", methods=["DELETE"])
@jsonify
@middleware.auth.requires_login
def delete_track(track_id):
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    track = models.Track.query.filter_by(
        id=int(track_id),
        owner_id=middleware.auth.user.id
    ).first()

    if track is None:
        return {"error": "Invalid track"}

    try:
        config.S3_CLIENT.delete_object(Bucket=config.S3_BUCKET_NAME, Key=track.object_key)
        models.db.session.delete(track)
        models.db.session.commit()
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Couldn't delete track ({str(e)})", "status_code": 500}
    
    return {"result": "Success"}
