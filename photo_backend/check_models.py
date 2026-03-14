from openai import OpenAI
from dotenv import load_dotenv
import os

# Load your .env file
load_dotenv()

# Connect to DigitalOcean
client = OpenAI(
    base_url="https://inference.do-ai.run/v1/",
    api_key=os.getenv("DO_MODEL_ACCESS_KEY"),
)

print("🔍 Fetching available models for your API Key...\n")
try:
    models = client.models.list()
    for m in models.data:
        print(f"✅ Exact Model ID: {m.id}")
except Exception as e:
    print(f"Error: {e}")