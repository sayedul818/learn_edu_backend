const mongoose = require('mongoose');

const ExamResultSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: Object, required: true }, // { questionId: answer }
  // score and percentage can be null when pending manual evaluation
  score: { type: Number, required: false, default: null },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, required: false, default: null },
  // attachments for written responses: { questionId: { name, type, dataUrl or url } }
  attachments: { type: Object, default: {} },
  // per-question manual marks for CQ sub-questions: { questionId: marks }
  cqMarks: { type: Object, default: {} },
  pendingEvaluation: { type: Boolean, default: false },
  gradedAt: { type: Date },
  timeTaken: { type: Number, required: true }, // seconds
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

ExamResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ExamResult', ExamResultSchema);
