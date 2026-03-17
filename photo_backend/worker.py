from celery import Celery
import database, models
import os
import json
import time
from sqlalchemy.orm import Session
from analyzer import check_blur, get_image_hash, analyze_faces_dynamic, check_for_target_faces
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

celery_app = Celery(
    "photo_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

# Helper function to split photos into chunks
def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

@celery_app.task
def process_album_task(album_id: int):
    print(f"🚀 Starting BATCH VISION processing for Album {album_id}...")
    db: Session = database.SessionLocal()

    album = db.query(models.Album).filter(models.Album.id == album_id).first()
    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id).all()

    album.status = "processing"
    db.commit()

    target_faces = []
    if album.target_face_paths:
        target_faces = album.target_face_paths.split(",")

    # --- PHASE 1: Extract Data ---
    photo_data_list = []
    for photo in photos:
        is_blurry, score = check_blur(photo.file_path)
        img_hash = get_image_hash(photo.file_path)
        eyes_open, face_count = analyze_faces_dynamic(photo.file_path)

        if img_hash is not None and is_blurry is not None:
            photo_data_list.append({
                "db_record": photo,
                "hash": img_hash,
                "score": score,
                "is_blurry": is_blurry,
                "eyes_open": eyes_open,
                "face_count": face_count
            })

    # --- PHASE 2: Group by burst ---
    grouped_images = []
    hash_cutoff = 5
    for p_data in photo_data_list:
        matched_group = False
        for group in grouped_images:
            if p_data["hash"] - group[0]["hash"] <= hash_cutoff:
                group.append(p_data)
                matched_group = True
                break
        if not matched_group:
            grouped_images.append([p_data])

    # --- PHASE 3: Select Best and Assign Status ---
    keepers_to_embed = []

    for group in grouped_images:
        group.sort(key=lambda x: x["score"], reverse=True)
        best_image = next((img for img in group if not img["is_blurry"] and img["eyes_open"]), group[0])

        for img in group:
            db_photo = img["db_record"]
            db_photo.sharpness_score = img["score"]
            db_photo.is_blurry = img["is_blurry"]

            if img != best_image:
                db_photo.is_duplicate = True
                db_photo.status = "trash"
            elif img["is_blurry"] or not img["eyes_open"]:
                db_photo.is_duplicate = False
                db_photo.status = "trash"
            else:
                db_photo.is_duplicate = False
                db_photo.status = "kept"

                if target_faces and img["face_count"] > 0:
                    is_match, match_path = check_for_target_faces(target_faces, db_photo.file_path)
                    db_photo.has_target_face = is_match
                    db_photo.matched_target_path = os.path.basename(match_path) if is_match and match_path else None
                else:
                    db_photo.has_target_face = False
                    db_photo.matched_target_path = None

                keepers_to_embed.append(db_photo)

    db.commit()

    # --- PHASE 4: BATCH VISION MULTIPLEXING (Fast + Smart!) ---
    print(f"⚡ Unleashing Gemini Batch Vision on {len(keepers_to_embed)} photos. Processing 10 at a time...")

    vision_model = genai.GenerativeModel('gemini-2.5-flash')

    # Split the kept photos into chunks of 10
    batches = list(chunk_list(keepers_to_embed, 10))

    for batch_idx, batch in enumerate(batches):
        print(f"📸 Sending Batch {batch_idx + 1}/{len(batches)} to Gemini...")

        # 1. Build the Multiplexed Prompt
        prompt_elements = [
            f"You are analyzing a batch of photos from the album '{album.title}'. "
            "Return a JSON array of strings. Each string must be a 2-sentence description of the corresponding image, focusing on emotions, setting, actions, and people. "
            f"There are {len(batch)} images below. Ensure the JSON array has exactly {len(batch)} string items."
        ]

        # Load all images in this batch into memory
        for idx, photo in enumerate(batch):
            prompt_elements.append(f"Image {idx + 1}:")
            prompt_elements.append(Image.open(photo.file_path))

        try:
            # 2. Ask Gemini to describe all 5 images simultaneously
            response = vision_model.generate_content(
                prompt_elements,
                generation_config={"response_mime_type": "application/json"} # Force clean JSON output
            )

            # Parse the JSON array of strings
            descriptions = json.loads(response.text)

            # 3. Create the Embeddings instantly (Embeddings API has a 1500 RPM limit, so this is safe)
            for photo, desc in zip(batch, descriptions):
                embed_result = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=desc,
                    output_dimensionality=768
                )
                photo.ai_description = desc
                photo.embedding = embed_result['embedding']
                print(f"✅ Fast Semantic data saved for {photo.filename}")

            db.commit()

        except Exception as e:
            print(f"⚠️ Batch Vision AI failed for this chunk: {e}")

    album.status = "completed"
    db.commit()
    db.close()
    print(f"\n🎉 Processing Complete for Album {album_id}!")