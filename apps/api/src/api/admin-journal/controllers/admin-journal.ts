import type { Core } from '@strapi/strapi';

const JOURNAL_TRADE_UID = 'api::journal-trade.journal-trade';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const query = ctx.query || {};
    const filters = (query as any).filters || {};
    const where: Record<string, any> = {};

    if (filters?.symbol?.$containsi) {
      where.symbol = { $containsi: String(filters.symbol.$containsi).trim() };
    }
    if (filters?.market?.$eq) {
      where.market = filters.market.$eq;
    }
    if (filters?.outcome?.$eq) {
      where.outcome = filters.outcome.$eq;
    }
    if (typeof filters?.isPublic?.$eq !== 'undefined') {
      where.isPublic = Boolean(filters.isPublic.$eq);
    }

    const rows = await strapi.db.query(JOURNAL_TRADE_UID).findMany({
      where,
      orderBy: { entryDate: 'desc' },
      populate: {
        author: {
          select: ['id', 'username', 'email'],
        },
      },
    });

    ctx.body = {
      data: rows,
      meta: {
        pagination: {
          total: Array.isArray(rows) ? rows.length : 0,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const row = await strapi.db.query(JOURNAL_TRADE_UID).findOne({
      where: { documentId: id },
      populate: {
        author: {
          select: ['id', 'username', 'email'],
        },
        screenshots: true,
      },
    });

    if (!row) {
      return ctx.notFound('Journal trade not found');
    }

    ctx.body = { data: row };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const payload = ctx.request.body?.data || {};

    const data = await strapi.documents(JOURNAL_TRADE_UID).update({
      documentId: id,
      data: payload,
    });

    ctx.body = { data };
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const data = await strapi.documents(JOURNAL_TRADE_UID).delete({
      documentId: id,
    });

    ctx.body = { data };
  },
});
