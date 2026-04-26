from dotenv import load_dotenv
load_dotenv()
import os
import secrets

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development") == "production"
