const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');

function toObjectId(user) {
  return user?._id || user?.id || null;
}

function isAdmin(user) {
  return user && user.role === 'admin';
}

function normalizeAttachmentType(mimeType = '', fileName = '') {
  const normalizedMime = String(mimeType || '').toLowerCase();
  const normalizedName = String(fileName || '').toLowerCase();
  if (normalizedMime.startsWith('image/')) return 'image';
  if (normalizedMime.includes('pdf') || normalizedName.endsWith('.pdf')) return 'pdf';
  if (normalizedMime.includes('word') || normalizedMime.includes('officedocument') || normalizedName.endsWith('.doc') || normalizedName.endsWith('.docx')) return 'doc';
  return 'file';
}

function sanitizeAttachments(list) {
  const items = Array.isArray(list) ? list : [];
  return items
    .map((item) => ({
      name: String(item?.name || '').trim(),
      url: String(item?.url || '').trim(),
      mimeType: String(item?.mimeType || '').trim(),
      size: Number(item?.size) || 0,
      type: normalizeAttachmentType(item?.mimeType, item?.name),
    }))
    .filter((item) => item.url);
}

function formatLastSeen(lastSeenAt) {
  const ts = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
  if (!Number.isFinite(ts)) return 'Offline';

  const diffMs = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < 5 * minute) return 'Online';
  if (diffMs < hour) return `Last seen ${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `Last seen ${Math.max(1, Math.floor(diffMs / hour))}h ago`;
  return `Last seen ${Math.max(1, Math.floor(diffMs / day))}d ago`;
}

async function canTeacherAccessStudent(teacherId, studentId, user) {
  const student = await User.findOne({ _id: studentId, role: 'student' })
    .select('name email avatar assignedTeacherId lastLogin status')
    .lean();

  if (!student) return null;
  if (isAdmin(user)) return student;

  const isAssigned = String(student.assignedTeacherId || '') === String(teacherId);
  if (isAssigned) return student;

  const hasEnrollment = await Enrollment.exists({ studentId, ownerTeacherId: teacherId });
  if (!hasEnrollment) return null;

  return student;
}

async function canStudentChatCourseTeacher(studentId, courseId) {
  const enrollment = await Enrollment.findOne({ studentId, courseId, status: 'active' })
    .populate('courseId', 'title ownerTeacherId')
    .lean();

  if (!enrollment?.courseId?.ownerTeacherId) return null;

  const teacher = await User.findOne({ _id: enrollment.courseId.ownerTeacherId, role: 'teacher' })
    .select('name email avatar lastLogin status')
    .lean();

  if (!teacher) return null;

  return {
    enrollment,
    teacher,
    course: enrollment.courseId,
  };
}

function isConversationParticipant(conversation, userId) {
  return (conversation?.participantIds || []).some((id) => String(id) === String(userId));
}

function getParticipantState(conversation, userId) {
  return (conversation.participants || []).find((p) => String(p.userId) === String(userId));
}

function buildLastPreview(text = '', attachments = []) {
  const value = String(text || '').trim();
  if (value) return value.slice(0, 120);
  if ((attachments || []).length > 0) {
    const first = attachments[0];
    return first?.name ? `Attachment: ${first.name}` : 'Attachment';
  }
  return '';
}

async function updateStatusesAsSeen({ conversationId, viewerId }) {
  const messages = await Message.find({ conversationId, senderId: { $ne: viewerId } })
    .select('_id seenBy')
    .lean();

  const toUpdate = messages.filter((message) => {
    const alreadySeen = (message.seenBy || []).some((entry) => String(entry.userId) === String(viewerId));
    return !alreadySeen;
  });

  if (!toUpdate.length) return;

  await Message.updateMany(
    { _id: { $in: toUpdate.map((item) => item._id) } },
    {
      $addToSet: { seenBy: { userId: viewerId, seenAt: new Date() } },
      $set: { status: 'seen' },
    }
  );
}

function isMessageVisibleToUser(message, userId) {
  if (!message) return false;
  if (message.deletedForEveryone) return false;
  const hiddenFor = Array.isArray(message.hiddenFor) ? message.hiddenFor : [];
  return !hiddenFor.some((entry) => String(entry.userId) === String(userId));
}

exports.listConversations = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const search = String(req.query?.search || '').trim();

    await Conversation.updateOne(
      { participantIds: userId },
      {
        $set: {
          'participants.$[me].lastSeenAt': new Date(),
        },
      },
      {
        arrayFilters: [{ 'me.userId': userId }],
      }
    );

    const conversations = await Conversation.find({ participantIds: userId })
      .populate('courseId', 'title')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const otherIds = new Set();
    conversations.forEach((conversation) => {
      (conversation.participantIds || []).forEach((id) => {
        if (String(id) !== String(userId)) otherIds.add(String(id));
      });
    });

    const otherUsers = await User.find({ _id: { $in: Array.from(otherIds) } })
      .select('name email avatar lastLogin status')
      .lean();
    const userMap = new Map(otherUsers.map((user) => [String(user._id), user]));

    const rows = await Promise.all(conversations.map(async (conversation) => {
      const me = getParticipantState(conversation, userId);
      const otherParticipantId = (conversation.participantIds || []).find((id) => String(id) !== String(userId));
      const otherUser = userMap.get(String(otherParticipantId || ''));

      if (search) {
        const haystack = `${String(conversation?.title || '')} ${String(otherUser?.name || '')} ${String(otherUser?.email || '')}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return null;
      }

      const unreadCount = await Message.countDocuments({
        conversationId: conversation._id,
        senderId: { $ne: userId },
        createdAt: me?.lastReadAt ? { $gt: new Date(me.lastReadAt) } : { $exists: true },
      });

      const othersTyping = (conversation.participants || []).some((participant) => {
        if (String(participant.userId) === String(userId)) return false;
        if (!participant.isTyping) return false;
        const ts = participant.typingUpdatedAt ? new Date(participant.typingUpdatedAt).getTime() : NaN;
        if (!Number.isFinite(ts)) return false;
        return Date.now() - ts < 20000;
      });

      return {
        _id: conversation._id,
        type: conversation.type,
        title: conversation.title,
        displayName: conversation.type === 'group' ? (conversation.title || 'Group') : (otherUser?.name || 'Student'),
        course: conversation.courseId
          ? { _id: conversation.courseId._id, title: conversation.courseId.title }
          : null,
        peer: otherUser
          ? {
              _id: otherUser._id,
              name: otherUser.name,
              email: otherUser.email,
              avatar: otherUser.avatar || '',
              isOnline: formatLastSeen(otherUser.lastLogin) === 'Online',
              lastSeenLabel: formatLastSeen(otherUser.lastLogin),
              status: otherUser.status,
            }
          : null,
        lastMessagePreview: conversation.lastMessagePreview || '',
        lastMessageAt: conversation.lastMessageAt,
        unreadCount,
        muted: Boolean(me?.muted),
        othersTyping,
      };
    }));

    const data = rows.filter(Boolean).sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createConversation = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const mode = String(req.body?.type || 'direct').toLowerCase() === 'group' ? 'group' : 'direct';
    const courseId = req.body?.courseId || null;
    let conversation = null;

    if (mode === 'group') {
      if (req.user?.role === 'student') {
        return res.status(403).json({ success: false, error: 'Students cannot create group conversations' });
      }

      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ success: false, error: 'title is required for group conversation' });

      const rawParticipantIds = Array.isArray(req.body?.participantIds) ? req.body.participantIds : [];
      const uniqueIds = [...new Set(rawParticipantIds.map((id) => String(id)).filter(Boolean))];
      if (uniqueIds.length === 0) return res.status(400).json({ success: false, error: 'participantIds are required for group conversation' });

      const accessibleStudents = await Promise.all(uniqueIds.map((id) => canTeacherAccessStudent(userId, id, req.user)));
      const validStudentIds = accessibleStudents.filter(Boolean).map((student) => String(student._id));
      if (!validStudentIds.length) return res.status(403).json({ success: false, error: 'No valid participants found' });

      const participantIds = [...new Set([String(userId), ...validStudentIds])];
      conversation = await Conversation.create({
        type: 'group',
        title,
        participantIds,
        participants: participantIds.map((id) => ({
          userId: id,
          role: String(id) === String(userId) ? req.user.role : 'student',
          lastReadAt: String(id) === String(userId) ? new Date() : null,
          lastSeenAt: String(id) === String(userId) ? new Date() : null,
        })),
        courseId: courseId || null,
        createdBy: userId,
      });
    } else {
      if (req.user?.role === 'student') {
        const selectedCourseId = String(courseId || '').trim();
        if (!selectedCourseId) {
          return res.status(400).json({ success: false, error: 'courseId is required for student conversations' });
        }

        const chatTarget = await canStudentChatCourseTeacher(userId, selectedCourseId);
        if (!chatTarget) {
          return res.status(403).json({ success: false, error: 'You can only chat with teachers of your active enrolled courses' });
        }

        const teacherId = String(chatTarget.teacher._id);
        const query = {
          type: 'direct',
          participantIds: { $all: [userId, teacherId], $size: 2 },
          courseId: chatTarget.course._id,
        };

        conversation = await Conversation.findOne(query);

        if (!conversation) {
          conversation = await Conversation.create({
            type: 'direct',
            participantIds: [userId, teacherId],
            participants: [
              { userId, role: 'student', lastReadAt: new Date(), lastSeenAt: new Date() },
              { userId: teacherId, role: 'teacher', lastReadAt: null, lastSeenAt: chatTarget.teacher.lastLogin || null },
            ],
            courseId: chatTarget.course._id,
            createdBy: userId,
          });
        }
      } else {
        const studentId = String(req.body?.studentId || '').trim();
        if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required' });

        const student = await canTeacherAccessStudent(userId, studentId, req.user);
        if (!student) return res.status(403).json({ success: false, error: 'Student is not accessible' });

        const query = {
          type: 'direct',
          participantIds: { $all: [userId, studentId], $size: 2 },
          ...(courseId ? { courseId } : {}),
        };

        conversation = await Conversation.findOne(query);

        if (!conversation) {
          conversation = await Conversation.create({
            type: 'direct',
            participantIds: [userId, studentId],
            participants: [
              { userId, role: req.user.role, lastReadAt: new Date(), lastSeenAt: new Date() },
              { userId: studentId, role: 'student', lastReadAt: null, lastSeenAt: student.lastLogin || null },
            ],
            courseId: courseId || null,
            createdBy: userId,
          });
        }
      }
    }

    const text = String(req.body?.text || '').trim();
    const attachments = sanitizeAttachments(req.body?.attachments);
    if (text || attachments.length > 0) {
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: userId,
        text,
        attachments,
        status: 'delivered',
      });

      const now = message.createdAt || new Date();
      await Conversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            lastMessagePreview: buildLastPreview(text, attachments),
            lastMessageAt: now,
            lastMessageSenderId: userId,
            'participants.$[me].lastReadAt': now,
            'participants.$[me].lastSeenAt': now,
            'participants.$[me].isTyping': false,
            'participants.$[me].typingUpdatedAt': now,
          },
        },
        { arrayFilters: [{ 'me.userId': userId }] }
      );
    }

    const populated = await Conversation.findById(conversation._id).populate('courseId', 'title').lean();
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.id)
      .populate('courseId', 'title')
      .lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          'participants.$[me].lastSeenAt': new Date(),
        },
      },
      {
        arrayFilters: [{ 'me.userId': userId }],
      }
    );

    const limit = Math.max(20, Math.min(300, Number(req.query?.limit) || 120));
    const rawMessages = await Message.find({ conversationId: conversation._id })
      .populate('senderId', 'name avatar role')
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    const messages = rawMessages.filter((message) => isMessageVisibleToUser(message, userId));

    const sharedFiles = messages
      .flatMap((message) => (message.attachments || []).map((attachment) => ({
        ...attachment,
        messageId: message._id,
        createdAt: message.createdAt,
        senderId: message.senderId,
      })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: {
        conversation,
        messages,
        sharedFiles,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.conversationId).lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const message = await Message.findOne({ _id: req.params.messageId, conversationId: conversation._id });
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    if (String(message.senderId) !== String(userId) && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'You can only edit your own messages' });
    }
    if (message.deletedForEveryone) {
      return res.status(400).json({ success: false, error: 'Deleted messages cannot be edited' });
    }

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });

    message.text = text;
    message.editedAt = new Date();
    await message.save();

    const payload = await Message.findById(message._id).populate('senderId', 'name avatar role').lean();
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.conversationId).lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const message = await Message.findOne({ _id: req.params.messageId, conversationId: conversation._id });
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    const scope = String(req.body?.scope || req.query?.scope || 'me').toLowerCase();
    const isSender = String(message.senderId) === String(userId);

    if (scope === 'everyone') {
      if (!isSender && !isAdmin(req.user)) {
        return res.status(403).json({ success: false, error: 'Only the sender can delete for everyone' });
      }

      message.deletedForEveryone = true;
      message.deletedForEveryoneAt = new Date();
      message.deletedBy = userId;
      message.text = '';
      message.attachments = [];
      await message.save();
      return res.json({ success: true, data: { messageId: message._id, scope: 'everyone' } });
    }

    const hiddenFor = Array.isArray(message.hiddenFor) ? message.hiddenFor : [];
    const alreadyHidden = hiddenFor.some((entry) => String(entry.userId) === String(userId));
    if (!alreadyHidden) {
      hiddenFor.push({ userId, hiddenAt: new Date() });
      message.hiddenFor = hiddenFor;
      await message.save();
    }

    return res.json({ success: true, data: { messageId: message._id, scope: 'me' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const text = String(req.body?.text || '').trim();
    const attachments = sanitizeAttachments(req.body?.attachments);
    if (!text && attachments.length === 0) {
      return res.status(400).json({ success: false, error: 'text or attachments are required' });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: userId,
      text,
      attachments,
      status: 'delivered',
    });

    const now = message.createdAt || new Date();
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessagePreview: buildLastPreview(text, attachments),
          lastMessageAt: now,
          lastMessageSenderId: userId,
          'participants.$[me].lastReadAt': now,
          'participants.$[me].lastSeenAt': now,
          'participants.$[me].isTyping': false,
          'participants.$[me].typingUpdatedAt': now,
        },
      },
      { arrayFilters: [{ 'me.userId': userId }] }
    );

    const payload = await Message.findById(message._id).populate('senderId', 'name avatar role').lean();
    res.status(201).json({ success: true, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const now = new Date();
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          'participants.$[me].lastReadAt': now,
          'participants.$[me].lastSeenAt': now,
          'participants.$[me].isTyping': false,
          'participants.$[me].typingUpdatedAt': now,
        },
      },
      { arrayFilters: [{ 'me.userId': userId }] }
    );

    await updateStatusesAsSeen({ conversationId: conversation._id, viewerId: userId });

    res.json({ success: true, data: { conversationId: conversation._id, readAt: now } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.setTyping = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const isTyping = Boolean(req.body?.isTyping);
    const now = new Date();

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          'participants.$[me].isTyping': isTyping,
          'participants.$[me].typingUpdatedAt': now,
          'participants.$[me].lastSeenAt': now,
        },
      },
      { arrayFilters: [{ 'me.userId': userId }] }
    );

    res.json({ success: true, data: { conversationId: conversation._id, isTyping } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.setMute = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const conversation = await Conversation.findById(req.params.id).lean();
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    if (!isConversationParticipant(conversation, userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const muted = Boolean(req.body?.muted);

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          'participants.$[me].muted': muted,
        },
      },
      { arrayFilters: [{ 'me.userId': userId }] }
    );

    res.json({ success: true, data: { conversationId: conversation._id, muted } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
