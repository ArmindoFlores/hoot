from .db import db


class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    username = db.Column(db.String(64), nullable=False)
    email = db.Column(db.String(128), nullable=False)
    password = db.Column(db.String(128), nullable=False)

    # User verification
    verified = db.Column(db.Boolean, nullable=False, server_default='0')
    verification_code = db.Column(db.String(128), nullable=True)
    verification_code_expiration = db.Column(db.DateTime, nullable=True)

    # Subscription
    patreon_member = db.Column(db.Boolean, nullable=False, server_default='0')
    patreon_id = db.Column(db.String(128), nullable=True)
    patreon_member_last_checked = db.Column(db.DateTime, nullable=True)
    patreon_last_payment = db.Column(db.DateTime, nullable=True)
    patreon_access_token = db.Column(db.String(128), nullable=True)
    patreon_refresh_token = db.Column(db.String(128), nullable=True)
    patreon_access_token_expiration = db.Column(db.DateTime, nullable=True)

    playlists = db.relationship("Playlist", back_populates="owner")    
    tracks = db.relationship("Track", back_populates="owner")  

    def __repr__(self):
        return f"<User id={self.id} username={self.username} email={self.email} member={self.patreon_member} patreon_id={self.patreon_id}>"

    def total_storage(self):
        if self.patreon_member:
            return 10 * 1024 * 1024 * 1024
        return 2 * 1024 * 1024 * 1024

    def used_storage(self):
        return sum([track.size for track in self.tracks])

    def available_storage(self):
        return self.total_storage() - self.used_storage()
