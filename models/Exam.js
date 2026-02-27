const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide exam title'],
      trim: true,
    },
    duration: {
      type: Number,
      required: [true, 'Please provide exam duration in minutes'],
      default: 60,
    },
    totalMarks: {
      type: Number,
      required: [true, 'Please provide total marks'],
      default: 100,
    },
    questionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Question',
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'live'],
      default: 'draft',
    },
    description: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    warnings: {
      type: String,
      trim: true,
    },
    syllabus: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    startTime: {
      type: String,
    },
    endDate: {
      type: Date,
    },
    endTime: {
      type: String,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    // Settings
    marksPerQuestion: {
      type: Number,
      default: 1,
    },
    negativeMarking: {
      type: Boolean,
      default: false,
    },
    negativeMarkValue: {
      type: Number,
      default: 0,
    },
    questionNumbering: {
      type: String,
      enum: ['sequential', 'random'],
      default: 'sequential',
    },
    questionPresentation: {
      type: String,
      enum: ['all-at-once', 'one-by-one'],
      default: 'all-at-once',
    },
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    allowMultipleAttempts: {
      type: Boolean,
      default: false,
    },
    allowAnswerChange: {
      type: Boolean,
      default: true,
    },
    resultVisibility: {
      type: String,
      enum: ['immediate', 'after-exam-end', 'after-all-complete'],
      default: 'immediate',
    },
    answerVisibility: {
      type: String,
      enum: ['immediate', 'after-exam-end', 'never'],
      default: 'after-exam-end',
    },
    autoSubmit: {
      type: Boolean,
      default: true,
    },
    // Access control
    accessType: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
    },
    allowedStudents: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    // Educational hierarchy references
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      default: null,
    },
    // Creator info
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Exam', examSchema);
