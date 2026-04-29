# AI Interview Bot — Backend

Node.js + Express API server for the AI Interview Bot.

## Prerequisites

- Node.js v18+
- npm

## Setup

```bash
cd backend
npm install
cp .env.example .env       # then fill in your API keys
npm run dev                # starts with nodemon (auto-reload)
```

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/questions?topic=general` | Get interview questions by topic |
| POST | `/api/upload` | Upload a recorded interview (multipart/form-data) |
| POST | `/api/evaluate` | Evaluate an interview answer (JSON body) |

## Project Structure

```
backend/
├── src/
│   ├── server.js           ← Entry point
│   ├── routes/
│   │   ├── questions.js    ← GET /api/questions
│   │   ├── upload.js       ← POST /api/upload
│   │   └── evaluate.js     ← POST /api/evaluate
│   └── services/
│       ├── aiService.js    ← LLM integration (Gemini / OpenAI)
│       └── storageService.js ← File storage
├── .env.example
└── package.json
```

## Status

🚧 **Backend not yet started** — all routes return placeholder responses.
Frontend (Angular) is in `../frontend/` and runs independently.
