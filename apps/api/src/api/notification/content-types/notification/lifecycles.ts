export default {
  async afterCreate(event) {
    const { result } = event;

    // Emit socket event to the specific user
    const io = (strapi as any).io;
    if (io && result.user) {
      const userId = typeof result.user === 'object' ? result.user.id : result.user;

      console.log(`📢 Emitting notification to user:${userId}`);

      // Emit to user-specific room
      io.to(`user:${userId}`).emit('notification:new', {
        id: result.id,
        documentId: result.documentId,
        type: result.type,
        message: result.message,
        read: result.read,
        data: result.data,
        createdAt: result.createdAt,
      });
    }
  },

  async afterUpdate(event) {
    const { result } = event;

    // Emit update event (e.g., when notification is marked as read)
    const io = (strapi as any).io;
    if (io && result.user) {
      const userId = typeof result.user === 'object' ? result.user.id : result.user;

      console.log(`🔄 Emitting notification update to user:${userId}`);

      io.to(`user:${userId}`).emit('notification:update', {
        id: result.id,
        documentId: result.documentId,
        read: result.read,
      });
    }
  },
};
