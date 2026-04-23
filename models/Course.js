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
  inviteToken: { type: String, unique: true, sparse: true, index: true, default: null },
  inviteTokenCreatedAt: { type: Date, default: null },
  examIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }],
  materials: [{
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['link', 'pdf', 'video', 'doc'], default: 'link' },
    category: { type: String, default: 'General' },
    description: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  }],
  announcements: [{
    title: { type: String, default: '' },
    message: { type: String, required: true },
    attachments: [{
      name: { type: String, default: '' },
      url: { type: String, required: true },
      type: { type: String, enum: ['pdf', 'image', 'video', 'link'], default: 'link' },
    }],
    audience: {
      scope: { type: String, enum: ['all', 'batch', 'students'], default: 'all' },
      batches: [{ type: String }],
      studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    schedule: {
      mode: { type: String, enum: ['now', 'scheduled'], default: 'now' },
      scheduledFor: { type: Date, default: null },
    },
    priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
    isPinned: { type: Boolean, default: false },
    notification: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      silent: { type: Boolean, default: false },
    },
    status: { type: String, enum: ['draft', 'published', 'scheduled'], default: 'published' },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userName: { type: String, default: '' },
      message: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now },
    }],
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
    },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);
