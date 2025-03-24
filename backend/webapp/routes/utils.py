__all__ = [
    "jsonify",
]

import re
import sys
import traceback
from functools import wraps

import email_validator
import flask

sys.path.append(".")
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
