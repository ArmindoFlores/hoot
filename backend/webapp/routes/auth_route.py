__all__ = [
    "auth"
]

import datetime
import logging
import traceback

import flask
import patreon
from sqlalchemy.orm.session import object_session

import config
from .. import middleware, models
from .utils import jsonify


auth = flask.Blueprint("auth", __name__, url_prefix="/auth")

def get_or_update_patreon_oauth_token(user: models.User, code = None):
    oauth_client = patreon.OAuth(config.PATREON_CLIENT_ID, config.PATREON_CLIENT_SECRET)

    now = datetime.datetime.now(datetime.timezone.utc)
    if user.patreon_access_token and user.patreon_refresh_token and user.patreon_access_token_expiration:
        if user.patreon_access_token_expiration.replace(tzinfo=datetime.timezone.utc) <= now:
            tokens = oauth_client.refresh_token(user.patreon_refresh_token, config.OAUTH_REDIRECT)
        else:
            tokens = {
                "access_token": user.patreon_access_token,
            }
    else:
        tokens = oauth_client.get_tokens(code, config.OAUTH_REDIRECT)

    if "expires_in" in tokens:
        user.patreon_access_token = tokens["access_token"]
        user.patreon_refresh_token = tokens["refresh_token"]
        user.patreon_access_token_expiration = now + datetime.timedelta(seconds=tokens["expires_in"])

    return tokens

def update_patreon_status(user: models.User, code = None):
    try:
        tokens = get_or_update_patreon_oauth_token(user, code)
    except Exception as e:
        return {"error": str(e)}
    
    access_token = tokens["access_token"]
    api_client = patreon.API(access_token)
    user_response = api_client.get_identity(
        ["campaign", "memberships"], 
        {
            "member": [
                "currently_entitled_amount_cents",
                "last_charge_date",
                "last_charge_status",
                "patron_status",
            ]
        }
    )
    if isinstance(user_response, dict) and "errors" in user_response:
        logging.error(f"Patreon error: {user_response['errors']}")
        return {"error": "Failed to check Patreon membership"}
    
    user_data = user_response.data()
    memberships = user_data.relationship("memberships")
    membership = memberships[0] if memberships and len(memberships) > 0 else None
    patreon_id = str(user_data.id())

    user_linked_to_patreon = models.User.query.filter_by(patreon_id=patreon_id).first()
    if user_linked_to_patreon is not None and user_linked_to_patreon.id != user.id:
        return {"error": "Another user is already linked to that Patreon account"}

    now = datetime.datetime.now(datetime.timezone.utc)
    user.patreon_member_last_checked = now
    user.patreon_id = patreon_id
    if membership.attribute("patron_status") is not None and membership.attribute("currently_entitled_amount_cents") > 0:
        last_charge_date, last_charge_status = membership.attribute("last_charge_date"), membership.attribute("last_charge_status")
        if last_charge_status == "Paid":
            user.patreon_last_payment = last_charge_date
        else:
            user.patreon_last_payment = now
        user.patreon_member = True
        return
    
    user.patreon_member = False

@auth.route("/login", methods=["POST"])
@jsonify
def login():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    email = flask.request.json.get("email")
    password = flask.request.json.get("password")

    if email is None or password is None:
        return {"error": "Invalid request"}

    user = middleware.auth.login(email, password)
    if user is None:
        return {"error": "Invalid username or password", "status_code": 401}
        
    if user.patreon_id is not None:
        now = datetime.datetime.now(datetime.timezone.utc)
        last_checked = None if user.patreon_member_last_checked is None else user.patreon_member_last_checked.replace(tzinfo=datetime.timezone.utc)
        if last_checked is None or (now - last_checked).total_seconds() > 60 * 60 * 24:
            error = update_patreon_status(user)
            models.db.session.commit()
            if error is not None:
                return error

    return {
        "username": user.username,
        "email": user.email,
        "total_storage": user.total_storage(),
        "used_storage": user.used_storage(),
        "patreon_member": user.patreon_member,
        "patreon_link": user.patreon_id is not None,
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
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
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

@auth.route("/oauth/redirect")
@middleware.auth.requires_login
def oauth_redirect():
    user = models.User.query.filter_by(id=middleware.auth.user.id).first()
    if user is None:
        return {"error": "Invalid request"}

    code = flask.request.args.get("code")
    state = flask.request.args.get("state")

    if code is None or state is None:
        return {"error": "Invalid request"}

    error = update_patreon_status(user, code)
    models.db.session.commit()
    if error is not None:
        return error
    
    return {"is_patron": user.patreon_member}
