from .db import db


class PlaylistTrack(db.Model):
    __tablename__ = "playlist_tracks"
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    track_id = db.Column(db.Integer, db.ForeignKey("tracks.id"), nullable=False)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=False)    
