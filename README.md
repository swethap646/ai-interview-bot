# HireReady AI

An AI-powered interview practice platform with a live camera session, question navigation, and answer recording.

## 📁 Project Structure

```
ai-interview-bot/
├── frontend/   ← Angular 21 app (UI)
└── backend/    ← Node.js/Express API (🚧 in progress)
```

## 🚀 Running Frontend

```bash
cd frontend
npm install      # only needed once (or after cloning fresh)
npm start        # runs at http://localhost:4200
```

## 🔧 Running Backend (when ready)

```bash
cd backend
npm install
cp .env.example .env    # fill in API keys
npm run dev             # runs at http://localhost:3000
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Angular 21, TypeScript |
| Backend | Node.js, Express |
| AI | Groq (Llama 3.3-70b) |
| Storage | Local → MongoDB Atlas |
