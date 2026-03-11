from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Using SQLite for local development. We will swap this to PostgreSQL later.
SQLALCHEMY_DATABASE_URL = "sqlite:///./photo_curator.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get the DB session for our API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()