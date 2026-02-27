# 🎓 Backend API Cheat Sheet

Quick reference guide for all endpoints and common operations.

## 🚀 Start Backend

```bash
cd backend
npm install      # First time only
npm run dev      # Start with auto-reload
```

**Expected Output:**
```
✓ MongoDB Connected: localhost
✓ Server running on port 5000
✓ Environment: development
```

---

## 📋 All Endpoints Reference

### Classes
```
GET    /api/classes              # List all
GET    /api/classes/:id          # Get one
POST   /api/classes              # Create
PUT    /api/classes/:id          # Update
DELETE /api/classes/:id          # Delete
```

### Groups
```
GET    /api/groups               # List all
GET    /api/groups?classId=...   # Filter by class
GET    /api/groups/:id           # Get one
POST   /api/groups               # Create
PUT    /api/groups/:id           # Update
DELETE /api/groups/:id           # Delete
```

### Subjects
```
GET    /api/subjects             # List all
GET    /api/subjects?groupId=... # Filter by group
GET    /api/subjects/:id         # Get one
POST   /api/subjects             # Create
PUT    /api/subjects/:id         # Update
DELETE /api/subjects/:id         # Delete
```

### Chapters
```
GET    /api/chapters             # List all
GET    /api/chapters?subjectId=..# Filter by subject
GET    /api/chapters/:id         # Get one
POST   /api/chapters             # Create
PUT    /api/chapters/:id         # Update
DELETE /api/chapters/:id         # Delete
```

### Topics
```
GET    /api/topics               # List all
GET    /api/topics?chapterId=... # Filter by chapter
GET    /api/topics/:id           # Get one
POST   /api/topics               # Create
PUT    /api/topics/:id           # Update
DELETE /api/topics/:id           # Delete
```

### Questions ⭐
```
GET    /api/questions            # List all
GET    /api/questions/:id        # Get one
GET    /api/questions?...        # Advanced filters
POST   /api/questions            # Create single
POST   /api/questions/bulk       # Bulk import ⭐
PUT    /api/questions/:id        # Update
DELETE /api/questions/:id        # Delete
```

### Exams ⭐
```
GET    /api/exams                # List all
GET    /api/exams/:id            # Get one
POST   /api/exams                # Create
PUT    /api/exams/:id            # Update
PATCH  /api/exams/:id/publish    # Go live ⭐
PATCH  /api/exams/:id/unpublish  # Take down ⭐
DELETE /api/exams/:id            # Delete
```

---

## 📝 Request Bodies

### Create Class
```json
{
  "name": "SSC",
  "description": "Secondary School Certificate"
}
```

### Create Group
```json
{
  "name": "Science",
  "classId": "60d5ec49c1234567890abcde",
  "description": "Science group"
}
```

### Create Subject
```json
{
  "name": "Physics",
  "groupId": "60d5ec49c1234567890abcde",
  "description": "Physics subject"
}
```

### Create Chapter
```json
{
  "name": "Motion",
  "subjectId": "60d5ec49c1234567890abcde",
  "description": "Chapter on motion"
}
```

### Create Topic
```json
{
  "name": "Velocity",
  "chapterId": "60d5ec49c1234567890abcde",
  "description": "Understanding velocity"
}
```

### Create Single Question
```json
{
  "questionTextEn": "What is velocity?",
  "questionTextBn": "বেগ কী?",
  "options": [
    { "text": "Speed with direction", "isCorrect": true },
    { "text": "Speed without direction", "isCorrect": false },
    { "text": "Acceleration", "isCorrect": false },
    { "text": "Force", "isCorrect": false }
  ],
  "explanation": "Velocity is speed with direction",
  "subjectId": "60d5ec49c1234567890abcde",
  "chapterId": "60d5ec49c1234567890abcde",
  "topicId": "60d5ec49c1234567890abcde",
  "difficulty": "medium",
  "tags": ["mcq", "physics"]
}
```

### Create Exam
```json
{
  "title": "Physics Mid-Term",
  "duration": 120,
  "totalMarks": 100,
  "questionIds": [
    "60d5ec49c1234567890abcde",
    "60d5ec49c1234567890abcdf"
  ],
  "description": "Mid-term exam",
  "status": "draft"
}
```

### Bulk Import Questions
```json
{
  "questions": [
    {
      "questionTextEn": "Question 1?",
      "options": [
        { "text": "A", "isCorrect": true },
        { "text": "B", "isCorrect": false }
      ],
      "subjectId": "...",
      "chapterId": "...",
      "topicId": "..."
    },
    {
      "questionTextEn": "Question 2?",
      "options": [
        { "text": "A", "isCorrect": false },
        { "text": "B", "isCorrect": true }
      ],
      "subjectId": "...",
      "chapterId": "...",
      "topicId": "..."
    }
  ]
}
```

---

## 🔍 Query Parameters

### Question Filters
```bash
# By subject
/api/questions?subjectId=60d5ec49c1234567890abcde

# By chapter
/api/questions?chapterId=60d5ec49c1234567890abcde

# By topic
/api/questions?topicId=60d5ec49c1234567890abcde

# By difficulty
/api/questions?difficulty=easy
/api/questions?difficulty=medium
/api/questions?difficulty=hard

# Search
/api/questions?search=velocity

# Combined
/api/questions?subjectId=...&difficulty=easy&search=motion
```

