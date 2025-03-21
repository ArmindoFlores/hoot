__all__ = [
    "user"
]

import datetime
import os
import traceback

import bcrypt
import flask
import secrets
from sqlalchemy import or_


import config
from .. import models
from ..services import EmailClient
from .utils import jsonify, valid_email, valid_username


user = flask.Blueprint("user", __name__, url_prefix="/user")

@user.route("", methods=["PUT"])
@jsonify
def create_user():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    username = flask.request.json.get("username", "")
    email = flask.request.json.get("email", "")
    password = flask.request.json.get("password")
    confirm_password = flask.request.json.get("confirm_password")

    if password is None or confirm_password is None:
        return {"error": "Invalid request"}

    if password != confirm_password:
        return {"error": "Passwords do not match"}

    if not valid_username(username):
        return {"error": "Invalid username"}

    if not valid_email(email):
        return {"error": "Invalid email"}

    match = models.User.query.filter(
        or_(
            models.User.email == email,
            models.User.username == username
        )
    ).first()

    if match is not None:
        if match.email == email:
            return {"error": "A user already exists with that email"}
        else:
            return {"error": "A user already exists with that username"}

    verification_code = secrets.token_urlsafe(32)

    new_user = models.User(
        email=email,
        username=username,
        password=bcrypt.hashpw(password.encode(), bcrypt.gensalt()),
        verification_code=verification_code,
        verification_code_expiration=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
    )

    verification_url = f"https://{config.WEBSITE}/auth/verify/{verification_code}"

    try:
        with open(os.path.join(os.path.dirname(__file__), "..", "services", "resources", "new_user_email_template.html"), "r") as f:
            email_html = f.read().replace("{verification_url}", verification_url)
            
        ec = EmailClient(
            config.EMAIL_USER,
            config.EMAIL_PASSWORD,
            config.EMAIL_SERVER,
            config.EMAIL_PORT,
            config.EMAIL_NAME,
        )
        ec.send_email(
            "Hoot - Verify your email",
            f"To verify your account, please follow visit this website: {verification_url}",
            email_html,
            email,
            image_folder_path=os.path.join(os.path.dirname(__file__), "..", "services", "resources", "email_images")
        )
    except Exception:
        traceback.print_exc()
        return {"error": "Invalid email"}

    try:
        models.db.session.add(new_user)
        models.db.session.commit()
    except Exception:
        traceback.print_exc()
        return {"error": "Unknown error occurred"}

    return {"result": "Successfully created new user"}
