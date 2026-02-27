# Backend Architecture & Overview

## 📊 Project Structure

```
backend/
│
├── config/
│   └── db.js                           # MongoDB connection setup
│
├── models/                              # Mongoose schemas (7 collections)
│   ├── Class.js                        # Class model
│   ├── Group.js                        # Group model (ties to Class)
│   ├── Subject.js                      # Subject model (ties to Group)
│   ├── Chapter.js                      # Chapter model (ties to Subject)
│   ├── Topic.js                        # Topic model (ties to Chapter)
│   ├── Question.js                     # Question model (supports Bengali + English)
│   └── Exam.js                         # Exam model (contains Questions)
│
├── controllers/                         # Business logic (7 resource types)
│   ├── classController.js              # Get, Create, Update, Delete Classes
│   ├── groupController.js              # Group CRUD + filtering
│   ├── subjectController.js            # Subject CRUD + filtering
│   ├── chapterController.js            # Chapter CRUD + filtering
│   ├── topicController.js              # Topic CRUD + filtering
│   ├── questionController.js           # Question CRUD + Bulk import + Search
│   └── examController.js               # Exam CRUD + Publish/Unpublish
│
├── routes/                              # API endpoints (7 route files)
│   ├── classRoutes.js
│   ├── groupRoutes.js
│   ├── subjectRoutes.js
│   ├── chapterRoutes.js
│   ├── topicRoutes.js
│   ├── questionRoutes.js               # Special: includes /bulk endpoint
│   └── examRoutes.js                   # Special: includes /publish, /unpublish
│
├── middleware/
│   └── auth.js                          # JWT authentication (optional, ready to use)
│
├── utils/
│   └── helpers.js                       # Utility functions
│
├── server.js                            # Main Express app
├── package.json                         # Dependencies
├── .env.example                         # Environment template
├── .gitignore                           # Git ignore rules
├── README.md                            # Full documentation
├── SETUP_GUIDE.md                       # Quick setup instructions
├── SAMPLE_API_REQUESTS.md              # API request examples
├── postman_collection.json             # Postman import file
└── ARCHITECTURE.md                      # This file
```

## 🗂️ Data Hierarchy

```
CLASS (SSC, HSC, etc.)
  ├── GROUP (Science, Arts, Commerce)
  │   ├── SUBJECT (Physics, Chemistry, Biology)
  │   │   ├── CHAPTER (Motion, Atomic Structure)
  │   │   │   ├── TOPIC (Velocity, Electron Configuration)
  │   │   │   │   ├── QUESTION (MCQ, True/False, etc.)
  │   │   │   │   └── QUESTION
  │   │   │   └── TOPIC
  │   │   └── CHAPTER
  │   └── SUBJECT
  └── GROUP

EXAM (contains multiple QUESTIONS)
  ├── QUESTION 1
  ├── QUESTION 2
  └── QUESTION N
```

## 🔗 Database Relations

All collections use MongoDB ObjectIds for relationships:

```
Question
├── subjectId → Subject._id
├── chapterId → Chapter._id
└── topicId → Topic._id

Topic
└── chapterId → Chapter._id

Chapter
└── subjectId → Subject._id

Subject
└── groupId → Group._id

Group
└── classId → Class._id

Exam
└── questionIds → [Question._id]
```

## 💹 API Flow

### Create a Question (Complete Flow)

```
1. POST /api/questions
   ├── Extract data from request body
   ├── Validate required fields
   ├── Create question in Question collection
   ├── Populate references (Subject, Chapter, Topic)
   └── Return created question with relations
```

### Bulk Import Questions

```
1. POST /api/questions/bulk
   ├── Extract questions array from request
   ├── Validate each question
   ├── Insert all valid questions
   ├── Populate all references
   └── Return count and list of imported questions
```

### Publish Exam

```
1. PATCH /api/exams/:id/publish
   ├── Verify exam exists
   ├── Check if exam has questions
   ├── Update status to "live"
   ├── Set publishedAt timestamp
   ├── Populate question details
   └── Return updated exam
```

## 📋 Response Format

All API responses follow consistent JSON structure:

### Success Response
```json
{
  "success": true,
  "count": 10,
  "message": "Optional success message",
  "data": { }
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
- `200`: OK (GET, PUT, PATCH)
- `201`: Created (POST)
- `400`: Bad Request
- `404`: Not Found
- `500`: Server Error

## 🔍 Query Filtering

### Get Questions with Filters

```
GET /api/questions
  ?subjectId=60d5ec...     # Filter by subject
  &chapterId=60d5ec...     # Filter by chapter
  &topicId=60d5ec...       # Filter by topic
  &difficulty=medium       # Filter by difficulty
  &search=velocity         # Search in question text (case-insensitive)
```

### Get Specific Hierarchies

```
GET /api/groups?classId=60d5ec...
GET /api/subjects?groupId=60d5ec...
GET /api/chapters?subjectId=60d5ec...
GET /api/topics?chapterId=60d5ec...
```

## 🔒 Security Features

### Current Implementation
- CORS enabled for frontend
- Input validation on all endpoints
- Duplicate key error handling
- ObjectId validation ready

### Ready for JWT Authentication
- Middleware file prepared: `middleware/auth.js`
- Can be enabled with JWT_SECRET in .env
- All routes can use `auth` middleware

### Future Security Enhancements
- Rate limiting (express-rate-limit)
- Request validation (express-validator)
- Helmet.js for HTTP headers
- Input sanitization
- SQL injection prevention (uses NoSQL)

## 📈 Scalability Features

### Current Strengths
- MongoDB (horizontal scalability)
- Lean model design
- No N+1 query problems (population in one step)
- Bulk operations support

### Ready for Enhancement
- Pagination support (query parsing ready)
- Caching layer (Redis ready)
- Database indexing (can add to models)
- Load balancing (stateless Express)
- CDN for static files
- Horizontal scaling ready

## 🚀 Performance Considerations

### Database Indexes
```mongodb
// Add to Class.js schema for production
classSchema.index({ name: 1 });

