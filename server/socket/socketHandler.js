module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Join role-based room so we can emit to specific roles
    socket.on('join:role', (role) => {
      socket.join(role);
      console.log(`👤 Socket ${socket.id} joined room: ${role}`);
    });

    // Join user-specific room
    socket.on('join:user', (userId) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });
};