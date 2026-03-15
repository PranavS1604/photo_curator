import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# We pull the secure DigitalOcean database string from your .env
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# PostgreSQL doesn't need the check_same_thread hack that SQLite needs!
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get the DB session for our API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()