// Add to Question.js for search
questionSchema.index({ questionTextEn: 'text', questionTextBn: 'text' });
```

### Potential Optimizations
1. Population strategy - minimize unnecessary relations
2. Pagination for large datasets
3. Caching frequently accessed data
4. Database compression
5. Query optimization

## 🔄 Data Migration (localStorage → MongoDB)

### Frontend Export Format
```json
{
  "questions": [...],
  "exams": [...]
}
```

### Migration Steps
1. Export data from localStorage
2. Create Classes, Groups, Subjects, Chapters, Topics hierarchy
3. Use POST /api/questions/bulk to import questions
4. Use POST /api/exams to import exams
5. Update question/exam references in exams

### Migration Helper (Frontend)
```javascript
// Export from localStorage
const questions = JSON.parse(localStorage.getItem('createdQuestions'));
const exams = JSON.parse(localStorage.getItem('createdExams'));

// Build hierarchy and import
async function migrateData() {
  // 1. Create academic structure
  const classRes = await fetch('/api/classes', {
    method: 'POST',
    body: JSON.stringify({ name: 'SSC' })
  });
  const classData = await classRes.json();
  
  // 2. Bulk import questions
  const qRes = await fetch('/api/questions/bulk', {
    method: 'POST',
    body: JSON.stringify({ questions })
  });
  
  // 3. Create and populate exams
  // ...
}
```

## 📱 Frontend Integration

### Environment Setup
```typescript
// .env files for frontend
VITE_API_URL=http://localhost:5000/api  // Development
VITE_API_URL=https://api.yourdomain.com // Production
```

### API Service Class
```typescript
// services/api.ts
class API {
  private baseURL = import.meta.env.VITE_API_URL;
  
  async request(endpoint: string, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return response.json();
  }
  
  // CRUD Methods
  questions = {
    list: () => this.request('/questions'),
    create: (data) => this.request('/questions', { method: 'POST', body: JSON.stringify(data) }),
    bulkImport: (questions) => this.request('/questions/bulk', { method: 'POST', body: JSON.stringify({ questions }) }),
    search: (query) => this.request(`/questions?search=${query}`)
  };
}
```

## 📊 Admin Panel Integration Points

### Sections Page → Academic Structure
```
Sections
├── Classes → GET /api/classes
├── Groups → GET /api/groups?classId=
├── Subjects → GET /api/subjects?groupId=
├── Chapters → GET /api/chapters?subjectId=
└── Topics → GET /api/topics?chapterId=
```

### Questions Page → Question Management
```
Questions
├── List → GET /api/questions
├── Create → POST /api/questions
├── Bulk Import → POST /api/questions/bulk
├── Search/Filter → GET /api/questions?...
├── Update → PUT /api/questions/:id
└── Delete → DELETE /api/questions/:id
```

### Exam Builder Page → Exam Management
```
Exams
├── Create → POST /api/exams
├── Add Questions → PUT /api/exams/:id
├── Preview → GET /api/exams/:id
├── Publish → PATCH /api/exams/:id/publish
└── Unpublish → PATCH /api/exams/:id/unpublish
```

### Analytics Page (Future)
```
Analytics (Ready to extend)
├── Total Questions → GET /api/questions (count)
├── Questions by Subject → GET /api/questions?subjectId=
├── Exams Published → GET /api/exams?status=live
└── Custom Queries → Use existing endpoints
```

## 🔧 Development Workflow

### Local Development
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend (existing)
cd frontend
npm run dev

# Both running at:
# Backend: http://localhost:5000
# Frontend: http://localhost:5173
```

### Testing Flow
1. Create hierarchy (Class → Group → Subject → Chapter → Topic)
2. Create questions
3. Create exam
4. Add questions to exam
5. Publish exam
6. Test filters/search

## 🐛 Common Issues & Solutions

### MongoDB Connection
```
Issue: Cannot connect to MongoDB
Solution: 
- Verify MongoDB is running
- Check connection string in .env
- For Atlas: Whitelist IP address
```

### CORS Errors
```
Issue: Frontend cannot reach backend
Solution:
- Verify CORS_ORIGIN in .env matches frontend URL
- Check server is running on correct port
```

### Duplicate Key Error
```
Issue: "Duplicate key error" on create
Solution:
- Database may have old data
- Clear collection and retry
- Or use different name
```

## 📚 Related Documentation

- **README.md** - Complete API documentation
- **SETUP_GUIDE.md** - Quick start guide
- **SAMPLE_API_REQUESTS.md** - Request/response examples
- **postman_collection.json** - Postman for API testing

## 🎯 Next Steps

1. ✅ Backend infrastructure ready
2. → Update frontend to use API endpoints
3. → Add JWT authentication
4. → Implement pagination
5. → Add analytics
6. → Deploy to production
7. → Setup student portal
8. → Implement exam attempts system

---

**Status:** ✅ Production-Ready Architecture
**Last Updated:** February 20, 2024
