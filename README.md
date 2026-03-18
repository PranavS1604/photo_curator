# ✨ Smart Photo Curator & Aperture AI

An enterprise-grade, AI-powered SaaS application designed to automate the grueling process of event photo culling. 

Upload massive, messy folders of raw event photos, and our cloud-based pipeline will automatically detect blinks, remove exact duplicates, and isolate specific VIPs using localized telemetry. Once curated, the true magic begins: **Aperture AI**, a fully-managed DigitalOcean Agent, uses Semantic Vector Search to act as your personal conversational archivist and social media copywriter.

![Sliding UI Dashboard](sample-images/dashboard.png)
![Features](sample-images/features.png)
![Aperture AI Chat](sample-images/aperture-ai.png)
![Caption-generation](sample-images/captions.png)

### 🔗 Quick Links
* **[Watch the 3-Minute Demo Video](https://youtu.be/oCr4bPGKRZ8)**
* **[Live Demo Environment](http://157.245.110.211.nip.io:8080/)**

---

## 🏆 Built for the DigitalOcean Gradient™ AI Hackathon

We moved beyond basic API wrappers to build a **Multi-Agent Orchestration Pipeline entirely deployed on DigitalOcean infrastructure**. Here is how we utilized the DigitalOcean AI Ecosystem:

1. **DigitalOcean Gradient™ AI Agents (Agentic RAG):** We built the "Aperture Persona," a fully-managed DigitalOcean Agent. Instead of a standard search bar, users chat with Aperture. Our backend calculates vector math and injects the context directly into the DO Agent, which streams back highly specific, enthusiastic responses along with the exact photos the user requested.
2. **DigitalOcean Managed PostgreSQL + `pgvector`:**
   We deployed a DO Managed Database and utilized the `pgvector` extension to create a lightning-fast semantic search engine. Our backend stores 768-dimension arrays, allowing users to search their albums by *meaning* (e.g., "smiling at sunset") rather than relying on filenames.
3. **DigitalOcean Agent Model Chaining (The Copywriter):** When a user requests an Instagram caption, we execute *AI Model Chaining*. We use a lightweight vision model simply to "look" at the photo and extract raw data. We then pipe that data directly to our **DigitalOcean Agent**, relying on its superior reasoning capabilities to write strict, perfectly formatted social media copy.
4. **DigitalOcean Droplets (Compute & Hosting):**
   The entire containerized architecture, including the heavy local computer vision workers and the Nginx React frontend, is hosted securely on a DigitalOcean Droplet.

---

## 🏗️ Architectural Design

```mermaid
flowchart LR
  %% --- DIGITALOCEAN & BRAND COLOR PALETTE ---
  %% Official DO Blue: #0069ff, DO Navy: #031b4e
  classDef doGradient fill:#0069ff,stroke:#00f0ff,stroke-width:3px,color:#ffffff,rx:12px
  classDef doDroplet fill:#031b4e,stroke:#0069ff,stroke-width:2px,color:#ffffff,rx:8px
  classDef doDB fill:#059669,stroke:#34d399,stroke-width:2px,color:#ffffff,rx:8px
  classDef google fill:#1e293b,stroke:#ea4335,stroke-width:2px,color:#ffffff,rx:8px
  classDef aiTask fill:#312e81,stroke:#8b5cf6,stroke-width:2px,color:#ffffff,rx:8px
  classDef reactUI fill:#0f172a,stroke:#22d3ee,stroke-width:2px,color:#22d3ee,rx:8px
  classDef cluster fill:none,stroke:#475569,stroke-width:2px,stroke-dasharray: 4 4,rx:10px

  %% --- SYSTEM NODES ---
  User(("👤 User"))
  UI["⚛️ React SPA<br/>(Cinematic Sliding UI)"]:::reactUI

  subgraph GoogleCloud ["🌐 Google Cloud API"]
    OAuth["🔐 Google Auth"]:::google
    Drive["☁️ Drive Export"]:::google
    GeminiVision["Gemini 2.5 Flash<br/>(Vision Extraction)"]:::google
    GeminiEmbed["Gemini Embeddings<br/>(768d Vectors)"]:::google
  end

  subgraph GradientAI ["🌊 DigitalOcean Gradient™ AI Platform"]
    DO_Agent["Gradient™ AI Agent<br/>(Aperture RAG Persona)"]:::doGradient
    DO_Inference["Gradient™ Serverless<br/>(Caption Generator)"]:::doGradient
  end

  subgraph Backend ["⚡ Backend Layer (DO Droplet)"]
    API["FastAPI Server<br/>(Docker Container)"]:::doDroplet
  end

  subgraph DataLayer ["🗄️ DO Managed Data Layer"]
    Broker[("Redis<br/>(Message Broker)")]:::doDroplet
    DB[("🐘 DO Managed PostgreSQL<br/>(+ pgvector Extension)")]:::doDB
    Disk[("Droplet Volume<br/>(Raw Images)")]:::doDroplet
  end

  subgraph AIEngine ["🧠 Async AI Pipeline (DO Droplet)"]
    Celery["Celery Worker<br/>(Self-Recycling)"]:::doDroplet
    Telemetry["Local Telemetry<br/>(OpenCV, pHash, SFace)"]:::aiTask
    Batcher["📦 JSON Batch Multiplexer<br/>(15 Photos / Request)"]:::aiTask
  end

  %% --- WORKFLOW ROUTING ---
  
  %% 1. Upload Flow
  User -->|"Interacts"| UI
  UI -.->|"1. Authenticate"| OAuth
  UI ==>|"2. Multipart Upload"| API
  API ==>|"3. Write Files"| Disk
  API ==>|"4. Push Task"| Broker
  
  %% 2. Async Culling Flow (Local)
  Broker ==>|"5. Consume"| Celery
  Celery <-->|"6. Blur/Blink/VIP Culling"| Telemetry
  Celery ==>|"7. Send Keepers"| Batcher

  %% 3. Batch Vision & Vectorization
  Batcher <-->|"8. Describe Batch"| GeminiVision
  Batcher <-->|"9. Convert to 768d Math"| GeminiEmbed
  Batcher --->|"10. Store Metadata & Vectors"| DB

  %% 4. Agentic RAG & Copywriting (The Gradient Magic)
  UI ==>|"11. Ask Aperture Chat"| API
  API <-->|"12. Embed User Query"| GeminiEmbed
  API <-->|"13. Cosine Distance Search"| DB
  API <-->|"14. Inject RAG Context"| DO_Agent
  DO_Agent -.->|"15. Stream Chat Reply"| UI
  
  API <-->|"16. Generate Social Copy"| DO_Inference
  DO_Inference -.->|"17. Return Captions"| UI

  %% 5. Export
  UI ==>|"18. Trigger Export"| API
  API ==>|"19. Secure Upload"| Drive

  %% Apply cluster styling
  class GoogleCloud,Backend,DataLayer,AIEngine,GradientAI cluster
```
---

## 🚀 Core Features

* **Multi-Agent Orchestration (Aperture AI):** A conversational interface that replaces the standard "Search Bar". Chat with your album, retrieve specific memories, and generate highly-contextual social media captions on demand.
* **Batch Vision Multiplexing:** Bypasses standard API rate limits. Our Celery worker dynamically groups photos into batches, forcing the Vision AI to analyze multiple images in a single, massive JSON request, cutting processing time by 80%.
* **Intelligent Photo Culling (Local Telemetry):** Automatically detects and trashes out-of-focus images using OpenCV Laplacian variance.
* **Blink Detection:** Utilizes Google's MediaPipe Face Landmarker to calculate Eye Aspect Ratios (EAR) and reject photos where subjects have their eyes closed.
* **CPU-Optimized VIP Facial Recognition:** Drop reference selfies and assign custom names. The system uses lightweight facial embeddings to calculate exact Cosine Distances, strictly isolating target individuals in group photos.
* **Direct Google Drive Export:** Instantly push curated VIP and Keeper folders directly into the user's personal Google Drive via the Drive API.
* **Cinematic UI/UX:** A responsive, edge-to-edge React frontend featuring a conversational agent interface, cascading CSS animations, and a seamless sliding manual-override lightbox.

---

## 🧠 Architectural Engineering & Problem Solving

During development, we faced the fundamental tradeoff of AI engineering: **Speed vs. Intelligence**. 
Relying heavily on Cloud APIs for Semantic Search resulted in `429 Rate Limit` and `401 Unauthorized` blocks. 

To create a production-ready, bulletproof app, we engineered a hybrid architecture:
* **The Telemetry Phase (Local):** We keep the heavy lifting (Blur detection, pHash burst grouping, and Facial Recognition) completely local on the DigitalOcean Droplet. This costs $0 in API fees and runs instantly.
* **The Semantic Phase (Cloud):** We only use the cloud AI to generate 768-dimensional math vectors for the photos that *survived* the culling phase. By bundling these requests using **JSON Batch Multiplexing**, we achieve maximum semantic intelligence while staying drastically under API rate limits.

---

## 🛠️ Tech Stack

**Infrastructure & Cloud:**
* DigitalOcean Droplet (Hosting & Compute)
* DigitalOcean Managed PostgreSQL + `pgvector` (Vector Database)
* Docker & Docker Compose (Container Orchestration)

**AI & Machine Learning Pipeline:**
* **DigitalOcean Gradient™ AI:** Managed Agents & Conversational Microservices
* **Google Generative AI:** Gemini 1.5 Flash (Vision extraction) & Embeddings
* **DeepFace (SFace) & MediaPipe:** Lightweight Facial Embeddings & Landmarks
* **OpenCV & ImageHash:** Telemetry and sharpness scoring

**Frontend:**
* React.js (Vite)
* Custom CSS3 Glassmorphism
* Google OAuth 2.0 (@react-oauth/google)

**Backend & Task Queue:**
* Python 3.12 & FastAPI
* SQLAlchemy & PyJWT
* Celery & Redis (Asynchronous Message Broker)

---

## ⚙️ Installation & Local Setup

### 1. Prerequisites
* [Docker & Docker Compose](https://docs.docker.com/get-docker/) installed.
* A Google Cloud Project with an **OAuth Client ID** and the **Google Drive API** enabled.
* A **DigitalOcean Managed PostgreSQL** database connection string.

### 2. Environment Variables (`.env`)
Create a `.env` file inside your `photo_backend` directory:

```env
# Google Vision & Vector Math
GEMINI_API_KEY=your_google_ai_studio_key_here

# DigitalOcean Agent
AGENT_URL=[https://your-agent-url.agents.do-ai.run/api/v1/](https://your-agent-url.agents.do-ai.run/api/v1/)
AGENT_KEY=your_do_agent_key_here

# Database
DATABASE_URL=postgresql://doadmin:your_password@your_do_db_[cluster.ondigitalocean.com:25060/defaultdb?sslmode=require](https://cluster.ondigitalocean.com:25060/defaultdb?sslmode=require)

# Authentication
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
JWT_SECRET=super_secret_string
```

### 3. Launch the Application

Simply open a terminal in the root directory and run:

```bash
docker-compose up -d --build
```

Docker will automatically:
1. Spin up the Redis message broker.
2. Build the FastAPI backend and sync the 768-dim vector tables with PostgreSQL.
3. Download the ML models and launch the Celery AI worker.
4. Serve the React frontend via Nginx.

Access the application in your browser at `http://DROPLET-IP:8080/` (or your Droplet's IP address).

---