### Hierarchy Filters
```bash
# Get groups in a class
/api/groups?classId=60d5ec49c1234567890abcde

# Get subjects in a group
/api/subjects?groupId=60d5ec49c1234567890abcde

# Get chapters in a subject
/api/chapters?subjectId=60d5ec49c1234567890abcde

# Get topics in a chapter
/api/topics?chapterId=60d5ec49c1234567890abcde
```

---

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "count": 5,
  "message": "Success message",
  "data": [...]
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Status Codes
```
200 - OK (GET, PUT, PATCH)
201 - Created (POST) ✅
400 - Bad Request ❌
404 - Not Found ❌
500 - Server Error ❌
```

---

## 🧪 Common cURL Examples

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Create Class
```bash
curl -X POST http://localhost:5000/api/classes \
  -H "Content-Type: application/json" \
  -d '{"name":"SSC"}'
```

### Get All Classes
```bash
curl http://localhost:5000/api/classes
```

### Get Questions with Filter
```bash
curl "http://localhost:5000/api/questions?difficulty=easy&search=motion"
```

### Create Question
```bash
curl -X POST http://localhost:5000/api/questions \
  -H "Content-Type: application/json" \
  -d '{
    "questionTextEn":"What is velocity?",
    "options":[{"text":"Speed","isCorrect":true},{"text":"Acceleration","isCorrect":false}],
    "subjectId":"ID1",
    "chapterId":"ID2",
    "topicId":"ID3"
  }'
```

### Bulk Import Questions
```bash
curl -X POST http://localhost:5000/api/questions/bulk \
  -H "Content-Type: application/json" \
  -d '{"questions":[...]}'
```

### Publish Exam
```bash
curl -X PATCH http://localhost:5000/api/exams/EXAM_ID/publish
```

---

## 🔐 Optional: Enable JWT

### 1. Add to .env
```
JWT_SECRET=your-super-secret-key-here
```

### 2. Use Auth Middleware (in routes)
```javascript
const auth = require('./middleware/auth');
router.post('/', auth, createController);
```

### 3. Send Token from Frontend
```javascript
fetch('/api/classes', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
})
```

---

## 🗂️ File Structure

```
backend/
├── models/              # 7 MongoDB Schemas
│   ├── Class.js
│   ├── Group.js
│   ├── Subject.js
│   ├── Chapter.js
│   ├── Topic.js
│   ├── Question.js
│   └── Exam.js
├── controllers/         # 7 Business Logic Files
│   ├── classController.js
│   ├── groupController.js
│   ├── subjectController.js
│   ├── chapterController.js
│   ├── topicController.js
│   ├── questionController.js
│   └── examController.js
├── routes/             # 7 Route Definition Files
│   ├── classRoutes.js
│   ├── groupRoutes.js
│   ├── subjectRoutes.js
│   ├── chapterRoutes.js
│   ├── topicRoutes.js
│   ├── questionRoutes.js
│   └── examRoutes.js
├── config/
│   └── db.js           # MongoDB Connection
├── middleware/
│   └── auth.js         # JWT (Optional)
├── utils/
│   └── helpers.js      # Utility Functions
├── server.js           # Express App
└── .env               # Environment Variables
```

---

## 📱 Frontend Integration

Replace localStorage with API calls:

```typescript
// API Service
const API = 'http://localhost:5000/api';

export const getQuestions = () => 
  fetch(`${API}/questions`).then(r => r.json());

export const createQuestion = (question) => 
  fetch(`${API}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question)
  }).then(r => r.json());

export const getExams = () => 
  fetch(`${API}/exams`).then(r => r.json());

export const publishExam = (id) => 
  fetch(`${API}/exams/${id}/publish`, {
    method: 'PATCH'
  }).then(r => r.json());
```

---

## ⚡ Performance Tips

1. **Use Postman** for API testing
2. **Index frequently searched fields** for speed
3. **Use pagination** for large datasets
4. **Cache responses** with Redis
5. **Monitor MongoDB** for slow queries

---

## 🆘 Quick Fixes

### MongoDB won't connect?
```bash
# Start MongoDB
mongod
```

### CORS error?
- Check `CORS_ORIGIN` in `.env`
- Should match frontend URL (e.g., `http://localhost:5173`)

### Port 5000 in use?
- Change `PORT` in `.env` to `5001`

### npm modules missing?
```bash
npm install
```

---

## 📚 Full Documentation

| File | Contains |
|------|----------|
| `README.md` | Complete API docs |
| `SETUP_GUIDE.md` | Installation steps |
| `ARCHITECTURE.md` | System design |
| `SAMPLE_API_REQUESTS.md` | More examples |
| `QUICK_START.md` | Getting started |

---

## ✅ Checklist

- [ ] Backend running (`npm run dev`)
- [ ] MongoDB connected
- [ ] API health check passing
- [ ] Sample data created
- [ ] Postman imported
- [ ] Frontend updated with API calls
- [ ] CORS configured
- [ ] Testing successful

---

**Build Date:** February 20, 2024
**Status:** ✅ Production Ready
**Version:** 1.0.0
