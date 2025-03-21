import config
import flask
import webapp

from urllib.parse import quote_plus

from flask_migrate import Migrate
from flask_session import Session

app = flask.Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = f"{config.DB_ENGINE}+{config.DB_DRIVER}://{config.DB_USERNAME}:{quote_plus(config.DB_PASSWORD)}@{config.DB_SERVER}/{config.DB_NAME}"
app.config["SESSION_TYPE"] = "filesystem"
app.config["PERMANENT_SESSION_LIFETIME"] = 2592000

app.register_blueprint(webapp.routes.auth)
app.register_blueprint(webapp.routes.user)

Session(app)

webapp.models.db.init_app(app)
migrate = Migrate(app, webapp.models.db)
