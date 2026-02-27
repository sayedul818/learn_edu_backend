# 🔄 Migration Guide: localStorage → MongoDB

Step-by-step guide to migrate your frontend from localStorage to MongoDB backend.

## 📊 Data Structure Mapping

### Old (localStorage)
```javascript
// Questions stored in localStorage
{
  createdQuestions: [
    {
      id: 'q1',
      questionText: 'What is velocity?',
      questionTextBn: 'বেগ কী?',
      options: [
        { text: 'Speed with direction', isCorrect: true },
        { text: 'Speed', isCorrect: false }
      ],
      explanation: '...'
    }
  ],
  createdExams: [
    {
      id: 'exam1',
      title: 'Physics Quiz',
      duration: 30,
      totalMarks: 50,
      questions: ['q1', 'q2']
    }
  ]
}
```

### New (MongoDB Backend)
```javascript
// Questions stored in MongoDB (via API)
{
  _id: ObjectId,
  questionTextEn: 'What is velocity?',
  questionTextBn: 'বেগ কী?',
  options: [
    { text: 'Speed with direction', isCorrect: true },
    { text: 'Speed', isCorrect: false }
  ],
  explanation: '...',
  subjectId: ObjectId,
  chapterId: ObjectId,
  topicId: ObjectId,
  difficulty: 'medium',
  tags: ['mcq']
}

// Exams stored in MongoDB (via API)
{
  _id: ObjectId,
  title: 'Physics Quiz',
  duration: 30,
  totalMarks: 50,
  questionIds: [ObjectId, ObjectId],
  status: 'draft' // or 'live'
}
```

---

## 🚀 Step 1: Create API Service

Create `src/services/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface FetchOptions extends RequestInit {
  body?: any;
}

async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}

// Classes API
export const classesAPI = {
  getAll: () => fetchAPI('/classes'),
  get: (id: string) => fetchAPI(`/classes/${id}`),
  create: (data: any) => fetchAPI('/classes', { method: 'POST', body: data }),
  update: (id: string, data: any) => fetchAPI(`/classes/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => fetchAPI(`/classes/${id}`, { method: 'DELETE' }),
};

