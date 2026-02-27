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

const questionSchema = new mongoose.Schema(
  {
    questionTextBn: {
      type: String,
      trim: true,
    },
    questionTextEn: {
      type: String,
      required: [true, 'Please provide question text in English'],
      trim: true,
    },
    options: {
      type: [optionSchema],
      required: [true, 'Please provide at least 2 options'],
      validate: {
        validator: (options) => options.length >= 2,
        message: 'Question must have at least 2 options',
      },
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
