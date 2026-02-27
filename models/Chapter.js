const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a chapter name'],
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Please provide a subject ID'],
    },
    description: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Chapter', chapterSchema);
