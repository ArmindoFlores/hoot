from .db import db


class Playlist(db.Model):
    __tablename__ = "playlists"
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(64), nullable=False)

    owner = db.relationship("User", back_populates="playlists")
    tracks = db.relationship("Track", secondary="playlist_tracks", back_populates="playlists")
