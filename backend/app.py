import config
import flask
import webapp

from urllib.parse import quote_plus

from flask_cors import CORS
from flask_migrate import Migrate
from flask_session import Session

app = flask.Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"{config.DB_ENGINE}+{config.DB_DRIVER}://{config.DB_USERNAME}:{quote_plus(config.DB_PASSWORD)}@{config.DB_SERVER}/{config.DB_NAME}"
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = 2592000
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024

CORS(
    app,
    supports_credentials=True,
    resources={
        r"/*": {
            "origins": [
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://owlbear.rodeo"
            ]
        }
    }
)

app.register_blueprint(webapp.routes.auth)
app.register_blueprint(webapp.routes.user)
app.register_blueprint(webapp.routes.tracks)

Session(app)

webapp.models.db.init_app(app)
migrate = Migrate(app, webapp.models.db)
