from .db import db


class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    username = db.Column(db.String(64), nullable=False)
    email = db.Column(db.String(128), nullable=False)
    password = db.Column(db.String(128), nullable=False)
    verified = db.Column(db.Boolean, nullable=False, server_default='0')
    verification_code = db.Column(db.String(128), nullable=True)
    verification_code_expiration = db.Column(db.DateTime, nullable=True)

    playlists = db.relationship("Playlist", back_populates="owner")    
    tracks = db.relationship("Track", back_populates="owner")    
