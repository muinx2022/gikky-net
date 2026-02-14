import { EventEmitter } from 'events';
import type { Core } from '@strapi/strapi';

export interface NotificationEventPayload {
  userId: number;
  type: 'moderator_invite' | 'comment' | 'like' | 'follow';
  message: string;
  data?: Record<string, unknown>;
}

const emitter = new EventEmitter();

export const NOTIFICATION_EVENT = 'notification:push';

export const emitNotification = (
  strapi: Core.Strapi,
  payload: NotificationEventPayload
) => {
  emitter.emit(NOTIFICATION_EVENT, { strapi, payload });
};

export const bindNotificationListener = (strapi: Core.Strapi) => {
  if ((strapi as any).__notificationEmitterBound) {
    return;
  }

  emitter.on(
    NOTIFICATION_EVENT,
    async ({ payload }: { strapi: Core.Strapi; payload: NotificationEventPayload }) => {
      try {
        const created = await strapi.db.query('api::notification.notification').create({
          data: {
            user: payload.userId,
            type: payload.type,
            message: payload.message,
            read: false,
            data: payload.data || {},
          },
        });

        // Emit realtime event directly to avoid missing lifecycle-based emits.
        const io = (strapi as any).io;
        if (io) {
          io.to(`user:${payload.userId}`).emit('notification:new', {
            id: created?.id,
            documentId: created?.documentId,
            type: created?.type || payload.type,
            message: created?.message || payload.message,
            read: created?.read ?? false,
            data: created?.data || payload.data || {},
            createdAt: created?.createdAt || new Date().toISOString(),
          });
        }
      } catch (error) {
        strapi.log.error('Failed to persist notification from emitter', error);
      }
    }
  );

  (strapi as any).__notificationEmitterBound = true;
};
