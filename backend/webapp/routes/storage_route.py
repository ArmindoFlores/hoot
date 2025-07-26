__all__ = [
    "storage"
]

import typing

import flask
from sqlalchemy import func, select, update, distinct
from sqlalchemy.orm import aliased

from .. import middleware, models
from ..routes import tracks_route
from .utils import is_valid_directory_name, jsonify


storage = flask.Blueprint("storage", __name__, url_prefix="/storage")

def descendant_chain_cte(descendant_id: int):
    cte = select(
        models.Directory.id, 
        models.Directory.parent_id
    ).where(
        models.Directory.id == descendant_id
    ).cte(name="ancestors", recursive=True)

    recursive = select(
        models.Directory.id, 
        models.Directory.parent_id
    ).where(
        models.Directory.id == cte.c.parent_id
    )
    
    cte = cte.union_all(recursive)
    return cte

def is_descendant_of_any_query(possible_parent_ids: typing.List[int], descendant_id: int) -> bool:
    cte = descendant_chain_cte(descendant_id)
    return models.db.session.query(
        cte.c.id
    ).filter(
        cte.c.id.in_(possible_parent_ids)
    ).first() is not None

@storage.route("/<directory_id_str>/contents", methods=["GET"])
@jsonify
@middleware.auth.requires_login
def get_directory_contents(directory_id_str):
    if directory_id_str == "null":
        directory_id = None
    else:
        try:
            directory_id = int(directory_id_str)
        except ValueError:
            return {"error": "Invalid directory ID"}

    tracks: typing.List[models.Track] = models.Track.query.filter_by(
        directory_id=directory_id,
        owner_id=middleware.auth.user.id
    ).all()

    subdirectories: typing.List[models.Directory] = models.Directory.query.filter_by(
        parent_id=directory_id,
        owner_id=middleware.auth.user.id
    )

    merged = []
    for subdir in subdirectories:
        merged.append({
            "id": subdir.id,
            "name": subdir.name,
            "type": "DIRECTORY"
        })
    
    for track in tracks:
        merged.append({
            "id": track.id,
            "name": track.name,
            **(dict(zip(("source", "source_expiration"), tracks_route.source_if_valid(track)))),
            "size": track.size,
            "type": "TRACK"
        })
    
    return merged

