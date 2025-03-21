__all__ = [
    "auth"
]

import datetime

import flask

from .. import middleware, models
from .utils import jsonify


auth = flask.Blueprint("auth", __name__, url_prefix="/auth")

@auth.route("/login", methods=["POST"])
@jsonify
def login():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    email = flask.request.json.get("email")
    password = flask.request.json.get("password")

    if email is None or password is None:
        return {"error": "Invalid request"}

    result = middleware.auth.login(email, password)
    if result:
        return {"result": "Login successful"}
    return {"error": "Login failed", "status_code": 401}

@auth.route("/status", methods=["GET"])
@jsonify
@middleware.auth.supports_login
def status():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    return {
        "result": "logged_in" if middleware.auth.user != None else "logged_out"
    }

@auth.route("/logout", methods=["POST"])
@jsonify
def logout():
    middleware.auth.logout()
    return {"result": "Logout successful"}

@auth.route("/password", methods=["PUT"])
@jsonify
@middleware.auth.requires_login
def change_password():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    old_password = flask.request.json.get("old_password")
    new_password = flask.request.json.get("new_password")

    if old_password is None or new_password is None:
        return {"error": "Invalid request"}

    return middleware.auth.change_password(old_password, new_password)

@auth.route("/verify/<verification_code>", methods=["POST"])
@jsonify
def verify_email(verification_code):
    user = models.User.query.filter(
        models.User.verified == False,
        models.User.verification_code == verification_code,
        models.User.verification_code_expiration >= datetime.datetime.now(datetime.timezone.utc),
    ).first()

    if user is None:
        return {"error": "Invalid code"}

    user.verified = True
    user.verification_code = None
    user.verification_code_expiration = None

    models.db.session.commit()
    return {"result": "Email verified successfully"}
