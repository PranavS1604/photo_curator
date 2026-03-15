# ✨ Smart Photo Curator & Aperture AI

An enterprise-grade, AI-powered SaaS application designed to automate the grueling process of event photo culling. Upload massive raw event folders, and the cloud-based AI pipeline will automatically group burst shots, reject blurry photos, detect blinks, and isolate specific VIPs.

Once curated, users can chat with **Aperture**, a fully-managed DigitalOcean Agent that uses Vision AI and mathematical telemetry to generate hyper-contextual social media captions.

## 🏆 Powered by DigitalOcean

*Built for the DigitalOcean AI Hackathon*

We moved beyond basic API calls by building a **Multi-Agent Orchestration Pipeline deployed on DigitalOcean infrastructure**:

1. **The Vision Module:** We route the best curated photo from an album to Google's Gemini 2.5 Flash Vision model. Gemini uses the image and the specific Album Name to generate a highly accurate textual representation of the event's lighting, mood, location, and subjects.
2. **The ADK Agent:** We built the "Aperture Persona" as a **Fully-Managed Agent** hosted on DigitalOcean using their Agent Development Kit (ADK) and Llama 3 Instruct (8B).
3. **The Orchestration:** Our FastAPI backend injects the Gemini visual context, the user's real Google Account name, and our local OpenCV mathematical telemetry directly into the DO Agent. Aperture then streams back 6 highly specific, visually-aware social media captions via a beautifully animated UI.

---

## 🚀 Core Features

* **Multi-Agent Orchestration (Aperture AI):** Combines Google Gemini Vision with a DigitalOcean Managed Agent to generate contextual social media copy based on album names, visual data, and cull statistics.
* **Intelligent Photo Culling:** Automatically detects and trashes out-of-focus images using OpenCV Laplacian variance.
* **Blink Detection:** Utilizes Google's MediaPipe Face Landmarker to calculate Eye Aspect Ratios (EAR) and reject photos where subjects have their eyes closed.
* **Burst Duplicate Removal:** Uses Perceptual Hashing (pHash) to group visually identical burst shots and automatically selects the sharpest frame to keep.
* **CPU-Optimized VIP Facial Recognition:** Drop reference selfies and assign them custom names in the UI. The system uses **SFace** to calculate exact Cosine Distances, strictly isolating target individuals in group photos without requiring heavy GPU compute.
* **Secure Google Authentication:** Fully authenticated user sessions using Google Identity Services and secure JSON Web Tokens (JWT).
* **Direct Google Drive Export:** Instantly push curated VIP and Keeper folders directly into the user's personal Google Drive using the Google Drive API.
* **Interactive Dark-Mode Dashboard:** A responsive, edge-to-edge React frontend featuring tabbed categorization, custom file-renaming on the fly, cascading CSS animations, and a cinematic manual-override lightbox.

---

## 🧠 Hardware-Aware ML Engineering

Running heavy C++ computer vision libraries (TensorFlow, MediaPipe, OpenCV) on cloud CPUs often leads to silent Out-Of-Memory (OOM) crashes. We engineered this pipeline for maximum cloud stability:

* **Lazy Loading:** MediaPipe models are strictly lazy-loaded only when a task requires them, preventing massive memory spikes across idle worker forks.
* **Process Recycling:** Celery workers are configured with --max-tasks-per-child=1, forcing the worker to safely destroy itself and release 100% of its C++ memory back to the Droplet after every album, completely eliminating ML memory leaks.
* **Lightweight Recognition:** Swapped traditional heavy AI models (like VGG-Face/ArcFace) for **SFace**, a highly optimized model that runs blazing fast on standard DigitalOcean vCPUs.
* **Data-Type Bridging:** Built safe casting mechanisms (`float()`) to translate native `numpy.float64` matrix calculations into formats accepted by PostgreSQL.

---

## 🛠️ Tech Stack

**Infrastructure & Cloud:**

* DigitalOcean Droplet (Hosting & Compute)
* DigitalOcean Managed PostgreSQL (Database)
* Docker & Docker Compose (Container Orchestration)

**Frontend:**

* React.js (Vite)
* CSS3 (Custom Keyframe Animations & Glassmorphism)
* Google OAuth 2.0 (@react-oauth/google)

**Backend & Task Queue:**

* Python 3.12 & FastAPI
* SQLAlchemy & PyJWT
* Celery & Redis (Asynchronous Message Broker)

**AI & Machine Learning Pipeline:**

* **DigitalOcean Agent Development Kit (ADK):** Hosted Llama 3 (8B) Microservice
* **Google Generative AI:** Gemini 1.5 Flash (Vision context)
* **DeepFace (SFace):** Lightweight Facial Embeddings
* **MediaPipe:** Face Mesh / Landmarks
* **OpenCV & ImageHash:** Mathematical telemetry and sharpness scoring

---

## 📋 Prerequisites

To run this application, you no longer need to configure Python environments manually. You just need:

* [Docker & Docker Compose](https://docs.docker.com/get-docker/) installed on your machine or Droplet.
* A Google Cloud Project with an **OAuth Client ID** and the **Google Drive API** enabled.
* A **DigitalOcean Managed PostgreSQL** database connection string.

---

## ⚙️ Installation & Setup

### 1. Environment Variables (`.env`)

Create a `.env` file inside your `photo_backend` directory and add your API keys and cloud database URL:

```env
GEMINI_API_KEY=your_google_ai_studio_key_here
DATABASE_URL=postgresql://doadmin:your_password@your_do_db_cluster.ondigitalocean.com:25060/defaultdb?sslmode=require

```

*(Note: Your DigitalOcean Agent URL and Access Key are configured securely in your main.py routing logic).*

### 2. Launch the Application (Docker)

Because the entire stack is containerized, you do not need multiple terminal windows. Simply open a terminal in the root directory (where `docker-compose.yml` lives) and run:

```bash
# Build the containers and start the system in the background
docker-compose up -d --build

```

Docker will automatically:

1. Spin up a Redis message broker.
2. Build the FastAPI backend and connect it to your DO PostgreSQL database.
3. Pre-download the SFace ML models and spin up the Celery AI worker.
4. Build and serve the React frontend via Nginx.

### 3. Monitoring

To watch the AI worker process photos in real-time or check for backend requests, simply run:

```bash
docker-compose logs -f worker backend

```

Access the application in your browser at http://localhost (or your Droplet's IP/Domain).

---

## 🏗️ Cloud Roadmap

We successfully migrated our local MVP to a fully containerized architecture using **DigitalOcean Managed PostgreSQL** and **DigitalOcean Droplets**.

**Future scaling optimizations include:**

1. **Object Storage:** Update the API and Worker to stream incoming photos to **DigitalOcean Spaces** (S3-compatible storage) instead of the Droplet's local Docker volumes.
2. **Auto-Scaling Workers:** Migrate the docker-compose stack to the **DigitalOcean App Platform** to automatically spin up additional stateless Celery worker nodes during heavy traffic spikes.

---

```mermaid
flowchart LR
  %% --- DIGITALOCEAN & BRAND COLOR PALETTE ---
  classDef doManaged fill:#0069ff,stroke:#ffffff,stroke-width:2px,color:#ffffff,rx:8px
  classDef doDroplet fill:#031b4e,stroke:#0069ff,stroke-width:2px,color:#ffffff,rx:8px
  classDef google fill:#1e293b,stroke:#ea4335,stroke-width:2px,color:#ffffff,rx:8px
  classDef aiTask fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#ffffff,rx:8px
  classDef reactUI fill:#083344,stroke:#22d3ee,stroke-width:2px,color:#22d3ee,rx:8px
  classDef cluster fill:none,stroke:#475569,stroke-width:2px,stroke-dasharray: 5 5,rx:10px

  %% --- SYSTEM NODES ---
  User(("👤 User"))
  UI["⚛️ React SPA<br/>(Vite, Axios)"]:::reactUI

  subgraph External ["🌐 Google Cloud Services"]
    OAuth["🔐 Google Auth<br/>(OAuth 2.0)"]:::google
    Drive["☁️ Google Drive<br/>(Export API)"]:::google
  end

  subgraph CloudAI ["☁️ Managed AI Orchestration"]
    Gemini["Google Gemini 2.5 Flash<br/>(Vision Context)"]:::google
    DO_ADK["DigitalOcean ADK Agent<br/>(Llama 3 Persona)"]:::doManaged
  end

  subgraph Backend ["⚡ Backend Layer (DO Droplet)"]
    API["FastAPI Server<br/>(Docker Container)"]:::doDroplet
  end

  subgraph DataLayer ["🗄️ Cloud Storage & Messaging"]
    Broker[("Redis Container<br/>(Task Broker)")]:::doDroplet
    DB[("DO Managed PostgreSQL<br/>(Cloud Database)")]:::doManaged
    Disk[("Droplet Docker Volume<br/>(Raw Images)")]:::doDroplet
  end

  subgraph AIEngine ["🧠 Async AI Pipeline (DO Droplet)"]
    Celery["Celery Worker<br/>(Recycling Container)"]:::doDroplet
    Hash["ImageHash<br/>(Duplicates)"]:::aiTask
    CV["OpenCV<br/>(Blur Detection)"]:::aiTask
    MP["MediaPipe<br/>(Lazy-Loaded)"]:::aiTask
    DF["DeepFace<br/>(SFace Engine)"]:::aiTask
  end

  %% --- WORKFLOW ROUTING ---
  
  %% 1. Auth Flow
  User -->|"Interacts"| UI
  UI -.->|"1. Authenticate"| OAuth
  OAuth -.->|"2. Issue Token"| API
  
  %% 2. Heavy Data Flow
  UI ==>|"3. Multipart Upload"| API
  API ==>|"4. Write Files"| Disk
  API --->|"5. Write Meta"| DB
  API ==>|"6. Push Task"| Broker
  
  %% 3. Async Processing Flow
  Broker ==>|"7. Consume Task"| Celery
  Celery --->|"8. Read Bytes"| Disk
  
  %% 4. AI Processing
  Celery <-->|"9. Check Duplicates"| Hash
  Celery <-->|"9. Check Blur"| CV
  Celery <-->|"9. Check Blinks"| MP
  Celery <-->|"9. Match VIPs"| DF
  
  %% 5. Resolution & Export
  Celery --->|"10. Update Status"| DB
  UI -.->|"11. Poll Progress"| API
  UI ==>|"12. Trigger Export"| API
  API ==>|"13. Secure Upload"| Drive

  %% 6. Multi-Agent Orchestration
  UI ==>|"14. Ask Aperture AI"| API
  API <-->|"15. Extract Vision Context"| Gemini
  API <-->|"16. Telemetry + Context"| DO_ADK
  DO_ADK -.->|"17. Custom Captions"| API

  %% Apply cluster styling to subgraphs
  class External,Backend,DataLayer,AIEngine,CloudAI cluster
```