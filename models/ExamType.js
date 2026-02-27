const mongoose = require('mongoose');

const examTypeSchema = new mongoose.Schema(
  {
    examCategory: {
      type: String,
      enum: ['Board', 'Admission', 'Institution', 'Practice'],
      required: [true, 'Please provide exam category'],
    },
    examName: {
      type: String,
      required: [true, 'Please provide exam name'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Please provide year'],
      min: 1950,
      max: 2100,
    },
  },
  {
    timestamps: true,
  }
);

// Create unique index for combination of category, name, and year
examTypeSchema.index({ examCategory: 1, examName: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('ExamType', examTypeSchema);
