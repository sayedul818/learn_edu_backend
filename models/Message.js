const mongoose = require('mongoose');

const messageAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, required: true },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    type: { type: String, enum: ['image', 'pdf', 'doc', 'file'], default: 'file' },
  },
  { _id: false }
);

const messageSeenBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, trim: true, default: '' },
    attachments: { type: [messageAttachmentSchema], default: [] },
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent', index: true },
    seenBy: { type: [messageSeenBySchema], default: [] },
    editedAt: { type: Date, default: null },
    hiddenFor: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      hiddenAt: { type: Date, default: Date.now },
    }],
    deletedForEveryone: { type: Boolean, default: false },
    deletedForEveryoneAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
