# AI-Powered Resume Screening System

A scalable, microservices-based platform for intelligent resume screening, job matching, and interview scheduling.  
This project leverages Node.js, Express, MongoDB, Redis, RabbitMQ, LangChain (Google Gemini, Cohere), and more.

---

## 🏗️ **Project Structure**

```
AI-Powered-Resume-Screening-System/
│
├── authentication-service/         # User authentication & authorization
├── resume-processing-service/      # Resume parsing, embedding, and analysis
├── jobmatching-and-ranking-service/# Job posting, matching, and ranking
├── communication-and-interview-scheduling-service/ # Interview scheduling & communication
├── proxy-server/                   # API gateway/proxy for all services
├── README.md
├── .gitignore
└── docker-compose.yml
```

---

## 🚀 **Tech Stack**

- **Node.js & Express** – REST APIs for all services
- **MongoDB** – Database for users, jobs, resumes, interviews
- **Redis** – Caching, session, and fast data storage
- **RabbitMQ** – Message queue for inter-service communication
- **LangChain** – LLM orchestration (Google Gemini, Cohere, Universal Sentence Encoder)
- **Cloudinary** – Resume file storage
- **Docker** – Containerization for all services
- **JWT** – Authentication
- **Other:** Multer (file upload), Axios, dotenv, etc.

---

## 🧩 **Microservices Overview**

### 1. **Authentication Service**
- User registration, login, JWT-based authentication
- Password hashing (bcrypt)
- User session management with Redis

### 2. **Resume Processing Service**
- Upload and parse resumes (PDF)
- Extract structured data using LLMs (Gemini/Cohere)
- Generate embeddings for semantic search
- Store resumes in MongoDB and Cloudinary

### 3. **Job Matching & Ranking Service**
- CRUD for job postings
- Extract job details using LLMs
- Generate job embeddings
- Match jobs to resumes using vector similarity (cosine similarity)
- Rank and cache top matches in Redis

### 4. **Communication & Interview Scheduling Service**
- Schedule and manage interviews
- Search/filter interviews
- Cache interview data in Redis
- Real-time communication (socket.io, if used)

### 5. **Proxy Server**
- API gateway for routing requests to appropriate services
- Centralized entry point for frontend or external APIs

---

## ⚙️ **Setup & Run (Development)**

### **1. Clone the Repository**
```sh
git clone https://github.com/<your-username>/AI-Powered-Resume-Screening-System.git
cd AI-Powered-Resume-Screening-System
```

### **2. Environment Variables**
- Copy `.env.example` (if present) in each service to `.env` and fill in your secrets (MongoDB, Redis, Cloudinary, Cohere, Gemini, etc.)

### **3. Install Dependencies**
For each service:
```sh
cd authentication-service
npm install
cd ../resume-processing-service
npm install
cd ../jobmatching-and-ranking-service
npm install
cd ../communication-and-interview-scheduling-service
npm install
cd ../proxy-server
npm install
```

### **4. Start Services (Locally)**
You can run each service individually:
```sh
cd authentication-service && npm run dev
# Repeat for each service
```
Or use Docker Compose:
```sh
docker-compose up --build
```

---

## 📝 **API Overview**

Each service exposes its own REST API.  
**Examples:**

- **Authentication:** `/user/register`, `/user/login`, `/user/get-current-user`
- **Resume Processing:** `/resume/analyze-resume`, `/resume/get-resume-by-id`
- **Job Matching:** `/jobs/create-job`, `/job-matching/top-job-matches`
- **Interview Scheduling:** `/interviews/schedule-interview`, `/interviews/get-all-interviews`

See each service's `routes/` folder for full API details.

---

## 🧠 **AI & Embedding Flow**

1. **Resume Upload:**  
   User uploads PDF → Resume Processing Service extracts text → LLM parses structured info → Embeddings generated → Data stored.

2. **Job Posting:**  
   Recruiter posts job → Job Matching Service extracts info via LLM → Embeddings generated → Data stored.

3. **Matching:**  
   Resume and job embeddings compared (cosine similarity) → Top matches ranked and cached.

4. **Interview Scheduling:**  
   Candidate applies → Recruiter schedules interview → Communication managed via service.

---

## 🛡️ **Security**

- JWT authentication for all protected routes
- Passwords hashed with bcrypt
- Sensitive data stored in `.env` files (never commit secrets!)

---

## 🗂️ **.gitignore Example**

```
node_modules/
.env
.env.*
logs/
uploads/
public/resumes/
dist/
build/
coverage/
.vscode/
.idea/
*.log
```

---

## 📝 **Contributing**

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 **License**

This project is licensed under the MIT License.

---

## 🙋‍♂️ **Contact**

For questions, open an issue or contact [your-email@example.com](mailto:your-email@example.com).

---