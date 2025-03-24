import datetime
from functools import wraps

import bcrypt
from flask import g, session
from werkzeug.local import LocalProxy

from .. import models


class LazyLoadProxy:
    def __init__(self, loader, *args, **kwargs):
        self.loader = loader
        self.args = args
        self.kwargs = kwargs
        self._value = None

    def __repr__(self):
        if self._value is None:
            return f"<LazyLoadProxy (unloaded)>"
        return f"<LazyLoadProxy {self._value}>"
    
    def _load(self):
        if self._value is None:
            self._value = self.loader(*self.args, **self.kwargs)

    def __getattr__(self, item):
        self._load()
        return getattr(self._value, item)
    

def verify_password(password: str):
    if len(password) < 8 or len(password) > 64:
        return {"error": "Password must be between 8 and 64 characters"}
    return None

def requires_login(route_func):
    """Decorator that checks if the user is logged in. If not, it returns a 401 error."""

    @wraps(route_func)
    def f(*func_args, **func_kwargs):
        if not session.get("_authenticated", False):
            return {"error": "Login required", "status_code": 401}
        
        g._current_user = LazyLoadProxy(lambda user_id: models.User.query.get(user_id), session["_user_id"])
        return route_func(*func_args, **func_kwargs)
    
    return f

def supports_login(route_func):
    """Decorator that checks if the user is logged in, and if so sets the g._current_user object."""

    @wraps(route_func)
    def f(*func_args, **func_kwargs):
        if not session.get("_authenticated", False):
            g._current_user = None
        else:
            g._current_user = LazyLoadProxy(lambda user_id: models.User.query.get(user_id), session["_user_id"])
        return route_func(*func_args, **func_kwargs)
    
    return f

def login(email: str, password: str) -> models.User | None:
    """Performs authentication and, if successful, sets the user as logged in.
    Returns the user object authentication was successfull and `None` otherwise."""

    if len(email) == 0 or len(password) == 0:
        return None
    
    user = models.User.query.filter(
        models.User.email == email,
        models.User.verified == True
    ).first()
    
    if user is None or user.password is None:
        return None
    
    if not bcrypt.checkpw(password.encode(), user.password.encode()):
        return None

    session.permanent = True
    session["_authenticated"] = True
    session["_created_at"] = datetime.datetime.now()
    session["_user_id"] = user.id
    return user

def logout() -> None:
    """Sets the user as logged out"""
    session["_authenticated"] = False

def change_password(old_password: str, new_password: str, force: bool = False, user_id = None):
    """Changes the user's password. Returns a dictionary with the key "error" if the operation fails."""
    if not force and (len(old_password) == 0 or len(new_password) == 0):
        return {"error": "Invalid request"}

    user = models.User.query.get(session["_user_id"] if user_id is None else user_id)

    if not force:
        if not bcrypt.checkpw(old_password.encode(), user.password.encode()):
            return {"error": "Incorrect password", "status_code": 401}
        
    issues = verify_password(new_password)
    if issues is not None:
        return issues
        
    user.password = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    models.db.session.commit()

    return {"result": "Password changed successfully"}

user = LocalProxy(
    lambda: g._current_user if hasattr(g, "_current_user") else None
)
