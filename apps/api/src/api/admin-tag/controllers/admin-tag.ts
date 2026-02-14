import type { Core } from '@strapi/strapi';

const TAG_UID = 'api::tag.tag' as any;

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const query = ctx.query || {};
    const data = await strapi.documents(TAG_UID).findMany(query as any);

    ctx.body = {
      data,
      meta: {
        pagination: {
          total: Array.isArray(data) ? data.length : 0,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const query = ctx.query || {};

    const data = await strapi.documents(TAG_UID).findOne({
      documentId: id,
      ...(query as any),
    });

    if (!data) {
      return ctx.notFound('Tag not found');
    }

    ctx.body = { data };
  },

  async create(ctx) {
    const payload = ctx.request.body?.data || {};
    const data = await strapi.documents(TAG_UID).create({
      data: payload,
    });

    ctx.body = { data };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const payload = ctx.request.body?.data || {};

    const data = await strapi.documents(TAG_UID).update({
      documentId: id,
      data: payload,
    });

    ctx.body = { data };
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const data = await strapi.documents(TAG_UID).delete({
      documentId: id,
    });

    ctx.body = { data };
  },
});
