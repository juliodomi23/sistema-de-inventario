from dotenv import load_dotenv
load_dotenv()
import os
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=3000,
    socketTimeoutMS=10000,
    maxPoolSize=20,
    minPoolSize=2,
)
db = client[os.environ['DB_NAME']]
