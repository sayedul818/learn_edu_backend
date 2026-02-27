# LearnSmart Prep - Backend API

Production-ready Node.js + Express + MongoDB backend for EdTech Admin Panel.

## 📋 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Validation**: express-validator
- **Environment**: dotenv
- **CORS**: Enabled for frontend integration

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Setup environment variables**
```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your MongoDB URI
# Default: mongodb://localhost:27017/learnsmart-prep
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/learnsmart-prep
```

3. **Start the server**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will run on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── config/
│   └── db.js                 # MongoDB connection
├── models/
│   ├── Class.js             # Class model
│   ├── Group.js             # Group model
│   ├── Subject.js           # Subject model
│   ├── Chapter.js           # Chapter model
│   ├── Topic.js             # Topic model
│   ├── Question.js          # Question model
│   └── Exam.js              # Exam model
├── controllers/
│   ├── classController.js    # Class logic
│   ├── groupController.js    # Group logic
│   ├── subjectController.js  # Subject logic
│   ├── chapterController.js  # Chapter logic
│   ├── topicController.js    # Topic logic
│   ├── questionController.js # Question logic
│   └── examController.js     # Exam logic
├── routes/
│   ├── classRoutes.js
│   ├── groupRoutes.js
│   ├── subjectRoutes.js
│   ├── chapterRoutes.js
│   ├── topicRoutes.js
│   ├── questionRoutes.js
│   └── examRoutes.js
├── server.js                # Express server setup
├── .env.example             # Environment template
├── package.json
└── README.md
```

## 🎓 Database Schema

### Hierarchy
```
Class → Group → Subject → Chapter → Topic
```

### Collections

#### Class
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Group
```javascript
{
  _id: ObjectId,
  name: String,
  classId: ObjectId (ref: Class),
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Subject
```javascript
{
  _id: ObjectId,
  name: String,
  groupId: ObjectId (ref: Group),
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Chapter
```javascript
{
  _id: ObjectId,
  name: String,
  subjectId: ObjectId (ref: Subject),
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Topic
```javascript
{
  _id: ObjectId,
  name: String,
  chapterId: ObjectId (ref: Chapter),
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Question
```javascript
{
  _id: ObjectId,
  questionTextEn: String,
  questionTextBn: String,
  options: [
    {
      text: String,
      isCorrect: Boolean
    }
  ],
  explanation: String,
  subjectId: ObjectId (ref: Subject),
  chapterId: ObjectId (ref: Chapter),
  topicId: ObjectId (ref: Topic),
  difficulty: String (easy|medium|hard),
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

#### Exam
```javascript
{
  _id: ObjectId,
  title: String,
  duration: Number (minutes),
  totalMarks: Number,
  questionIds: [ObjectId] (ref: Question),
  status: String (draft|live),
  description: String,
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 📡 API Endpoints

### Classes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | Get all classes |
| GET | `/api/classes/:id` | Get single class |
| POST | `/api/classes` | Create class |
| PUT | `/api/classes/:id` | Update class |
| DELETE | `/api/classes/:id` | Delete class |

#### Create Class
```bash
POST /api/classes
Content-Type: application/json

{
  "name": "SSC",
  "description": "Secondary School Certificate"
}
```

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get all groups |
| GET | `/api/groups/:id` | Get single group |
| GET | `/api/groups?classId=...` | Get groups by class |
| POST | `/api/groups` | Create group |
| PUT | `/api/groups/:id` | Update group |
| DELETE | `/api/groups/:id` | Delete group |

#### Create Group
```bash
POST /api/groups
Content-Type: application/json

{
  "name": "Science",
  "classId": "60d5ec49c1234567890abcde",
  "description": "Science group"
}
```

### Subjects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subjects` | Get all subjects |
| GET | `/api/subjects/:id` | Get single subject |
| GET | `/api/subjects?groupId=...` | Get subjects by group |
| POST | `/api/subjects` | Create subject |
| PUT | `/api/subjects/:id` | Update subject |
| DELETE | `/api/subjects/:id` | Delete subject |

#### Create Subject
```bash
POST /api/subjects
Content-Type: application/json

{
  "name": "Physics",
  "groupId": "60d5ec49c1234567890abcde",
  "description": "Physics subject"
}
```

### Chapters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chapters` | Get all chapters |
| GET | `/api/chapters/:id` | Get single chapter |
| GET | `/api/chapters?subjectId=...` | Get chapters by subject |
| POST | `/api/chapters` | Create chapter |
| PUT | `/api/chapters/:id` | Update chapter |
| DELETE | `/api/chapters/:id` | Delete chapter |

#### Create Chapter
```bash
POST /api/chapters
Content-Type: application/json

{
  "name": "Motion",
  "subjectId": "60d5ec49c1234567890abcde",
  "description": "Motion and forces"
}
```

### Topics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/topics` | Get all topics |
| GET | `/api/topics/:id` | Get single topic |
| GET | `/api/topics?chapterId=...` | Get topics by chapter |
| POST | `/api/topics` | Create topic |
| PUT | `/api/topics/:id` | Update topic |
| DELETE | `/api/topics/:id` | Delete topic |

#### Create Topic
```bash
POST /api/topics
Content-Type: application/json

{
  "name": "Velocity",
  "chapterId": "60d5ec49c1234567890abcde",
  "description": "Understanding velocity"
}
```

### Questions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | Get all questions |
| GET | `/api/questions/:id` | Get single question |
| GET | `/api/questions?...` | Get with filters |
| POST | `/api/questions` | Create single question |
| POST | `/api/questions/bulk` | Bulk import questions |
| PUT | `/api/questions/:id` | Update question |
| DELETE | `/api/questions/:id` | Delete question |

#### Create Question
```bash
POST /api/questions
Content-Type: application/json

{
  "questionTextEn": "What is velocity?",
  "questionTextBn": "বেগ কী?",
  "options": [
    { "text": "Speed with direction", "isCorrect": true },
    { "text": "Speed", "isCorrect": false },
    { "text": "Acceleration", "isCorrect": false },
    { "text": "Force", "isCorrect": false }
  ],
  "explanation": "Velocity is the rate of change of displacement with time, including direction.",
  "subjectId": "60d5ec49c1234567890abcde",
  "chapterId": "60d5ec49c1234567890abcde",
  "topicId": "60d5ec49c1234567890abcde",
  "difficulty": "medium",
  "tags": ["mcq", "physics", "velocity"]
}
```

#### Bulk Import Questions
```bash
POST /api/questions/bulk
Content-Type: application/json

{
  "questions": [
    {
      "questionTextEn": "Question 1",
      "options": [...],
      "subjectId": "...",
      "chapterId": "...",
      "topicId": "..."
    },
    {
      "questionTextEn": "Question 2",
      "options": [...],
      "subjectId": "...",
      "chapterId": "...",
      "topicId": "..."
    }
  ]
}
```

#### Get Questions with Filters
```bash
GET /api/questions?subjectId=60d5ec49c1234567890abcde&difficulty=medium&search=velocity
```

Query parameters:
- `subjectId`: Filter by subject
- `chapterId`: Filter by chapter
- `topicId`: Filter by topic
- `difficulty`: Filter by difficulty (easy|medium|hard)
- `search`: Search in question text (case-insensitive)

### Exams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exams` | Get all exams |
| GET | `/api/exams/:id` | Get single exam |
| POST | `/api/exams` | Create exam |
| PUT | `/api/exams/:id` | Update exam |
| PATCH | `/api/exams/:id/publish` | Publish exam |
| PATCH | `/api/exams/:id/unpublish` | Unpublish exam |
| DELETE | `/api/exams/:id` | Delete exam |

#### Create Exam
```bash
POST /api/exams
Content-Type: application/json

{
  "title": "Physics Mid-Term",
  "duration": 120,
  "totalMarks": 100,
  "questionIds": [
    "60d5ec49c1234567890abcde",
    "60d5ec49c1234567890abcdf"
  ],
  "description": "Mid-term exam for Physics"
}
```

#### Publish Exam
```bash
PATCH /api/exams/60d5ec49c1234567890abcde/publish
```

#### Unpublish Exam
```bash
PATCH /api/exams/60d5ec49c1234567890abcde/unpublish
```

## 📝 Sample Request/Response

### Create Class Request
```bash
curl -X POST http://localhost:5000/api/classes \
  -H "Content-Type: application/json" \
  -d '{"name":"SSC","description":"Secondary School Certificate"}'
```

### Create Class Response
```json
{
  "success": true,
  "data": {
    "_id": "60d5ec49c1234567890abcde",
    "name": "SSC",
    "description": "Secondary School Certificate",
    "createdAt": "2024-02-20T10:30:00Z",
    "updatedAt": "2024-02-20T10:30:00Z",
    "__v": 0
  }
}
```

## 🔒 Security Features (Ready for JWT)

The project structure is prepared for JWT authentication:

```javascript
// Future: Add middleware
const auth = require('./middleware/auth');

// Use in routes
router.post('/', auth, createClass);
```

To add JWT authentication:

1. Install jsonwebtoken:
```bash
npm install jsonwebtoken
```

2. Create `middleware/auth.js`:
```javascript
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

module.exports = auth;
```

## 📊 Error Handling

All endpoints follow consistent error handling:

```json
{
  "success": false,
  "error": "Error message"
}
```

Status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request
- `404`: Not found
- `500`: Server error

## 🧪 Testing

Use Postman, curl, or any HTTP client to test endpoints.

Sample Postman collection structure:
```
LearnSmart API
├── Classes
│   ├── GET All Classes
│   ├── POST Create Class
│   └── ...
├── Groups
├── Subjects
├── Chapters
├── Topics
├── Questions
└── Exams
```

## 🔄 Migration from localStorage

To migrate from frontend localStorage:

1. **Export data from localStorage**:
```javascript
const questions = JSON.parse(localStorage.getItem('createdQuestions'));
const exams = JSON.parse(localStorage.getItem('createdExams'));
```

2. **Import via bulk endpoint**:
```bash
POST /api/questions/bulk
```

3. **Update frontend API calls** from localStorage to backend URLs

## 📈 Scalability Features

✅ Prepared for:
- JWT Authentication
- Role-based access control
- Admin/Teacher/Student roles
- Student exam attempts
- Analytics tracking
- Pagination
- Advanced filtering
- Caching

## 🚀 Deployment

### Environment Setup
```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/learnsmart-prep
PORT=5000
CORS_ORIGIN=https://yourdomain.com
```

### Deploy to Cloud
- **Heroku**: `npm start` will be called
- **AWS/Azure**: Deploy as Node.js app
- **DigitalOcean**: Use PM2 process manager

## 📚 Future Enhancements

- [ ] JWT Authentication
- [ ] Role-based authorization
- [ ] Student exam attempts
- [ ] Leaderboard system
- [ ] Analytics dashboard
- [ ] File upload (images/PDFs)
- [ ] Pagination
- [ ] Rate limiting
- [ ] Logging system
- [ ] Email notifications
- [ ] Caching layer (Redis)

## 📄 License

MIT

## 🤝 Support

For issues and questions, check the project documentation.

---

**Status**: ✅ Production-Ready Backend
**Last Updated**: February 20, 2024
