__all__ = [
    "jsonify",
]

import datetime
import re
import sys
import traceback
import typing
from functools import wraps

from botocore.exceptions import ClientError
import email_validator
import flask

sys.path.append(".")
from .. import models
import config

USERNAME_REGEX = r"^(?! )[A-Za-z0-9 _-]{1,63}(?<! )$"


def jsonify(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
        except Exception as e:
            flask.current_app.logger.exception(f"Unhandled exception in route function '{func.__name__}'")
            if config.ENVIRONMENT == "prod":
                return {"error": "An unknown error occurred"}, 500
            else:
                traceback_details = traceback.extract_tb(sys.exc_info()[2])
                filename, line, *_ = traceback_details[-1]
                return {"error": str(e), "traceback": traceback.format_exc(), "file": filename, "line": line}, 500
        status_code = 200
        if "error" in result:
            if "status_code" in result:
                status_code = result["status_code"]
                del result["status_code"]
            else:
                status_code = 400
        response = flask.jsonify(result)
        return response, status_code
            
    wrapper.__doc__ = func.__doc__
    wrapper.__name__ = func.__name__
    wrapper.__annotations__ = func.__annotations__
    return wrapper

def generate_presigned_url(key: str, type: str, expiration=3600):
    try:
        response = config.S3_CLIENT.generate_presigned_url(
            "get_object" if type == "download" else "put_object",
            Params={"Bucket": config.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expiration
        )
    except ClientError:
        traceback.print_exc()
        return None

    return response

def source_if_valid(track: models.Track, generate_new = False):
    now = datetime.datetime.now(datetime.timezone.utc)
    tz_aware_expiration = track.source_expiration
    if tz_aware_expiration is not None:
        tz_aware_expiration = tz_aware_expiration.replace(tzinfo=datetime.timezone.utc)
    if tz_aware_expiration is not None and tz_aware_expiration > now:
        return track.source, tz_aware_expiration.timestamp()
    if generate_new:
        expiration_date = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=3600)
        pre_signed_url = generate_presigned_url(track.object_key, "download")
        if pre_signed_url is None:
            return None, None
        track.source = pre_signed_url
        track.source_expiration = expiration_date
        return pre_signed_url, expiration_date.timestamp()

    return None, None

def valid_username(username: str):
    return re.fullmatch(USERNAME_REGEX, username) is not None

def valid_email(email: str):
    if len(email) > 128:
        return False
    try:
        email_validator.validate_email(email, check_deliverability=True)
        return True
    except email_validator.EmailNotValidError:
        return False
    
def is_valid_directory_name(name: str):
    # FIXME: implement
    return len(name) < 64

def is_valid_playlist_name(name: str):
    # FIXME: implement
    return len(name) < 64

NAME_REGEX = re.compile(r"^(?!\.{1,2}$)[^/\x00]+$")
def is_valid_track_name(name: str):
    return len(name) < 64 and bool(NAME_REGEX.match(name))

T = typing.TypeVar("T")
def find(iterable: typing.Iterable[T], predicate: typing.Callable[[T], bool]) -> typing.Optional[T]:
    for element in iterable:
        if predicate(element):
            return element
    return None
