/**
 * journal-trade controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::journal-trade.journal-trade', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const body = (ctx.request.body || {}) as { data?: Record<string, any> };
    const hasManualPnl = Object.prototype.hasOwnProperty.call(body.data || {}, 'pnl');
    const manualPnl = hasManualPnl
      ? ((body.data as any)?.pnl === null || (body.data as any)?.pnl === '' ? null : Number((body.data as any)?.pnl))
      : null;
    const nextData = { ...(body.data || {}) };
    delete nextData.author;
    ctx.request.body = { ...body, data: nextData };

    strapi.log.info(`[journal-trade.create] incoming pnl=${String((body.data as any)?.pnl)} entryPrice=${String((body.data as any)?.entryPrice)} exitPrice=${String((body.data as any)?.exitPrice)} fees=${String((body.data as any)?.fees)}`);

    const result = await super.create(ctx);

    const documentId = (result as any)?.data?.documentId;
    if (documentId) {
      await strapi.documents('api::journal-trade.journal-trade').update({
        documentId,
        data: { author: user.id } as any,
      });
    }

    strapi.log.info(`[journal-trade.create] after super/create result.id=${String((result as any)?.data?.id)} result.pnl=${String((result as any)?.data?.pnl)} result.pnlPercent=${String((result as any)?.data?.pnlPercent)}`);

    // Force exact manual P&L if client provided it, preventing any hidden recalculation override.
    if (hasManualPnl && Number.isFinite(manualPnl as number)) {
      const rowId = Number((result as any)?.data?.id);
      if (Number.isFinite(rowId)) {
        await strapi.db.query('api::journal-trade.journal-trade').update({
          where: { id: rowId },
          data: { pnl: manualPnl },
        });
        (result as any).data.pnl = manualPnl;
      }
    } else if (hasManualPnl && manualPnl === null) {
      const rowId = Number((result as any)?.data?.id);
      if (Number.isFinite(rowId)) {
        await strapi.db.query('api::journal-trade.journal-trade').update({
          where: { id: rowId },
          data: { pnl: null },
        });
        (result as any).data.pnl = null;
      }
    }

    if (Number.isFinite(Number((result as any)?.data?.id))) {
      const rowId = Number((result as any)?.data?.id);
      const rowAfter = await strapi.db.query('api::journal-trade.journal-trade').findOne({
        where: { id: rowId },
        select: ['id', 'pnl', 'pnlPercent', 'fees', 'entryPrice', 'exitPrice', 'quantity'],
      });
      strapi.log.info(`[journal-trade.create] after override db.id=${String((rowAfter as any)?.id)} pnl=${String((rowAfter as any)?.pnl)} pnlPercent=${String((rowAfter as any)?.pnlPercent)} fees=${String((rowAfter as any)?.fees)}`);
    }

    return result;
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const documentId = ctx.params.id;
    const existing = await strapi.documents('api::journal-trade.journal-trade').findOne({
      documentId,
      populate: { author: { fields: ['id'] } },
    });

    if (!existing) {
      return ctx.notFound('Trade not found');
    }

    const authorId = Number((existing as any)?.author?.id);
    if (authorId !== Number(user.id)) {
      return ctx.forbidden('You can only edit your own trades');
    }

    const body = (ctx.request.body || {}) as { data?: Record<string, any> };
    const hasManualPnl = Object.prototype.hasOwnProperty.call(body.data || {}, 'pnl');
    const manualPnl = hasManualPnl
      ? ((body.data as any)?.pnl === null || (body.data as any)?.pnl === '' ? null : Number((body.data as any)?.pnl))
      : null;
    const nextData = { ...(body.data || {}) };
    delete nextData.author;
    ctx.request.body = { ...body, data: nextData };

    strapi.log.info(`[journal-trade.update] incoming doc=${documentId} pnl=${String((body.data as any)?.pnl)} entryPrice=${String((body.data as any)?.entryPrice)} exitPrice=${String((body.data as any)?.exitPrice)} fees=${String((body.data as any)?.fees)}`);

    const existingBefore = await strapi.documents('api::journal-trade.journal-trade').findOne({
      documentId,
      populate: { author: { fields: ['id'] } },
    });
    strapi.log.info(`[journal-trade.update] before super doc=${documentId} id=${String((existingBefore as any)?.id)} pnl=${String((existingBefore as any)?.pnl)} pnlPercent=${String((existingBefore as any)?.pnlPercent)} fees=${String((existingBefore as any)?.fees)}`);

    const result = await super.update(ctx);
    strapi.log.info(`[journal-trade.update] after super result.id=${String((result as any)?.data?.id)} result.pnl=${String((result as any)?.data?.pnl)} result.pnlPercent=${String((result as any)?.data?.pnlPercent)} fees=${String((result as any)?.data?.fees)}`);

    if (hasManualPnl) {
      const rowId = Number((result as any)?.data?.id);
      if (Number.isFinite(rowId)) {
        await strapi.db.query('api::journal-trade.journal-trade').update({
          where: { id: rowId },
          data: { pnl: Number.isFinite(manualPnl as number) ? manualPnl : null },
        });
        (result as any).data.pnl = Number.isFinite(manualPnl as number) ? manualPnl : null;
      }
    }

    if (Number.isFinite(Number((result as any)?.data?.id))) {
      const rowId = Number((result as any)?.data?.id);
      const rowAfter = await strapi.db.query('api::journal-trade.journal-trade').findOne({
        where: { id: rowId },
        select: ['id', 'pnl', 'pnlPercent', 'fees', 'entryPrice', 'exitPrice', 'quantity'],
      });
      strapi.log.info(`[journal-trade.update] final db.id=${String((rowAfter as any)?.id)} pnl=${String((rowAfter as any)?.pnl)} pnlPercent=${String((rowAfter as any)?.pnlPercent)} fees=${String((rowAfter as any)?.fees)}`);
    }

    return result;
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const documentId = ctx.params.id;
    const existing = await strapi.documents('api::journal-trade.journal-trade').findOne({
      documentId,
      populate: { author: { fields: ['id'] } },
    });

    if (!existing) {
      return ctx.notFound('Trade not found');
    }

    const authorId = Number((existing as any)?.author?.id);
    if (authorId !== Number(user.id)) {
      return ctx.forbidden('You can only delete your own trades');
    }

    return super.delete(ctx);
  },

  async myTrades(ctx) {
    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const { page = 1, pageSize = 20, outcome, market } = ctx.query as any;

    const where: Record<string, any> = {};

    // Raw DB query to get trades by author
    const trades = await strapi.db.query('api::journal-trade.journal-trade').findMany({
      where: {
        author: { id: user.id },
        ...(outcome ? { outcome } : {}),
        ...(market ? { market } : {}),
      },
      orderBy: { entryDate: 'desc' },
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      populate: { author: { select: ['id', 'username'] }, screenshots: true },
    });

    const total = await strapi.db.query('api::journal-trade.journal-trade').count({
      where: {
        author: { id: user.id },
        ...(outcome ? { outcome } : {}),
        ...(market ? { market } : {}),
      },
    });

    ctx.body = {
      data: trades,
      meta: {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          pageCount: Math.ceil(total / Number(pageSize)),
        },
      },
    };
  },

  async myStats(ctx) {
    const user = ctx.state.user;
    if (!user?.id) {
      return ctx.unauthorized('You must be logged in');
    }

    const trades = await strapi.db.query('api::journal-trade.journal-trade').findMany({
      where: { author: { id: user.id } },
      orderBy: { entryDate: 'asc' },
    }) as any[];

    const closed = trades.filter((t) => t.outcome !== 'open');
    const wins = closed.filter((t) => t.outcome === 'win');
    const losses = closed.filter((t) => t.outcome === 'loss');
    const totalPnl = closed.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

    const pnlValues = closed.map((t) => Number(t.pnl) || 0);
    const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

    const validRR = closed
      .map((t) => Number(t.riskRewardRatio))
      .filter((v) => Number.isFinite(v) && v > 0);
    const avgRR = validRR.length > 0 ? validRR.reduce((a, b) => a + b, 0) / validRR.length : 0;

    // Equity curve: cumulative P&L over time
    let cumulative = 0;
    const equityCurve = closed.map((t) => {
      cumulative += Number(t.pnl) || 0;
      return { date: t.entryDate, value: cumulative };
    });

    ctx.body = {
      data: {
        totalTrades: trades.length,
        closedTrades: closed.length,
        wins: wins.length,
        losses: losses.length,
        winRate: Math.round(winRate * 10) / 10,
        totalPnl: Math.round(totalPnl * 100) / 100,
        bestTrade: Math.round(bestTrade * 100) / 100,
        worstTrade: Math.round(worstTrade * 100) / 100,
        avgRR: Math.round(avgRR * 100) / 100,
        equityCurve,
      },
    };
  },

  async publicFeed(ctx) {
    const { page = 1, pageSize = 20, market, outcome } = ctx.query as any;
    const allRows = await strapi.db.query('api::journal-trade.journal-trade').findMany({
      where: {
        ...(market ? { market } : {}),
        ...(outcome ? { outcome } : {}),
      },
      orderBy: { entryDate: 'desc' },
      populate: { author: { select: ['id', 'username'] }, screenshots: true },
    });

    const isPublicRow = (row: any) =>
      row?.isPublic === true ||
      row?.isPublic === 1 ||
      row?.isPublic === '1' ||
      row?.isPublic === 'true';

    const publicRows = (allRows as any[]).filter(isPublicRow);
    const total = publicRows.length;
    const offset = (Number(page) - 1) * Number(pageSize);
    const trades = publicRows.slice(offset, offset + Number(pageSize));

    strapi.log.info(`[journal-trade.publicFeed] totalRows=${(allRows as any[]).length} publicRows=${publicRows.length} page=${Number(page)} pageSize=${Number(pageSize)}`);

    ctx.body = {
      data: trades,
      meta: {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          pageCount: Math.ceil(total / Number(pageSize)),
        },
      },
    };
  },

  async findOne(ctx) {
    const result = await super.findOne(ctx);
    const trade = (result as any)?.data;
    if (!trade) return result;

    // Check access: public trades are accessible to all, private only to owner
    const user = ctx.state.user;
    if (!trade.isPublic) {
      if (!user?.id || Number(trade.author?.id) !== Number(user.id)) {
        return ctx.forbidden('This trade is private');
      }
    }

    return result;
  },
}));