@storage.route("/<directory_id_str>", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def create_directory(directory_id_str):
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    if directory_id_str == "null":
        directory_id = None
    else:
        try:
            directory_id = int(directory_id_str)
        except ValueError:
            return {"error": "Invalid directory ID"}
    
    name = flask.request.json.get("name", None)
    if name is None:
        return {"error": "Missing directory name"}
    if not is_valid_directory_name(name):
        return {"error": "Invalid directory name"}

    if directory_id is not None:
        parent_dir = models.Directory.query.filter_by(
            id=directory_id,
            owner_id=middleware.auth.user.id,
        ).first()
        if parent_dir is None:
            return {"error": "Invalid parent directory"}
    
    new_dir = models.Directory(
        name=name,
        parent_id=directory_id,
        owner_id=middleware.auth.user.id
    )

    try:
        models.db.session.add(new_dir)
        models.db.session.commit()
        return {"result": "Success"}
    except Exception as e:
        return {"error": f"Couldn't create new directory ({str(e)})"}
    
@storage.route("/<directory_id_str>", methods=["GET"])
@jsonify
@middleware.auth.requires_login
def get_directory_info(directory_id_str):
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    try:
        directory_id = int(directory_id_str)
    except ValueError:
        return {"error": "Invalid directory ID"}

    directory = models.Directory.query.filter_by(
        id=directory_id,
        owner_id=middleware.auth.user.id,
    ).first()
    if directory is None:
        return {"error": "Invalid directory"}
    
    return {
        "type": "DIRECTORY",
        "name": directory.name,
        "id": directory.id
    }
    
@storage.route("", methods=["DELETE"])
@jsonify
@middleware.auth.requires_login
def delete_directories():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    try:
        directory_ids = list(map(int, flask.request.json.get("ids", [])))
    except ValueError:
        return {"error": "Invalid directory IDs"}

    child_dir = aliased(models.Directory)
    results = models.db.session.query(
        models.Directory,
        func.count(distinct(child_dir.id)).label("subdirectory_count"),
        func.count(distinct(models.Track.id)).label("track_count")
    ).outerjoin(
        child_dir, child_dir.parent_id == models.Directory.id
    ).outerjoin(
        models.Track, models.Track.directory_id == models.Directory.id
    ).filter(
        models.Directory.id.in_(directory_ids)
    ).group_by(models.Directory.id).all()

    try:
        error_count = 0
        error_str = None
        for directory, subdir_count, track_count in results:
            if subdir_count > 0 or track_count > 0:
                error_count += 1
                continue
            models.db.session.delete(directory)
        models.db.session.commit()
        if error_count == 0:
            return {"result": "Success"}
        else:
            return {"error": f"Failed to delete {error_count} out of {len(directory_ids)} directories because they were not empty"}
    except Exception as e:
        return {"error": f"Couldn't delete directories ({str(e)})"}

@storage.route("/<directory_id_str>/rename", methods=["PATCH"])
@jsonify
@middleware.auth.requires_login
def rename_directory(directory_id_str):
    if not flask.request.is_json:
        return {"error": "Invalid request"}

    try:
        directory_id = int(directory_id_str)
    except ValueError:
        return {"error": "Invalid directory ID"}
        
    name = flask.request.json.get("name", None)
    if name is None:
        return {"error": "Missing directory name"}
    if not is_valid_directory_name(name):
        return {"error": "Invalid directory name"}

    directory = models.Directory.query.filter_by(
        id=directory_id,
        owner_id=middleware.auth.user.id,
    ).first()
    if directory is None:
        return {"error": "Invalid directory"}
    
    directory.name = name
    try:
        models.db.session.commit()
        return {"result": "Success"}
    except Exception as e:
        return {"error": f"Couldn't rename directory ({str(e)})"}
    
@storage.route("/move", methods=["POST"])
@jsonify
@middleware.auth.requires_login
def move_items():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
     
    parent = flask.request.json.get("parent", None)
    items = flask.request.json.get("items", None)

    if items is None:
        return {"error": "No items to move"}
    
    directories = [item for item in items if item.get("type") == "DIRECTORY"]
    tracks = [item for item in items if item.get("type") == "TRACK"]

    # 1st step: verify parent is not any of its new children
    for directory in directories:
        if directory.get("id") == parent:
            return {"error": "Cannot move a directory into itself"}

    # 2nd step: verify parent is not a subdirectory of any of its new children 
    if parent is not None and is_descendant_of_any_query([directory.get("id") for directory in directories], parent):
        return {"error": "Cannot move a directory into one of its subdirectories"}

    # 3rd step: verify parent exists
    if parent is not None and models.Directory.query.filter_by(id=parent, owner_id=middleware.auth.user.id).count() == 0:
        return {"error": "Tried moving into a non-existing directory"}
    
    # 4th step: do the move
    try:
        if len(directories) > 0:
            models.db.session.execute(
                update(models.Directory)
                .where(
                    models.Directory.id.in_([directory.get("id") for directory in directories]),
                    models.Directory.owner_id == middleware.auth.user.id
                )
                .values(
                    parent_id=parent
                )
            )

        if len(tracks) > 0:
            models.db.session.execute(
                update(models.Track)
                .where(
                    models.Track.id.in_([track.get("id") for track in tracks]),
                    models.Track.owner_id == middleware.auth.user.id
                )
                .values(
                    directory_id=parent
                )
            )
        
        models.db.session.commit()
        return {"result": "Success"}
    except Exception as e:
        return {"error": f"Couldn't move directory ({str(e)})"}
