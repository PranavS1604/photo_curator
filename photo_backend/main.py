from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import requests
import PIL.Image
import google.generativeai as genai
import shutil
import jwt
import zipfile
import io
from fastapi.responses import StreamingResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv # <--- NEW IMPORT
import base64
from openai import OpenAI
import models
import database
from worker import process_album_task

# --- NEW: LOAD ENV VARIABLES ---
load_dotenv()

# --- UPDATED SECURITY CONSTANTS ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET")
DO_MODEL_ACCESS_KEY = os.getenv("DO_MODEL_ACCESS_KEY")
ALGORITHM = "HS256"

if not GOOGLE_CLIENT_ID or not JWT_SECRET:
    raise ValueError("Missing essential environment variables. Please check your .env file.")

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
    """Verifies Google token, creates User if new, and issues an App Session Token."""
    try:
        # Verify the token securely with Google's servers
        idinfo = id_token.verify_oauth2_token(
        request.token,
        google_requests.Request(),
        GOOGLE_CLIENT_ID,
        clock_skew_in_seconds=10  # <--- Adds a 10-second grace period for slow clocks!
    )
        email = idinfo['email']
        name = idinfo.get('name', 'User')
        picture = idinfo.get('picture', '')

        # Find or create user in Database
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email, name=name, picture=picture)
            db.add(user)
            db.commit()
            db.refresh(user)

        # Issue custom JWT for session
        encoded_jwt = jwt.encode({"sub": user.email, "id": user.id}, JWT_SECRET, algorithm=ALGORITHM)
        return {"access_token": encoded_jwt, "user": {"name": user.name, "picture": user.picture, "email": user.email}}

    except ValueError as e:
        print(f"🚨 Google Auth Error: {e}") # <--- This will print the exact reason to your terminal!
        raise HTTPException(status_code=401, detail="Invalid Google Token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """Dependency that locks down routes and returns the logged-in user."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- PROTECTED APP ROUTES ---
@app.post("/albums/")
def create_album(
    title: str = Form(...),
    target_faces: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user) # Locks endpoint
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
    # Ensure album belongs to the user
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    album_dir = os.path.join(UPLOAD_DIR, str(album_id))
    os.makedirs(album_dir, exist_ok=True)

    saved_photos = []
    for file in files:
        file_path = os.path.join(album_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        new_photo = models.Photo(album_id=album_id, filename=file.filename, file_path=file_path)
        db.add(new_photo)
        saved_photos.append(file.filename)

    db.commit()
    process_album_task.delay(album_id)
    return {"message": "Success", "album_id": album_id}

@app.get("/albums/")
def get_all_albums(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Only return albums for THIS user!
    albums = db.query(models.Album).filter(models.Album.user_id == current_user.id).order_by(models.Album.id.desc()).all()
    return [{"id": a.id, "title": a.title, "status": a.status} for a in albums]

@app.get("/albums/{album_id}")
def get_album_results(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id).all()
    return {
        "album_id": album.id, "title": album.title, "processing_status": album.status, "total_photos": len(photos),
        "results": [
            {
                "photo_id": p.id, "filename": p.filename, "decision": p.status,
                "is_blurry": p.is_blurry, "sharpness_score": p.sharpness_score, "is_duplicate": p.is_duplicate,
                "has_target_face": p.has_target_face, "matched_target_path": getattr(p, "matched_target_path", None)
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
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.status = update.decision
    photo.is_blurry = update.is_blurry
    photo.is_duplicate = update.is_duplicate
    db.commit()
    return {"message": "Updated"}

@app.delete("/albums/{album_id}")
def delete_album(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    album_dir = os.path.join(UPLOAD_DIR, str(album_id))
    if os.path.exists(album_dir):
        shutil.rmtree(album_dir)

    db.query(models.Photo).filter(models.Photo.album_id == album_id).delete()
    db.delete(album)
    db.commit()
    return {"message": "Deleted"}

# --- EXPORT ROUTES ---

@app.get("/albums/{album_id}/download")
def download_album_local(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """Packages VIP and Kept photos into a beautifully organized ZIP file."""
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    # Only grab the good photos!
    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id, models.Photo.status == 'kept').all()

    # Create an in-memory zip file
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for photo in photos:
            if not os.path.exists(photo.file_path):
                continue

            # Organize into subfolders inside the ZIP
            if photo.has_target_face:
                folder_name = "VIP Matches"
            else:
                folder_name = "General Keepers"

            # Naming format: AlbumTitle/Category/Filename
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
    """Creates a folder in the user's Google Drive and uploads the curated photos."""
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id, models.Photo.status == 'kept').all()

    try:
        # Authenticate with Google Drive API using the token passed from React
        creds = Credentials(token=req.access_token)
        service = build('drive', 'v3', credentials=creds)

        # 1. Create the Main Album Folder in Drive
        folder_metadata = {
            'name': f'✨ Curated: {album.title}',
            'mimeType': 'application/vnd.google-apps.folder'
        }
        main_folder = service.files().create(body=folder_metadata, fields='id').execute()
        main_folder_id = main_folder.get('id')

        # 2. Create VIP and Keepers Subfolders
        vip_meta = {'name': 'VIP Matches', 'parents': [main_folder_id], 'mimeType': 'application/vnd.google-apps.folder'}
        kept_meta = {'name': 'General Keepers', 'parents': [main_folder_id], 'mimeType': 'application/vnd.google-apps.folder'}

        vip_folder_id = service.files().create(body=vip_meta, fields='id').execute().get('id')
        kept_folder_id = service.files().create(body=kept_meta, fields='id').execute().get('id')

        # 3. Upload the files safely
        for photo in photos:
            if not os.path.exists(photo.file_path):
                continue

            parent_id = vip_folder_id if photo.has_target_face else kept_folder_id

            file_metadata = {'name': photo.filename, 'parents': [parent_id]}
            media = MediaFileUpload(photo.file_path, mimetype='image/jpeg', resumable=True)

            service.files().create(body=file_metadata, media_body=media, fields='id').execute()

        return {"message": "Successfully exported to Google Drive!"}
    except Exception as e:
        print(f"Drive Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload to Google Drive.")

def encode_image(image_path):
    """Helper function to convert local images to Base64 for the AI"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


# @app.post("/albums/{album_id}/curator-chat")
# def chat_with_curator(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
#     """Talks directly to our UI-Managed DO Agent!"""
#     album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
#     if not album:
#         raise HTTPException(status_code=404, detail="Album not found")

#     # 1. Gather Basic Stats
#     photos = db.query(models.Photo).filter(models.Photo.album_id == album_id).all()
#     total = len(photos)
#     vips = [p for p in photos if p.has_target_face]
#     keepers = [p for p in photos if p.status == 'kept' and not p.has_target_face]
#     blurry = [p for p in photos if p.is_blurry]
#     duplicates = [p for p in photos if p.is_duplicate]
#     blinks = [p for p in photos if p.status == 'trash' and not p.is_blurry and not p.is_duplicate]

#     # 2. Extract VIP Names (if any)
#     vip_names = set()
#     for p in vips:
#         if p.matched_target_path:
#             clean_name = os.path.basename(p.matched_target_path).split('_', 2)[-1].split('.')[0]
#             if clean_name.lower() not in ["image", "photo", "selfie"]:
#                 vip_names.add(clean_name.capitalize())

#     vip_string = f"{', '.join(vip_names)}" if vip_names else "None"

#     # 3. Clearly format the data to send to the DO Agent
#     user_text = f"""Here is the exact data for you to use:

# User Name: {current_user.name}
# Album Name: {album.title}

# Photo Statistics:
# - Total uploaded: {total}
# - Good photos kept: {len(keepers) + len(vips)}
# - VIP matches found: {len(vips)} (Target names: {vip_string})
# - Photos deleted due to blur: {len(blurry)}
# - Photos deleted as exact duplicates: {len(duplicates)}
# - Photos deleted due to closed eyes/blinking: {len(blinks)}"""

#     # --- THE MAGIC DO AGENT CONNECTION ---
#     # Notice we added /api/v1/ to the end of your URL as required by DO!
#     AGENT_URL = "https://l7vvbibqjxfykpevtidx5b4d.agents.do-ai.run/api/v1/"
#     AGENT_KEY = "6CMFPIpRiQuByWl0qMy-HreERC7rMK8r"

#     client = OpenAI(
#         base_url=AGENT_URL,
#         api_key=AGENT_KEY,
#     )

#     try:
#         # 4. Call DigitalOcean Managed Agent
#         resp = client.chat.completions.create(
#             model="n/a",  # DO Agents handle the model internally, so we just pass "n/a"
#             messages=[{"role": "user", "content": user_text}]
#         )
#         return {"agent_reply": resp.choices[0].message.content}
#     except Exception as e:
#         print(f"DO Agent Error: {e}")
#         raise HTTPException(status_code=500, detail="Aperture AI is currently unavailable.")

@app.post("/albums/{album_id}/curator-chat")
def chat_with_curator(album_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    """AI Chaining: Gemini Vision (with Location Context) -> DigitalOcean Agent"""
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == current_user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    # 1. Gather Stats
    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id).all()
    total = len(photos)
    vips = [p for p in photos if p.has_target_face]
    keepers = [p for p in photos if p.status == 'kept' and not p.has_target_face]
    blurry = [p for p in photos if p.is_blurry]
    duplicates = [p for p in photos if p.is_duplicate]
    blinks = [p for p in photos if p.status == 'trash' and not p.is_blurry and not p.is_duplicate]

    # Extract VIP names directly from the filename (e.g. Pranav.jpg -> Pranav)
    vip_names = set()
    for p in vips:
        if p.matched_target_path:
            clean_name = os.path.basename(p.matched_target_path).split('_', 2)[-1].split('.')[0]
            if clean_name.lower() not in ["image", "photo", "selfie", "target"]:
                vip_names.add(clean_name.capitalize())
    vip_string = f"{', '.join(vip_names)}" if vip_names else "None"

    # --- AI CHAINING PART 1 (GEMINI VISION) ---
    visual_description = "No outstanding visual data available."
    best_photo = vips[0] if vips else (keepers[0] if keepers else None)

    if best_photo and os.path.exists(best_photo.file_path):
        try:
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            vision_model = genai.GenerativeModel('gemini-2.5-flash')

            img = PIL.Image.open(best_photo.file_path)
            # PASS THE ALBUM TITLE TO GEMINI FOR LOCATION CONTEXT!
            vision_prompt = f"This photo is from an event/album titled '{album.title}'. Describe the lighting, mood, subjects, and setting of this photo in 2 highly descriptive sentences. Guess the vibe or location based on the album title."

            vision_resp = vision_model.generate_content([vision_prompt, img])
            visual_description = vision_resp.text.strip()
            print(f"Gemini saw: {visual_description}")
        except Exception as e:
            print(f"Gemini Vision failed: {e}")

    # --- AI CHAINING PART 2 (DIGITALOCEAN AGENT) ---
    user_text = f"""Here is the exact data for you to use:

User Name: {current_user.name}
Album Name: {album.title}

Photo Statistics:
- Total uploaded: {total}
- Good photos kept: {len(keepers) + len(vips)}
- VIP matches found: {len(vips)} (Target names: {vip_string})

Best Photo Visual Description (Analyzed by our Vision Module):
"{visual_description}"

TASK INSTRUCTIONS:
1. Greet the user, mention the album, and give a 1-sentence summary of the stats.
2. Based entirely on the "Best Photo Visual Description" above, write exactly 6 different Instagram caption options.
3. You MUST include emojis and hashtags in every single caption and keep it short. Make them highly attractive and animated."""

    AGENT_URL = os.getenv("AGENT_URL")
    AGENT_KEY = os.getenv("AGENT_KEY")

    client = OpenAI(
        base_url=AGENT_URL,
        api_key=AGENT_KEY,
    )

    try:
        resp = client.chat.completions.create(
            model="n/a",
            messages=[{"role": "user", "content": user_text}],
            max_completion_tokens=500, # INCREASED TO 800 SO IT DOES NOT CUT OFF!
        )
        return {"agent_reply": resp.choices[0].message.content}
    except Exception as e:
        print(f"DO Agent Error: {e}")
        raise HTTPException(status_code=500, detail="Aperture AI is currently unavailable.")