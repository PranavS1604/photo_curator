from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

# --- NEW: User Table ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    picture = Column(String, nullable=True)

    albums = relationship("Album", back_populates="owner")

class Album(Base):
    __tablename__ = "albums"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- NEW: Link to User ---
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="albums")
    
    title = Column(String, index=True)
    status = Column(String, default="pending") 
    target_face_paths = Column(String, nullable=True) 
    
    photos = relationship("Photo", back_populates="album")

class Photo(Base):
    __tablename__ = "photos"
    id = Column(Integer, primary_key=True, index=True)
    album_id = Column(Integer, ForeignKey("albums.id"))
    filename = Column(String)
    file_path = Column(String) 
    
    status = Column(String, default="pending")
    is_blurry = Column(Boolean, nullable=True)
    sharpness_score = Column(Float, nullable=True)
    is_duplicate = Column(Boolean, nullable=True)
    has_target_face = Column(Boolean, nullable=True)
    matched_target_path = Column(String, nullable=True) 
    
    album = relationship("Album", back_populates="photos")