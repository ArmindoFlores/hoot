from .db import db


class Track(db.Model):
    __tablename__ = "tracks"
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(64), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    object_key = db.Column(db.String(128), nullable=False)

    # Temporary pre-signed URL
    source = db.Column(db.String(512), nullable=True)
    source_expiration = db.Column(db.DateTime, nullable=True)

    owner = db.relationship("User", back_populates="tracks")
    playlists = db.relationship("Playlist", secondary="playlist_tracks", back_populates="tracks")
