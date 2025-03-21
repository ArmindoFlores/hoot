import os

import dotenv

dotenv.load_dotenv()


DB_USERNAME = os.getenv("HOOT_DB_USERNAME")
DB_PASSWORD = os.getenv("HOOT_DB_PASSWORD")
DB_SERVER = os.getenv("HOOT_DB_SERVER")
DB_NAME = os.getenv("HOOT_DB_NAME")
DB_ENGINE = os.getenv("HOOT_DB_ENGINE")
DB_DRIVER = os.getenv("HOOT_DB_DRIVER")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
EMAIL_SERVER = os.getenv("EMAIL_SERVER")
EMAIL_PORT = int(os.getenv("EMAIL_PORT"))
EMAIL_NAME = os.getenv("EMAIL_NAME")
ENVIRONMENT = os.getenv("ENVIRONMENT", "prod")
WEBSITE = os.getenv("WEBSITE")
