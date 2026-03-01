const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Please provide option text'],
  },
  isCorrect: {
    type: Boolean,
    default: false,
  },
});

const subQuestionSchema = new mongoose.Schema({
  label: { type: String },
  // optional type for sub-question (e.g., জ্ঞানমূলক, অনুধাবনমূলক, প্রয়োগমূলক)
  type: { type: String, trim: true },
  questionTextBn: { type: String, trim: true },
  questionTextEn: { type: String, trim: true },
  answerBn: { type: String, trim: true },
  answerEn: { type: String, trim: true },
  explanationBn: { type: String, trim: true },
  explanationEn: { type: String, trim: true },
});

const questionSchema = new mongoose.Schema(
  {
    questionTextBn: {
      type: String,
      trim: true,
    },
    questionTextEn: {
      type: String,
      trim: true,
      // required for MCQ only
      required: function() { return this.questionType === 'MCQ'; }
    },
    options: {
      type: [optionSchema],
      // only enforce options for MCQ
      validate: {
        validator: function(options) {
          if (this.questionType === 'MCQ') {
            return Array.isArray(options) && options.length >= 2;
          }
          return true; // other question types (CQ etc) may omit options
        },
        message: 'Question must have at least 2 options',
      },
    },
    subQuestions: {
      type: [subQuestionSchema],
      default: [],
    },
    explanation: {
      type: String,
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Please provide a subject ID'],
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      required: [true, 'Please provide a chapter ID'],
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: [true, 'Please provide a topic ID'],
    },
    examTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamType',
    },
    questionType: {
      type: String,
      enum: ['MCQ', 'CQ', 'গাণিতিক', 'জ্ঞানমূলক', 'অনুধাবনমূলক', 'ছোট লিখিত/সংক্ষিপ্ত প্রশ্ন', 'বড় লিখিত/রচনামূলক প্রশ্ন'],
      default: 'MCQ',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Question', questionSchema);
