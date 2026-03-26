const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  price: { type: Number, default: null },
  duration: { type: String, required: true, trim: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  ownerTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  examIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
  materials: [{
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['link', 'pdf', 'video', 'doc'], default: 'link' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  announcements: [{
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);
