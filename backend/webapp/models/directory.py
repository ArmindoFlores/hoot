from .db import db


class Directory(db.Model):
    __tablename__ = "directories"
    __table_args__ = (
        db.UniqueConstraint("parent_id", "name", name="unique_directory_name_per_parent"),
    )
    
    id = db.Column(db.Integer, primary_key=True, nullable=False, autoincrement=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("directories.id"), nullable=True, index=True)
    name = db.Column(db.String(255), nullable=False)

    # Self-referencing relationship
    children = db.relationship(
        "Directory", 
        backref=db.backref("parent", remote_side=[id]),
        lazy="dynamic",
        order_by=name
    )
    
    owner = db.relationship("User", back_populates="directories")
    tracks = db.relationship("Track", back_populates="directories")
