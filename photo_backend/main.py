from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import shutil
import jwt
import zipfile
import io
import PIL.Image
from fastapi.responses import StreamingResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
import base64
import google.generativeai as genai
from openai import OpenAI
import models
import database
from worker import process_album_task

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET")
DO_MODEL_ACCESS_KEY = os.getenv("DO_MODEL_ACCESS_KEY")
ALGORITHM = "HS256"

if not GOOGLE_CLIENT_ID or not JWT_SECRET:
    raise ValueError("Missing essential environment variables.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/google")
models.Base.metadata.create_all(bind=database.engine)
app = FastAPI(title="Smart Photo Curator API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- AUTHENTICATION LOGIC ---
class TokenRequest(BaseModel):
    token: str

@app.post("/auth/google")
def auth_google(request: TokenRequest, db: Session = Depends(database.get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
        request.token,
        google_requests.Request(),
        GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=10
    )
        email = idinfo['email']
        name = idinfo.get('name', 'User')
        picture = idinfo.get('picture', '')

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email, name=name, picture=picture)
            db.add(user)
            db.commit()
            db.refresh(user)

        encoded_jwt = jwt.encode({"sub": user.email, "id": user.id}, JWT_SECRET, algorithm=ALGORITHM)
        return {"access_token": encoded_jwt, "user": {"name": user.name, "picture": user.picture, "email": user.email}}
    except ValueError as e:
        print(f"🚨 Google Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google Token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        if user_id is None: raise HTTPException(status_code=401)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401)

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None: raise HTTPException(status_code=401)
    return user


# --- PROTECTED APP ROUTES ---
@app.post("/albums/")
def create_album(
    title: str = Form(...),
    target_faces: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_album = models.Album(title=title, status="pending", user_id=current_user.id)
    db.add(new_album)
    db.commit()
    db.refresh(new_album)

    saved_target_paths = []
    if target_faces and len(target_faces) > 0 and target_faces[0].filename != "":
        album_dir = os.path.join(UPLOAD_DIR, str(new_album.id))
        os.makedirs(album_dir, exist_ok=True)
        for idx, face_file in enumerate(target_faces):
            if face_file.filename:
                file_path = os.path.join(album_dir, f"target_{idx}_" + face_file.filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(face_file.file, buffer)
                saved_target_paths.append(file_path)

        if saved_target_paths:
            new_album.target_face_paths = ",".join(saved_target_paths)
            db.commit()

    return {"message": "Album created successfully", "album_id": new_album.id, "title": new_album.title}

@app.post("/albums/{album_id}/upload-photos/")
def upload_photos(
    album_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album: raise HTTPException(status_code=404, detail="Album not found")

    album_dir = os.path.join(UPLOAD_DIR, str(album_id))
    os.makedirs(album_dir, exist_ok=True)

    for file in files:
        file_path = os.path.join(album_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        new_photo = models.Photo(album_id=album_id, filename=file.filename, file_path=file_path)
        db.add(new_photo)

    db.commit()
    process_album_task.delay(album_id)
    return {"message": "Success", "album_id": album_id}

@app.get("/albums/")
def get_all_albums(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    albums = db.query(models.Album).filter(models.Album.user_id == current_user.id).order_by(models.Album.id.desc()).all()
    return [{"id": a.id, "title": a.title, "status": a.status} for a in albums]

@app.get("/albums/{album_id}")
def get_album_results(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album: raise HTTPException(status_code=404, detail="Album not found")

    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id).all()
    return {
        "album_id": album.id, "title": album.title, "processing_status": album.status, "total_photos": len(photos),
        "results": [
            {
                "photo_id": p.id, "filename": p.filename, "decision": p.status,
                "is_blurry": p.is_blurry, "sharpness_score": p.sharpness_score, "is_duplicate": p.is_duplicate,
                "has_target_face": p.has_target_face, "matched_target_path": getattr(p, "matched_target_path", None),
                "ai_description": p.ai_description, "file_path": p.file_path
            } for p in photos
        ]
    }

class PhotoUpdate(BaseModel):
    decision: str
    is_blurry: bool
    is_duplicate: bool

@app.patch("/photos/{photo_id}/status")
def update_photo_status(photo_id: int, update: PhotoUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    photo = db.query(models.Photo).join(models.Album).filter(models.Photo.id == photo_id, models.Album.user_id == current_user.id).first()
    if not photo: raise HTTPException(status_code=404, detail="Photo not found")

    photo.status = update.decision
    photo.is_blurry = update.is_blurry
    photo.is_duplicate = update.is_duplicate
    db.commit()
    return {"message": "Updated"}

@app.delete("/albums/{album_id}")
def delete_album(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album: raise HTTPException(status_code=404, detail="Album not found")

    album_dir = os.path.join(UPLOAD_DIR, str(album_id))
    if os.path.exists(album_dir): shutil.rmtree(album_dir)

    db.query(models.Photo).filter(models.Photo.album_id == album_id).delete()
    db.delete(album)
    db.commit()
    return {"message": "Deleted"}

# --- EXPORT ROUTES ---
@app.get("/albums/{album_id}/download")
def download_album_local(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album: raise HTTPException(status_code=404)

    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id, models.Photo.status == 'kept').all()
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for photo in photos:
            if not os.path.exists(photo.file_path): continue
            folder_name = "VIP Matches" if photo.has_target_face else "General Keepers"
            zip_path = f"Curated_{album.title}/{folder_name}/{photo.filename}"
            zip_file.write(photo.file_path, arcname=zip_path)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=Curated_{album.title.replace(' ', '_')}.zip"}
    )

class DriveExportRequest(BaseModel):
    access_token: str

@app.post("/albums/{album_id}/export-drive")
def export_to_drive(album_id: int, req: DriveExportRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album: raise HTTPException(status_code=404)
    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id, models.Photo.status == 'kept').all()

    try:
        creds = Credentials(token=req.access_token)
        service = build('drive', 'v3', credentials=creds)

        folder_metadata = {'name': f'✨ Curated: {album.title}', 'mimeType': 'application/vnd.google-apps.folder'}
        main_folder = service.files().create(body=folder_metadata, fields='id').execute()
        main_folder_id = main_folder.get('id')

        vip_meta = {'name': 'VIP Matches', 'parents': [main_folder_id], 'mimeType': 'application/vnd.google-apps.folder'}
        kept_meta = {'name': 'General Keepers', 'parents': [main_folder_id], 'mimeType': 'application/vnd.google-apps.folder'}

        vip_folder_id = service.files().create(body=vip_meta, fields='id').execute().get('id')
        kept_folder_id = service.files().create(body=kept_meta, fields='id').execute().get('id')

        for photo in photos:
            if not os.path.exists(photo.file_path): continue
            parent_id = vip_folder_id if photo.has_target_face else kept_folder_id
            file_metadata = {'name': photo.filename, 'parents': [parent_id]}
            media = MediaFileUpload(photo.file_path, mimetype='image/jpeg', resumable=True)
            service.files().create(body=file_metadata, media_body=media, fields='id').execute()

        return {"message": "Successfully exported to Google Drive!"}
    except Exception as e:
        print(f"Drive Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload to Google Drive.")


# --- AGENTIC RAG ROUTES ---

class ChatRequest(BaseModel):
    message: str

@app.post("/albums/{album_id}/curator-chat")
def chat_with_curator(album_id: int, req: ChatRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album: raise HTTPException(status_code=404)

    try:
        # 1. Gemini Embedding
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        embed_result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=req.message,
            output_dimensionality=768
        )
        query_embedding = embed_result['embedding']

        # 2. DO Postgres Vector Search
        results = db.query(models.Photo).filter(
            models.Photo.album_id == album_id,
            models.Photo.status == "kept",
            models.Photo.embedding.isnot(None)
        ).order_by(
            models.Photo.embedding.cosine_distance(query_embedding)
        ).limit(3).all()

        found_descriptions = [f"Photo ID {p.id}: {p.ai_description}" for p in results]
        found_text = "\n".join(found_descriptions) if found_descriptions else "No specific photos matched."

        # 3. DO Gradient Agent
        agent_prompt = f"""You are 'Aperture AI', a premium photography assistant built on DigitalOcean.
The user asked: "{req.message}"
We found these matching photos via vector search:
{found_text}

INSTRUCTIONS: Write a short, friendly response (2 sentences max). Mention you found these photos. Be enthusiastic, use emojis."""

        AGENT_URL = os.getenv("AGENT_URL")
        AGENT_KEY = os.getenv("AGENT_KEY")
        client = OpenAI(base_url=AGENT_URL, api_key=AGENT_KEY)

        resp = client.chat.completions.create(
            model="n/a",
            messages=[{"role": "user", "content": agent_prompt}],
            max_completion_tokens=150,
        )

        return {
            "agent_reply": resp.choices[0].message.content,
            "photos": [{"id": p.id, "filename": p.filename, "file_path": p.file_path} for p in results]
        }
    except Exception as e:
        print(f"DO Agentic RAG Error: {e}")
        raise HTTPException(status_code=500, detail="Search failed.")

@app.post("/photos/{photo_id}/generate-caption")
def generate_photo_caption(photo_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """AI Chaining: On-demand Vision -> DO Agent Caption Generation"""
    photo = db.query(models.Photo).join(models.Album).filter(
        models.Photo.id == photo_id,
        models.Album.user_id == current_user.id
    ).first()

    if not photo or not os.path.exists(photo.file_path):
        raise HTTPException(status_code=404, detail="Photo not found")

    album = db.query(models.Album).filter(models.Album.id == photo.album_id).first()

    try:
        # 1. EYES: Gemini 2.5 Flash Vision
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        vision_model = genai.GenerativeModel('gemini-2.5-flash')
        img = PIL.Image.open(photo.file_path)

        vision_prompt = "Describe the lighting, mood, subjects, and setting of this photo in 2 highly descriptive sentences."
        vision_resp = vision_model.generate_content([vision_prompt, img])
        visual_description = vision_resp.text.strip()

        # 2. BRAIN: DigitalOcean Agent (WITH STRICT SHOCK COLLAR PROMPT)
        agent_prompt = f"""You are a professional social media copywriter.
Write 3 Instagram captions for a photo taken at an event called '{album.title}'.
Here is the visual description of the photo: "{visual_description}"

STRICT RULES:
1. DO NOT invent names of people (like Emily, John, etc.).
2. DO NOT write an introduction or greeting (No "Hello! Here are your captions...").
3. DO NOT mention statistics or how many photos were deleted.
4. Keep every caption SHORT (under 20 words).
5. Include exactly 2 emojis and 3 hashtags per caption.
6. Format your output EXACTLY as a numbered list starting with "1.", "2.", "3.". Output nothing else."""

        AGENT_URL = os.getenv("AGENT_URL")
        AGENT_KEY = os.getenv("AGENT_KEY")
        client = OpenAI(base_url=AGENT_URL, api_key=AGENT_KEY)

        resp = client.chat.completions.create(
            model="n/a",
            messages=[{"role": "user", "content": agent_prompt}],
            max_completion_tokens=250,
        )
        return {"captions": resp.choices[0].message.content}
    except Exception as e:
        print(f"Caption Generation Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate captions.")