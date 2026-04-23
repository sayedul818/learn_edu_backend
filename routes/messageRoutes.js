const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

router.get('/conversations', authenticate, messageController.listConversations);
router.post('/conversations', authenticate, messageController.createConversation);
router.get('/conversations/:id/messages', authenticate, messageController.getMessages);
router.post('/conversations/:id/messages', authenticate, messageController.sendMessage);
router.patch('/conversations/:conversationId/messages/:messageId', authenticate, messageController.editMessage);
router.delete('/conversations/:conversationId/messages/:messageId', authenticate, messageController.deleteMessage);
router.post('/conversations/:id/read', authenticate, messageController.markConversationRead);
router.post('/conversations/:id/typing', authenticate, messageController.setTyping);
router.post('/conversations/:id/mute', authenticate, messageController.setMute);

module.exports = router;
