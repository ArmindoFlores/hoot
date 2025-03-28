__all__ = [
    "webhooks"
]

import datetime
import hmac
import hashlib

import flask

import config
from .. import models
from .utils import jsonify


webhooks = flask.Blueprint("webhooks", __name__, url_prefix="/webhooks")

@webhooks.route("patreon", methods=["POST"])
@jsonify
def patreon_webhook():
    if not flask.request.is_json:
        return {"error": "Invalid request"}
    
    event = flask.request.headers.get("X-Patreon-Event")
    signature = flask.request.headers.get("X-Patreon-Signature")
    raw_body = flask.request.get_data()
    secret = config.PATREON_WEBHOOKS_SECRET.encode("utf-8")
    computed_signature = hmac.new(secret, raw_body, hashlib.md5).hexdigest()
    if not hmac.compare_digest(signature, computed_signature):
        return {"Error": "Invalid request"}

    included_data = flask.request.json["included"]
    patreon_id = None
    for section in included_data:
        if section["type"] == "user":
            patreon_id = str(section["id"])
    
    if patreon_id is None:
        return {"error": "Invalid patron"}

    patreon_user = models.User.query.filter_by(patreon_id=patreon_id).first()
    if patreon_user is None:
        return {"error": "Invalid patron"}
    
    if event == "members:delete" or event == "members:pledge:delete":
        # TODO: Send some sort of email
        pass
    
    attrs = flask.request.json["data"]["attributes"]
    last_charge_date = attrs["last_charge_date"]
    last_charge_status = attrs["last_charge_status"]
    patron_status = attrs["patron_status"]
    currently_entitled_amount_cents = attrs["currently_entitled_amount_cents"]

    if patron_status == "active_patron" and currently_entitled_amount_cents > 0:
        patreon_user.patreon_member = True
    if last_charge_date is not None and last_charge_status == "Paid":
        patreon_user.patreon_last_payment = last_charge_date
    patreon_user.patreon_member_last_checked = datetime.datetime.now(datetime.timezone.utc)
    
    models.db.session.commit()

    return {"success": "Member updated"}
