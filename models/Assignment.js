const mongoose = require('mongoose');

const assignmentAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    url: { type: String, trim: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, trim: true },
  },
  { _id: false }
);

const referenceMaterialSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    url: { type: String, trim: true },
    type: { type: String, enum: ['pdf', 'image', 'link', 'doc'], default: 'link' },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    writtenAnswer: { type: String, trim: true, default: '' },
    attachments: { type: [assignmentAttachmentSchema], default: [] },
    submittedAt: { type: Date, default: null },
    isLate: { type: Boolean, default: false },
    marks: { type: Number, default: null },
    feedback: { type: String, trim: true, default: '' },
    gradedAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
  },
  { _id: false }
);

const AssignmentSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    ownerTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    instructions: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['written', 'file', 'mixed'], default: 'written' },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'draft', index: true },
    dueAt: { type: Date, default: null },
    totalMarks: { type: Number, default: 100 },
    allowLateSubmission: { type: Boolean, default: false },
    maxFileSizeMb: { type: Number, default: 10 },
    referenceMaterials: { type: [referenceMaterialSchema], default: [] },
    submissions: { type: [submissionSchema], default: [] },
  },
  { timestamps: true }
);

AssignmentSchema.index({ courseId: 1, ownerTeacherId: 1, status: 1, dueAt: -1 });

module.exports = mongoose.model('Assignment', AssignmentSchema);
