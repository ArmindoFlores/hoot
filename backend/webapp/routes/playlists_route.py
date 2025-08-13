__all__ = [
    "playlists"
]

import typing

import flask
from sqlalchemy import delete, select, and_, or_
from sqlalchemy.orm import joinedload
from sqlalchemy.dialects.postgresql import insert

from .. import middleware, models
from .utils import jsonify, is_valid_playlist_name, source_if_valid


playlists = flask.Blueprint("playlists", __name__, url_prefix="/playlists")


@playlists.route("", methods=["GET"])
@jsonify
@middleware.auth.requires_login
def get_playlists():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    
    playlists: typing.List[models.Playlist] = models.Playlist.query.options(
        joinedload(models.Playlist.tracks)
    ).filter_by(
        owner_id=user.id
    ).all()

    return [playlist.name for playlist in playlists]

@playlists.route("", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def create_playlist():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    name = flask.request.json.get("name", None)

    if name is None or not is_valid_playlist_name(name):
        return {"error": "Invalid playlist name"}
    
    if models.Playlist.query.filter_by(owner_id=user.id, name=name).exists():
        return {"error": "A playlist already exists with that name"}

    try:
        models.db.session.add(models.Playlist(
            owner_id=user.id,
            name=name
        ))
        models.db.session.commit()
    except Exception as e:
        return {"error": f"Could not create playlist ({str(e)})"}
    return {"result": "Success"}

@playlists.route("", methods=["DELETE"])
@jsonify
@middleware.auth.requires_login
def delete_playlist():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    name = flask.request.json.get("name", None)

    if name is None:
        return {"error": "Invalid playlist name"}
    
    playlist = models.Playlist.query.filter_by(owner_id=user.id, name=name).first()

    if playlist is None:
        return {"error": "Playlist doesn't exist"}

    try:
        models.db.session.delete(playlist)
        models.db.session.commit()
    except Exception as e:
        return {"error": f"Could not delete playlist ({str(e)})"}
    return {"result": "Success"}

@playlists.route("tracks", methods=["GET"])
@jsonify
@middleware.auth.requires_login
def get_playlist_tracks():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    name = flask.request.json.get("name", None)

    if name is None:
        return {"error": "Invalid playlist name"}
    
    playlist: models.Playlist = models.Playlist.query.options(
        joinedload(models.Track)
    ).filter_by(
        models.Playlist.owner_id == user.id,
        models.Playlist.name == name
    ).first()

    return [
        {
            "id": track.id,
            "name": track.name,
            **(dict(zip(("source", "source_expiration"), source_if_valid(track)))),
            "size": track.size,
            "type": "TRACK"
        } for track in playlist.tracks
    ]

@playlists.route("add_tracks", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def add_tracks():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    names = flask.request.json.get("names", None)
    track_ids = flask.request.json.get("tracks", None)

    if names is None or track_ids is None:
        return {"error": "Invalid request"}

    playlists_to_add = models.Playlist.query.filter(
        models.Playlist.name.in_(names),
        models.Playlist.owner_id == user.id
    ).all()

    if len(playlists_to_add) != len(names):
        return {"error": "Invalid playlists"}

    tracks_to_edit = models.Track.query.filter(
        models.Track.id.in_(track_ids),
        models.Track.owner_id == user.id
    ).all()

    if len(tracks_to_edit) != len(track_ids):
        return {"error": "Invalid tracks"}

    records = []
    for track_id in track_ids:
        for playlist in playlists_to_add:
            records.append(models.PlaylistTrack(
                track_id=track_id,
                playlist_id=playlist.id
            ))

    stmt = insert(models.PlaylistTrack).values([
        {"track_id": pt.track_id, "playlist_id": pt.playlist_id}
        for pt in records
    ])

    try:
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["track_id", "playlist_id"]
        )
        models.db.session.execute(stmt)
        models.db.session.commit()
        return {"result": "Success"}
    except Exception as e:
        return {"error": f"Failed to add tracks to playlist ({str(e)})"}

@playlists.route("remove_tracks", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def remove_tracks():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    names = flask.request.json.get("names", None)
    track_ids = flask.request.json.get("tracks", None)

    if names is None or track_ids is None:
        return {"error": "Invalid request"}

    playlists_to_remove = models.Playlist.query.filter(
        models.Playlist.name.in_(names),
        models.Playlist.owner_id == user.id
    ).all()

    if len(playlists_to_remove) != len(names):
        return {"error": "Invalid playlists"}

    tracks_to_edit = models.Track.query.filter(
        models.Track.id.in_(track_ids),
        models.Track.owner_id == user.id
    ).all()

    if len(tracks_to_edit) != len(track_ids):
        return {"error": "Invalid tracks"}

    records = []
    for track_id in track_ids:
        for playlist in playlists_to_remove:
            records.append(models.PlaylistTrack(
                track_id=track_id,
                playlist_id=playlist.id
            ))

    stmt = delete(models.PlaylistTrack).where(
        or_(*[
            and_(
                models.PlaylistTrack.track_id == pt.track_id, 
                models.PlaylistTrack.playlist_id == pt.playlist_id
            ) for pt in records
        ])
    )

    try:
        models.db.session.execute(stmt)
        models.db.session.commit()
        return {"result": "Success"}
    except Exception as e:
        return {"error": f"Failed to remove tracks from playlist ({str(e)})"}

@playlists.route("edit_tracks", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def edit_tracks():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    user: models.User = middleware.auth.user
    names = flask.request.json.get("names", None)
    track_ids = flask.request.json.get("tracks", None)

    if names is None or track_ids is None:
        return {"error": "Invalid request"}

    playlists_to_set = models.Playlist.query.filter(
        models.Playlist.name.in_(names),
        models.Playlist.owner_id == user.id
    ).all()

    if len(playlists_to_set) != len(names):
        return {"error": "Invalid playlists"}

    tracks_to_edit = models.Track.query.filter(
        models.Track.id.in_(track_ids),
        models.Track.owner_id == user.id
    ).all()

    if len(tracks_to_edit) != len(track_ids):
        return {"error": "Invalid tracks"}

    records = []
    for track_id in track_ids:
        for playlist in playlists_to_set:
            records.append(models.PlaylistTrack(
                track_id=track_id,
                playlist_id=playlist.id
            ))

    add_stmt = insert(models.PlaylistTrack).values([
        {"track_id": pt.track_id, "playlist_id": pt.playlist_id}
        for pt in records
    ])
    rem_stmt = delete(models.PlaylistTrack).where(models.PlaylistTrack.track_id.in_(track_ids))

    try:
        models.db.session.execute(rem_stmt)
        models.db.session.execute(add_stmt)
        models.db.session.commit()
        return {"result": "Success"}
    except Exception as e:
        return {"error": f"Failed to set track playlists ({str(e)})"}
