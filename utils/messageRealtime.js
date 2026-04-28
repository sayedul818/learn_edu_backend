const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');

let wss = null;
const socketsByUserId = new Map();

function getUserIdFromToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
  return String(payload?._id || payload?.id || '');
}

function addSocket(userId, socket) {
  const key = String(userId || '');
  if (!key) return;

  if (!socketsByUserId.has(key)) socketsByUserId.set(key, new Set());
  socketsByUserId.get(key).add(socket);

  try {
    // debug: log active socket count for this user
    const count = socketsByUserId.get(key).size;
    console.debug(`[messageRealtime] addSocket user=${key} connections=${count}`);
  } catch (e) {
    // ignore logging failures
  }

  socket.on('close', () => {
    const set = socketsByUserId.get(key);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) socketsByUserId.delete(key);
  });
}

function emitToUserIds(userIds, payload) {
  const serialized = JSON.stringify(payload);
  const uniqueIds = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)));

  try {
    console.debug(`[messageRealtime] emitToUserIds targets=${JSON.stringify(uniqueIds)} type=${payload?.type}`);
  } catch (e) {
    // ignore
  }

  uniqueIds.forEach((userId) => {
    const sockets = socketsByUserId.get(userId);
    if (!sockets) return;

    Array.from(sockets).forEach((socket) => {
      try {
        if (socket.readyState === 1) socket.send(serialized);
      } catch (err) {
        // ignore individual send failures
      }
    });
  });
}

function attachMessageRealtime(server) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
  }

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname !== '/api/messages/ws') return;

      const token = url.searchParams.get('token');
      if (!token) {
        socket.destroy();
        return;
      }

      const userId = getUserIdFromToken(token);
      if (!userId) {
        socket.destroy();
        return;
      }

      // debug: log upgrade attempt
      console.debug(`[messageRealtime] upgrade request for user=${userId} path=${url.pathname}`);

      wss.handleUpgrade(request, socket, head, (ws) => {
        addSocket(userId, ws);
        try {
          ws.send(JSON.stringify({ type: 'connected', userId }));
        } catch (e) {}

        // log inbound messages from client for additional trace
        ws.on('message', (raw) => {
          try {
            console.debug(`[messageRealtime] recv from user=${userId} len=${String(raw || '').length}`);
          } catch (e) {}
        });
      });
    } catch {
      socket.destroy();
    }
  });

  return wss;
}

function broadcastMessageCreated({ participantIds = [], conversationId, message, conversation }) {
  emitToUserIds(participantIds, {
    type: 'message.created',
    conversationId: String(conversationId || ''),
    message,
    conversation,
  });
}

function broadcastConversationUpdated({ participantIds = [], conversation }) {
  emitToUserIds(participantIds, {
    type: 'conversation.updated',
    conversationId: String(conversation?._id || conversation?.id || ''),
    conversation,
  });
}

module.exports = {
  attachMessageRealtime,
  broadcastMessageCreated,
  broadcastConversationUpdated,
};