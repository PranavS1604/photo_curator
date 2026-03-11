import requests

base_url = 'http://127.0.0.1:8000'

# --- STEP 1: Create a New Album ---
print("1. Creating a new album...")
# We send form data to match what the FastAPI endpoint expects
album_data = {'title': 'My Automated Test Album'}
response_album = requests.post(f"{base_url}/albums/", data=album_data)

print(f"Server Response: {response_album.json()}")

# Extract the newly created ID (it should be 1 since the DB is fresh)
album_id = response_album.json().get('album_id')

# --- STEP 2: Upload Photos to that Album ---
if album_id:
    print(f"\n2. Uploading photos to Album #{album_id}...")
    url_upload = f'{base_url}/albums/{album_id}/upload-photos/'
    
    # Make sure these paths match the actual dummy files in your folder!
    files = [
        ('files', ('test1.jpg', open('test_images/photo1.jpg', 'rb'), 'image/jpeg')),
        ('files', ('test2.jpg', open('test_images/photo2.jpg', 'rb'), 'image/jpeg'))
    ]
    
    response_upload = requests.post(url_upload, files=files)
    
    print(f"Status Code: {response_upload.status_code}")
    print(f"Server Response: {response_upload.json()}")
else:
    print("Failed to create album. Cannot upload photos.")