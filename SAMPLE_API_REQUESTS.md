/**
 * Sample Data for Testing the Backend API
 * Copy and paste these requests in Postman to populate the database
 */

// ============= CLASSES =============

POST /api/classes
{
  "name": "SSC",
  "description": "Secondary School Certificate"
}

POST /api/classes
{
  "name": "HSC",
  "description": "Higher Secondary Certificate"
}

// ============= GROUPS =============
// First, copy the class IDs from the response above

POST /api/groups
{
  "name": "Science",
  "classId": "REPLACE_WITH_SSC_CLASS_ID",
  "description": "Science group for SSC"
}

POST /api/groups
{
  "name": "Arts",
  "classId": "REPLACE_WITH_SSC_CLASS_ID",
  "description": "Arts group for SSC"
}

// ============= SUBJECTS =============

POST /api/subjects
{
  "name": "Physics",
  "groupId": "REPLACE_WITH_SCIENCE_GROUP_ID",
  "description": "Physics subject"
}

POST /api/subjects
{
  "name": "Chemistry",
  "groupId": "REPLACE_WITH_SCIENCE_GROUP_ID",
  "description": "Chemistry subject"
}

POST /api/subjects
{
  "name": "Bengali",
  "groupId": "REPLACE_WITH_ARTS_GROUP_ID",
  "description": "Bengali subject"
}

// ============= CHAPTERS =============

POST /api/chapters
{
  "name": "Motion",
  "subjectId": "REPLACE_WITH_PHYSICS_SUBJECT_ID",
  "description": "Chapter on motion and forces"
}

POST /api/chapters
{
  "name": "Atomic Structure",
  "subjectId": "REPLACE_WITH_CHEMISTRY_SUBJECT_ID",
  "description": "Understanding atoms and electrons"
}

// ============= TOPICS =============

POST /api/topics
{
  "name": "Velocity and Acceleration",
  "chapterId": "REPLACE_WITH_MOTION_CHAPTER_ID",
  "description": "Concepts of velocity and acceleration"
}

POST /api/topics
{
  "name": "Newton's Laws",
  "chapterId": "REPLACE_WITH_MOTION_CHAPTER_ID",
  "description": "Three laws of motion"
}

POST /api/topics
{
  "name": "Electron Configuration",
  "chapterId": "REPLACE_WITH_ATOMIC_STRUCTURE_CHAPTER_ID",
  "description": "Arrangement of electrons in orbitals"
}

// ============= QUESTIONS =============

POST /api/questions
{
  "questionTextEn": "What is velocity?",
  "questionTextBn": "বেগ কী?",
  "options": [
    { "text": "Speed with direction", "isCorrect": true },
    { "text": "Speed without direction", "isCorrect": false },
    { "text": "Acceleration", "isCorrect": false },
    { "text": "Force", "isCorrect": false }
  ],
  "explanation": "Velocity is the rate of change of displacement with time, including direction. It is a vector quantity.",
  "subjectId": "REPLACE_WITH_PHYSICS_SUBJECT_ID",
  "chapterId": "REPLACE_WITH_MOTION_CHAPTER_ID",
  "topicId": "REPLACE_WITH_VELOCITY_TOPIC_ID",
  "difficulty": "easy",
  "tags": ["mcq", "velocity", "motion"]
}

POST /api/questions
{
  "questionTextEn": "Which of Newton's laws states that F = ma?",
  "options": [
    { "text": "First law", "isCorrect": false },
    { "text": "Second law", "isCorrect": true },
    { "text": "Third law", "isCorrect": false },
    { "text": "Law of gravitation", "isCorrect": false }
  ],
  "explanation": "Newton's second law of motion states that Force equals mass times acceleration (F = ma).",
  "subjectId": "REPLACE_WITH_PHYSICS_SUBJECT_ID",
  "chapterId": "REPLACE_WITH_MOTION_CHAPTER_ID",
  "topicId": "REPLACE_WITH_NEWTONS_LAWS_TOPIC_ID",
  "difficulty": "medium",
  "tags": ["mcq", "newton", "laws"]
}

