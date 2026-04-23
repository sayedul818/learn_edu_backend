const mongoose = require('mongoose');

const conversationParticipantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    lastReadAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    isTyping: { type: Boolean, default: false },
    typingUpdatedAt: { type: Date, default: null },
    muted: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], default: 'direct', index: true },
    title: { type: String, trim: true, default: '' },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    participants: { type: [conversationParticipantSchema], default: [] },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessagePreview: { type: String, trim: true, default: '' },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ participantIds: 1, type: 1, courseId: 1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
