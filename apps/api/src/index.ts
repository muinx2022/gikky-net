import type { Core } from '@strapi/strapi';
import { Server as SocketIOServer } from 'socket.io';
import { bindNotificationListener } from './utils/notification-emitter';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Extend users-permissions plugin
    const plugin = strapi.plugin('users-permissions');

    if (plugin) {
      // Override the me() controller method
      const originalMe = plugin.controllers.user.me;

      plugin.controllers.user.me = async (ctx) => {
        if (!ctx.state.user) {
          return ctx.unauthorized();
        }

        const user = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id: ctx.state.user.id },
          populate: ['role'],
        });

        ctx.body = user;
      };
    }
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Grant authenticated users access to moderator routes
    try {
      const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });
      if (authenticatedRole) {
        const actionsToGrant = [
          'api::report.report.modQueue',
          'api::report.report.create',
          'api::report.report.myStatus',
          'api::report.report.dismiss',
          'api::post.post.moderatorDetail',
          'api::post.post.moderatorList',
        ];
        for (const action of actionsToGrant) {
          const existing = await strapi.query('plugin::users-permissions.permission').findOne({
            where: { action, role: authenticatedRole.id },
          });
          if (!existing) {
            await strapi.query('plugin::users-permissions.permission').create({
              data: { action, role: authenticatedRole.id },
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to grant moderator permissions:', e);
    }

    bindNotificationListener(strapi);

    const io = new SocketIOServer(strapi.server.httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Store io instance in strapi for global access
    (strapi as any).io = io;

    io.on('connection', (socket) => {
      console.log('✅ Socket.IO client connected:', socket.id);

      // Join user-specific room for targeted notifications
      socket.on('join', (userId: string) => {
        console.log(`👤 User ${userId} joined notification room`);
        socket.join(`user:${userId}`);
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket.IO client disconnected:', socket.id);
      });
    });

    console.log('🚀 Socket.IO server initialized on port', strapi.server.httpServer.address());
  },
};
