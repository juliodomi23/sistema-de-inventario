from dotenv import load_dotenv
load_dotenv()
import os
import secrets

JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development") == "production"
