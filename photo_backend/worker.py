from celery import Celery
import database, models
import os
from sqlalchemy.orm import Session
from analyzer import check_blur, get_image_hash, analyze_faces_dynamic, check_for_target_faces

celery_app = Celery(
    "photo_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

@celery_app.task
def process_album_task(album_id: int):
    print(f"🚀 Starting background processing for Album {album_id}...")
    db: Session = database.SessionLocal()
    
    album = db.query(models.Album).filter(models.Album.id == album_id).first()
    photos = db.query(models.Photo).filter(models.Photo.album_id == album_id).all()
    
    album.status = "processing"
    db.commit()

    target_faces = []
    if album.target_face_paths:
        target_faces = album.target_face_paths.split(",")

    # --- PHASE 1: Extract Data (Same as your original loop) ---
    photo_data_list = []
    for photo in photos:
        print(f"Gathering data: {photo.filename}...")
        is_blurry, score = check_blur(photo.file_path)
        img_hash = get_image_hash(photo.file_path)
        
        # We grab the face count here to speed up Phase 3
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

    # --- PHASE 2: Group by burst (Your exact original logic) ---
    grouped_images = []
    hash_cutoff = 5 # Your requested threshold
    
    for p_data in photo_data_list:
        matched_group = False
        for group in grouped_images:
            if p_data["hash"] - group[0]["hash"] <= hash_cutoff:
                group.append(p_data)
                matched_group = True
                break
        if not matched_group:
            grouped_images.append([p_data])

    # --- PHASE 3: Select Best and Update Database (Instead of shutil.copy) ---
    for group in grouped_images:
        # Sort by score, highest first
        group.sort(key=lambda x: x["score"], reverse=True)
        
        # Find best image that isn't blurry and eyes are open
        best_image = None
        for img in group:
            if not img["is_blurry"] and img["eyes_open"]:
                best_image = img
                break
                
        if best_image is None:
            best_image = group[0]

        # Apply database updates based on the grouping
        for img in group:
            db_photo = img["db_record"]
            db_photo.sharpness_score = img["score"]
            db_photo.is_blurry = img["is_blurry"]
            
            # 1. Handle Duplicates
            if img != best_image:
                db_photo.is_duplicate = True
                db_photo.status = "trash"
                db_photo.has_target_face = False
                db_photo.matched_target_path = None
                print(f"❌ Trash (Duplicate) -> {db_photo.filename}")
            
            # 2. Handle Blurry/Blinking
            elif img["is_blurry"] or not img["eyes_open"]:
                db_photo.is_duplicate = False
                db_photo.status = "trash"
                db_photo.has_target_face = False
                db_photo.matched_target_path = None
                print(f"❌ Trash (Blurry/Blink) -> {db_photo.filename}")
            
            # 3. Handle Keepers & Target Matching
            else:
                db_photo.is_duplicate = False
                db_photo.status = "kept"
                
                # Speed Optimization: Only run heavy DeepFace if MediaPipe saw a face
                if target_faces and img["face_count"] > 0:
                    is_match, match_path = check_for_target_faces(target_faces, db_photo.file_path)
                    db_photo.has_target_face = is_match
                    
                    if is_match and match_path:
                        db_photo.matched_target_path = os.path.basename(match_path)
                        print(f"✅ VIP MATCH -> {db_photo.filename}")
                    else:
                        db_photo.matched_target_path = None
                        print(f"✅ Kept -> {db_photo.filename}")
                else:
                    db_photo.has_target_face = False
                    db_photo.matched_target_path = None
                    print(f"✅ Kept -> {db_photo.filename}")

        # Save to database to trigger the live React progress bar
        db.commit()

    album.status = "completed"
    db.commit()
    db.close()
    print(f"\nProcessing Complete for Album {album_id}!")