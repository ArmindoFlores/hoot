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
from .. import middleware, models
from ..services import EmailClient
from .utils import jsonify, valid_email, valid_username


user = flask.Blueprint("user", __name__, url_prefix="/user")

@user.route("", methods=["GET"])
@jsonify
@middleware.auth.supports_login
def status():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    if middleware.auth.user != None:
        return {
            "username": middleware.auth.user.username,
            "email": middleware.auth.user.email,
            "total_storage": middleware.auth.user.total_storage(),
            "used_storage": middleware.auth.user.used_storage(),
        }
    return {"error": "Logged out"}

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
    
    issues = middleware.auth.verify_password(password)
    if issues is not None:
        return issues

    if not valid_username(username):
        return {"error": "Invalid username"}

    if not valid_email(email):
        return {"error": "Invalid email"}

    matched_user = models.User.query.filter(
        models.User.email == email
    ).first()

    if matched_user is not None and matched_user.verified:
        return {"error": "A user already exists with that email"}

    verification_code = secrets.token_urlsafe(32)
    hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    verification_code_expiration = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)

    if matched_user is None:
        new_user = models.User(
            email=email,
            username=username,
            password=hashed_pw,
            verification_code=verification_code,
            verification_code_expiration=verification_code_expiration
        )
        models.db.session.add(new_user)
    else:
        matched_user.username = username
        matched_user.password = hashed_pw
        verification_code = verification_code
        verification_code_expiration = verification_code_expiration
        
    verification_url = f"https://{config.WEBSITE}/verify/{verification_code}"

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
        models.db.session.commit()
    except Exception:
        traceback.print_exc()
        return {"error": "Unknown error occurred"}

    return {"result": "Successfully created new user"}
