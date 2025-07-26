from .db import db


class PlaylistTrack(db.Model):
    __tablename__ = "playlist_tracks"
    __table_args__ = (
        db.UniqueConstraint("track_id", "playlist_id", name="unique_track_playlist"),
    )
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    track_id = db.Column(db.Integer, db.ForeignKey("tracks.id"), nullable=False)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=False)    
