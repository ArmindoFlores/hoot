__all__ = [
    "auth",
    "playlists",
    "storage",
    "tracks",
    "user",
    "webhooks",
]

from .auth_route import auth
from .playlists_route import playlists
from .storage_route import storage
from .tracks_route import tracks
from .user_route import user
from .webhooks_route import webhooks
