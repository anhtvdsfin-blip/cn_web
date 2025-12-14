export const initPostSocket = (io) => {
  io.on('connection', socket => {
    console.log('Post socket connected:', socket.id);

    // Listen for user ID join event
    socket.on('user:join', (userId) => {
      console.log(`👤 User ${userId} joined with socket ${socket.id}`);
      socket.join(userId); // Join room with user ID
    });

    // ==========================================
    // NOTIFICATION EVENT - SEND TO SPECIFIC USER
    // ==========================================
    socket.on('notification:send', (data) => {
      // data = { recipientId, type, senderId, senderName, postId, content, timestamp }
      console.log(`📢 Sending notification to user ${data.recipientId}`);
      io.to(data.recipientId).emit('notification:new', data);
    });

    socket.on('disconnect', () => {
      console.log('Post socket disconnected:', socket.id);
    });
  });
};