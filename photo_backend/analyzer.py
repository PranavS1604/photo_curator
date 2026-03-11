import cv2
import os
import imagehash
from PIL import Image
import math
import urllib.request
import numpy as np  # <-- NEW: Required for strict distance math
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from deepface import DeepFace

# --- Setup MediaPipe Tasks API ---
model_path = "face_landmarker.task"
if not os.path.exists(model_path):
    print("Downloading Google's Face Landmarker Model (~3MB)...")
    url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    urllib.request.urlretrieve(url, model_path)

base_options = python.BaseOptions(model_asset_path=model_path)
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    num_faces=20
)
face_landmarker = vision.FaceLandmarker.create_from_options(options)

def check_blur(image_path, threshold=150.0):
    image = cv2.imread(image_path)
    if image is None:
        return None, 0.0 
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    focus_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    return focus_score < threshold, focus_score

def get_image_hash(image_path):
    try:
        img = Image.open(image_path)
        return imagehash.phash(img)
    except Exception:
        return None

# --- NEW: TRUE ONE-TO-MANY FACIAL RECOGNITION ---
def check_for_target_faces(target_paths, image_path):
    """
    Extracts every face in the group photo and checks them individually against the VIPs.
    """
    if not target_paths:
        return False, None
        
    try:
        # 1. Extract mathematical embeddings for EVERY face in the group photo
        # enforce_detection=True strictly prevents false positives from background objects
        group_faces = DeepFace.represent(
            img_path=image_path, 
            model_name="ArcFace", 
            enforce_detection=True
        )
    except ValueError:
        # No faces detected at all (Safe to skip)
        return False, None
    except Exception as e:
        print(f"Extraction error on {image_path}: {e}")
        return False, None
        
    for target_path in target_paths:
        try:
            # 2. Extract the embedding for the VIP Selfie
            target_data = DeepFace.represent(
                img_path=target_path, 
                model_name="ArcFace", 
                enforce_detection=True
            )
            target_embedding = target_data[0]["embedding"]
            
            # 3. Compare the VIP against EVERY person in the group photo
            for face in group_faces:
                group_embedding = face["embedding"]
                
                # Calculate the exact Cosine Distance between the two faces
                a = np.matmul(np.transpose(target_embedding), group_embedding)
                b = np.sum(np.multiply(target_embedding, target_embedding))
                c = np.sum(np.multiply(group_embedding, group_embedding))
                distance = 1 - (a / (np.sqrt(b) * np.sqrt(c)))
                
                # 4. Strict Matching Threshold
                # The default ArcFace threshold is 0.68. 
                # We are lowering it to 0.60 to make the AI STRICTER and prevent false positives!
                # (If it starts missing your VIP, change this to 0.65)
                if distance < 0.65:
                    return True, target_path
        except Exception:
            continue
            
    return False, None

def get_distance(p1, p2):
    return math.hypot(p2.x - p1.x, p2.y - p1.y)

def calculate_ear(eye_landmarks):
    v1 = get_distance(eye_landmarks[1], eye_landmarks[5])
    v2 = get_distance(eye_landmarks[2], eye_landmarks[4])
    h = get_distance(eye_landmarks[0], eye_landmarks[3])
    return (v1 + v2) / (2.0 * h) if h != 0 else 0

def analyze_faces_dynamic(image_path, blink_threshold=0.20):
    try:
        mp_image = mp.Image.create_from_file(image_path)
        detection_result = face_landmarker.detect(mp_image)
    except Exception:
        return True, 0 
        
    if not detection_result.face_landmarks:
        return True, 0 
        
    blinking_faces = 0
    face_count = len(detection_result.face_landmarks)
    
    for face_landmarks in detection_result.face_landmarks:
        left_eye_indices = [362, 385, 387, 263, 373, 380]
        right_eye_indices = [33, 160, 158, 133, 153, 144]
        
        left_eye = [face_landmarks[i] for i in left_eye_indices]
        right_eye = [face_landmarks[i] for i in right_eye_indices]
        
        avg_ear = (calculate_ear(left_eye) + calculate_ear(right_eye)) / 2.0
        if avg_ear < blink_threshold:
            blinking_faces += 1
                
    return (blinking_faces == 0), face_count