// ============= BULK IMPORT QUESTIONS =============

POST /api/questions/bulk
{
  "questions": [
    {
      "questionTextEn": "Question 1 Text",
      "options": [
        { "text": "Option A", "isCorrect": true },
        { "text": "Option B", "isCorrect": false },
        { "text": "Option C", "isCorrect": false },
        { "text": "Option D", "isCorrect": false }
      ],
      "explanation": "This is the explanation for question 1",
      "subjectId": "REPLACE_WITH_PHYSICS_SUBJECT_ID",
      "chapterId": "REPLACE_WITH_MOTION_CHAPTER_ID",
      "topicId": "REPLACE_WITH_VELOCITY_TOPIC_ID",
      "difficulty": "easy",
      "tags": ["tag1", "tag2"]
    },
    {
      "questionTextEn": "Question 2 Text",
      "options": [
        { "text": "Option A", "isCorrect": false },
        { "text": "Option B", "isCorrect": true },
        { "text": "Option C", "isCorrect": false },
        { "text": "Option D", "isCorrect": false }
      ],
      "explanation": "This is the explanation for question 2",
      "subjectId": "REPLACE_WITH_CHEMISTRY_SUBJECT_ID",
      "chapterId": "REPLACE_WITH_ATOMIC_STRUCTURE_CHAPTER_ID",
      "topicId": "REPLACE_WITH_ELECTRON_CONFIG_TOPIC_ID",
      "difficulty": "hard"
    }
  ]
}

// ============= EXAMS =============

POST /api/exams
{
  "title": "Physics Mid-Term Exam",
  "duration": 120,
  "totalMarks": 100,
  "questionIds": [
    "REPLACE_WITH_QUESTION_ID_1",
    "REPLACE_WITH_QUESTION_ID_2"
  ],
  "description": "Mid-term exam covering Motion and Forces chapters",
  "status": "draft"
}

POST /api/exams
{
  "title": "Chemistry Quiz 1",
  "duration": 30,
  "totalMarks": 50,
  "description": "Quick quiz on Atomic Structure"
}

// ============= PUBLISH EXAM =============

PATCH /api/exams/REPLACE_WITH_EXAM_ID/publish

// ============= GET REQUESTS =============

GET /api/classes
GET /api/groups
GET /api/groups?classId=REPLACE_WITH_CLASS_ID
GET /api/subjects
GET /api/subjects?groupId=REPLACE_WITH_GROUP_ID
GET /api/chapters
GET /api/chapters?subjectId=REPLACE_WITH_SUBJECT_ID
GET /api/topics
GET /api/topics?chapterId=REPLACE_WITH_CHAPTER_ID
GET /api/questions
GET /api/questions?subjectId=REPLACE_WITH_SUBJECT_ID&difficulty=easy
GET /api/questions?search=motion
GET /api/questions/REPLACE_WITH_QUESTION_ID
GET /api/exams
GET /api/exams/REPLACE_WITH_EXAM_ID

// ============= UPDATE EXAMPLES =============

PUT /api/classes/REPLACE_WITH_CLASS_ID
{
  "name": "SSC (Updated)",
  "description": "Updated description"
}

PUT /api/questions/REPLACE_WITH_QUESTION_ID
{
  "difficulty": "hard",
  "tags": ["updated", "tag"]
}

PUT /api/exams/REPLACE_WITH_EXAM_ID
{
  "title": "Physics Mid-Term Exam (Updated)",
  "duration": 150,
  "totalMarks": 120
}

// ============= DELETE EXAMPLES =============

DELETE /api/classes/REPLACE_WITH_CLASS_ID
DELETE /api/groups/REPLACE_WITH_GROUP_ID
DELETE /api/subjects/REPLACE_WITH_SUBJECT_ID
DELETE /api/chapters/REPLACE_WITH_CHAPTER_ID
DELETE /api/topics/REPLACE_WITH_TOPIC_ID
DELETE /api/questions/REPLACE_WITH_QUESTION_ID
DELETE /api/exams/REPLACE_WITH_EXAM_ID
