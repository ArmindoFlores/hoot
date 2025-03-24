import os

import boto3
import dotenv

dotenv.load_dotenv()


S3_BUCKET_NAME = os.getenv("HOOT_S3_BUCKET_NAME")
AWS_ACCESS_KEY_ID = os.getenv("HOOT_AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("HOOT_AWS_SECRET_ACCESS_KEY")
S3_BUCKET_NAME = os.getenv("HOOT_S3_BUCKET_NAME")
DATABASE_URL = os.getenv("DATABASE_URL")
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

S3_CLIENT = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name="eu-west-3"
)
