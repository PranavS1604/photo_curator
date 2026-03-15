FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required by OpenCV and DeepFace
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download SFace weights at build time so the worker doesn't fetch them mid-task.
# We manually create the directory first (gdown fails if it doesn't exist),
# then download directly with wget which is more reliable in Docker build context.
RUN mkdir -p /root/.deepface/weights && \
    wget -q --show-progress \
    -O /root/.deepface/weights/face_recognition_sface_2021dec.onnx \
    https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]