// Groups API
export const groupsAPI = {
  getAll: (classId?: string) => 
    fetchAPI(classId ? `/groups?classId=${classId}` : '/groups'),
  get: (id: string) => fetchAPI(`/groups/${id}`),
  create: (data: any) => fetchAPI('/groups', { method: 'POST', body: data }),
  update: (id: string, data: any) => fetchAPI(`/groups/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => fetchAPI(`/groups/${id}`, { method: 'DELETE' }),
};

// Subjects API
export const subjectsAPI = {
  getAll: (groupId?: string) => 
    fetchAPI(groupId ? `/subjects?groupId=${groupId}` : '/subjects'),
  get: (id: string) => fetchAPI(`/subjects/${id}`),
  create: (data: any) => fetchAPI('/subjects', { method: 'POST', body: data }),
  update: (id: string, data: any) => fetchAPI(`/subjects/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => fetchAPI(`/subjects/${id}`, { method: 'DELETE' }),
};

// Chapters API
export const chaptersAPI = {
  getAll: (subjectId?: string) => 
    fetchAPI(subjectId ? `/chapters?subjectId=${subjectId}` : '/chapters'),
  get: (id: string) => fetchAPI(`/chapters/${id}`),
  create: (data: any) => fetchAPI('/chapters', { method: 'POST', body: data }),
  update: (id: string, data: any) => fetchAPI(`/chapters/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => fetchAPI(`/chapters/${id}`, { method: 'DELETE' }),
};

// Topics API
export const topicsAPI = {
  getAll: (chapterId?: string) => 
    fetchAPI(chapterId ? `/topics?chapterId=${chapterId}` : '/topics'),
  get: (id: string) => fetchAPI(`/topics/${id}`),
  create: (data: any) => fetchAPI('/topics', { method: 'POST', body: data }),
  update: (id: string, data: any) => fetchAPI(`/topics/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => fetchAPI(`/topics/${id}`, { method: 'DELETE' }),
};

// Questions API
export const questionsAPI = {
  getAll: () => fetchAPI('/questions'),
  get: (id: string) => fetchAPI(`/questions/${id}`),
  create: (data: any) => fetchAPI('/questions', { method: 'POST', body: data }),
  bulkImport: (questions: any[]) => 
    fetchAPI('/questions/bulk', { method: 'POST', body: { questions } }),
  search: (search: string, filters?: any) => {
    const params = new URLSearchParams({ search, ...filters });
    return fetchAPI(`/questions?${params.toString()}`);
  },
  update: (id: string, data: any) => fetchAPI(`/questions/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => fetchAPI(`/questions/${id}`, { method: 'DELETE' }),
};

// Exams API
export const examsAPI = {
  getAll: () => fetchAPI('/exams'),
  get: (id: string) => fetchAPI(`/exams/${id}`),
  create: (data: any) => fetchAPI('/exams', { method: 'POST', body: data }),
  update: (id: string, data: any) => fetchAPI(`/exams/${id}`, { method: 'PUT', body: data }),
  publish: (id: string) => fetchAPI(`/exams/${id}/publish`, { method: 'PATCH' }),
  unpublish: (id: string) => fetchAPI(`/exams/${id}/unpublish`, { method: 'PATCH' }),
  delete: (id: string) => fetchAPI(`/exams/${id}`, { method: 'DELETE' }),
};
```

---

## 🔧 Step 2: Update Environment Variables

Create/Update `.env`:

```env
VITE_API_URL=http://localhost:5000/api     # Development
# VITE_API_URL=https://api.yourdomain.com  # Production
```

---

## 🔄 Step 3: Migrate Sections Page

### Before (localStorage):
```typescript
import { useState, useEffect } from 'react';

export default function AdminSections() {
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('classes');
    setClasses(JSON.parse(stored || '[]'));
  }, []);

  const handleCreateClass = (name: string) => {
    const newClass = { id: Date.now(), name };
    setClasses([...classes, newClass]);
    localStorage.setItem('classes', JSON.stringify(classes));
  };

  return (
    // ... JSX
  );
}
```

### After (API):
```typescript
import { useState, useEffect } from 'react';
import { classesAPI, groupsAPI, subjectsAPI, chaptersAPI, topicsAPI } from '@/services/api';

export default function AdminSections() {
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load classes on mount
  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await classesAPI.getAll();
      setClasses(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (name: string) => {
    try {
      setLoading(true);
      const response = await classesAPI.create({ name });
      setClasses([...classes, response.data]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create class');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGroups = async (classId: string) => {
    try {
      const data = await groupsAPI.getAll(classId);
      setGroups(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Academic Sections</h1>
      
      {/* Classes Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Classes</h2>
        <button onClick={() => handleCreateClass('New Class')}>Add Class</button>
        <ul>
          {classes.map((c) => (
            <li key={c._id} onClick={() => handleLoadGroups(c._id)}>
              {c.name}
            </li>
          ))}
        </ul>
      </div>

      {/* Groups Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Groups</h2>
        <ul>
          {groups.map((g) => (
            <li key={g._id}>{g.name}</li>
          ))}
        </ul>
      </div>

      {/* Similar sections for Subjects, Chapters, Topics */}
    </div>
  );
}
```

---

## 📝 Step 4: Migrate Questions Page

### Before (localStorage):
```typescript
const questions = JSON.parse(localStorage.getItem('createdQuestions') || '[]');
```

### After (API):
```typescript
import { questionsAPI } from '@/services/api';

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const data = await questionsAPI.getAll();
      setQuestions(data.data || []);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (questionData: any) => {
    try {
      const response = await questionsAPI.create(questionData);
      setQuestions([...questions, response.data]);
    } catch (err) {
      console.error('Failed to create question:', err);
    }
  };

  const handleBulkImport = async (questionsToImport: any[]) => {
    try {
      const response = await questionsAPI.bulkImport(questionsToImport);
      setQuestions([...questions, ...response.data]);
    } catch (err) {
      console.error('Failed to bulk import:', err);
    }
  };

  const handleUpdateQuestion = async (id: string, data: any) => {
    try {
      const response = await questionsAPI.update(id, data);
      setQuestions(questions.map(q => q._id === id ? response.data : q));
    } catch (err) {
      console.error('Failed to update question:', err);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await questionsAPI.delete(id);
      setQuestions(questions.filter(q => q._id !== id));
    } catch (err) {
      console.error('Failed to delete question:', err);
    }
  };

  const handleSearchQuestions = async (searchTerm: string) => {
    try {
      const data = await questionsAPI.search(searchTerm);
      setQuestions(data.data || []);
    } catch (err) {
      console.error('Failed to search questions:', err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Questions Management</h1>
      
      {/* Bulk Import */}
      <button onClick={() => handleBulkImport(/*imported data*/)}>
        Bulk Import
      </button>

      {/* Questions List */}
      {questions.map((q) => (
        <QuestionCard
          key={q._id}
          question={q}
          onUpdate={(data) => handleUpdateQuestion(q._id, data)}
          onDelete={() => handleDeleteQuestion(q._id)}
        />
      ))}
    </div>
  );
}
```

---

## 🎓 Step 5: Migrate Exam Builder Page

### Before (localStorage):
```typescript
const exams = JSON.parse(localStorage.getItem('createdExams') || '[]');
```

### After (API):
```typescript
import { examsAPI, questionsAPI } from '@/services/api';

export default function AdminExamBuilder() {
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  useEffect(() => {
    loadExams();
    loadQuestions();
  }, []);

  const loadExams = async () => {
    try {
      const data = await examsAPI.getAll();
      setExams(data.data || []);
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await questionsAPI.getAll();
      setQuestions(data.data || []);
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  };

  const handleCreateExam = async (examData: any) => {
    try {
      const response = await examsAPI.create({
        ...examData,
        questionIds: selectedQuestions
      });
      setExams([...exams, response.data]);
      setSelectedQuestions([]);
    } catch (err) {
      console.error('Failed to create exam:', err);
    }
  };

  const handlePublishExam = async (examId: string) => {
    try {
      const response = await examsAPI.publish(examId);
      setExams(exams.map(e => e._id === examId ? response.data : e));
    } catch (err) {
      console.error('Failed to publish exam:', err);
    }
  };

  const handleUnpublishExam = async (examId: string) => {
    try {
      const response = await examsAPI.unpublish(examId);
      setExams(exams.map(e => e._id === examId ? response.data : e));
    } catch (err) {
      console.error('Failed to unpublish exam:', err);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      await examsAPI.delete(examId);
      setExams(exams.filter(e => e._id !== examId));
    } catch (err) {
      console.error('Failed to delete exam:', err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Exam Builder</h1>

      {/* Create Exam Form */}
      <div className="mb-6">
        <input type="text" placeholder="Exam Title" />
        <input type="number" placeholder="Duration (mins)" />
        <input type="number" placeholder="Total Marks" />
        <button onClick={() => handleCreateExam(/*form data*/)}>Create Exam</button>
      </div>

      {/* Select Questions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Select Questions</h2>
        {questions.map((q) => (
          <label key={q._id}>
            <input
              type="checkbox"
              checked={selectedQuestions.includes(q._id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedQuestions([...selectedQuestions, q._id]);
                } else {
                  setSelectedQuestions(selectedQuestions.filter(id => id !== q._id));
                }
              }}
            />
            {q.questionTextEn}
          </label>
        ))}
      </div>

      {/* Exams List */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Exams</h2>
        {exams.map((exam) => (
          <div key={exam._id} className="border p-4 mb-2">
            <h3>{exam.title}</h3>
            <p>Status: {exam.status}</p>
            {exam.status === 'draft' && (
              <button onClick={() => handlePublishExam(exam._id)}>Publish</button>
            )}
            {exam.status === 'live' && (
              <button onClick={() => handleUnpublishExam(exam._id)}>Unpublish</button>
            )}
            <button onClick={() => handleDeleteExam(exam._id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 Step 6: Update Context/Store

If using React Context:

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { questionsAPI, examsAPI } from '@/services/api';

interface AdminContextType {
  questions: any[];
  exams: any[];
  loading: boolean;
  error: string | null;
  refreshQuestions: () => Promise<void>;
  refreshExams: () => Promise<void>;
  createQuestion: (data: any) => Promise<void>;
  createExam: (data: any) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [questions, setQuestions] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQuestions = async () => {
    try {
      setLoading(true);
      const data = await questionsAPI.getAll();
      setQuestions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const refreshExams = async () => {
    try {
      setLoading(true);
      const data = await examsAPI.getAll();
      setExams(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const createQuestion = async (data: any) => {
    try {
      await questionsAPI.create(data);
      await refreshQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question');
    }
  };

  const createExam = async (data: any) => {
    try {
      await examsAPI.create(data);
      await refreshExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create exam');
    }
  };

  useEffect(() => {
    refreshQuestions();
    refreshExams();
  }, []);

  return (
    <AdminContext.Provider
      value={{
        questions,
        exams,
        loading,
        error,
        refreshQuestions,
        refreshExams,
        createQuestion,
        createExam,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
```

---

## ✅ Migration Checklist

- [ ] Backend running locally
- [ ] MongoDB connected
- [ ] API service created
- [ ] Environment variables configured
- [ ] Sections page migrated
- [ ] Questions page migrated
- [ ] Exam builder page migrated
- [ ] Analytics page reviewed
- [ ] All CRUD operations working
- [ ] Search/filter working
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] localStorage removed
- [ ] Bulk import tested
- [ ] Publish/unpublish working

---

## 🔄 Reverse Migration (If Needed)

Export from MongoDB back to localStorage:

```typescript
export const exportToLocalStorage = async () => {
  try {
    const questions = await questionsAPI.getAll();
    const exams = await examsAPI.getAll();

    localStorage.setItem('createdQuestions', JSON.stringify(questions.data));
    localStorage.setItem('createdExams', JSON.stringify(exams.data));
    
    console.log('Data exported to localStorage');
  } catch (err) {
    console.error('Export failed:', err);
  }
};
```

---

## 🚀 Final Steps

1. Test all pages thoroughly
2. Remove localStorage usage completely
3. Update any remaining direct localStorage calls
4. Deploy frontend and backend
5. Monitor for errors

---

**Status:** ✅ Ready for Migration
**Last Updated:** February 20, 2024
