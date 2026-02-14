import type { Core } from '@strapi/strapi';

const PAGE_UID = 'api::page.page' as any;

type PageRow = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  ftType: 'front' | 'footer';
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

const toAdminPage = (row: PageRow, isPublished: boolean) => ({
  id: row.id,
  documentId: row.documentId,
  title: row.title,
  slug: row.slug,
  content: row.content,
  ftType: row.ftType,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  publishedAt: isPublished ? row.publishedAt : null,
  isPublished,
});

const pickPreferredRow = (rows: PageRow[]) => {
  const draft = rows.find((item) => !item.publishedAt);
  return draft || rows[0];
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx) {
    const queryFilters = (ctx.query?.filters || {}) as Record<string, any>;
    const where: Record<string, any> = {};

    if (queryFilters.title?.$containsi) {
      where.title = { $containsi: queryFilters.title.$containsi };
    }
    if (queryFilters.ftType?.$eq) {
      where.ftType = { $eq: queryFilters.ftType.$eq };
    }
    if (typeof queryFilters.publishedAt?.$null === 'boolean') {
      where.publishedAt = queryFilters.publishedAt.$null ? { $null: true } : { $notNull: true };
    }

    const rows = (await strapi.db.query(PAGE_UID).findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: ['id', 'documentId', 'title', 'slug', 'content', 'ftType', 'createdAt', 'updatedAt', 'publishedAt'],
    })) as PageRow[];

    const grouped = new Map<string, PageRow[]>();
    for (const row of rows) {
      const key = String(row.documentId || '');
      if (!key) continue;
      const list = grouped.get(key) || [];
      list.push(row);
      grouped.set(key, list);
    }

    const data = Array.from(grouped.values()).map((group) => {
      const preferred = pickPreferredRow(group);
      const isPublished = group.some((item) => Boolean(item.publishedAt));
      return toAdminPage(preferred, isPublished);
    });

    ctx.body = {
      data,
      meta: {
        pagination: {
          total: data.length,
        },
      },
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const rows = (await strapi.db.query(PAGE_UID).findMany({
      where: { documentId: id },
      orderBy: [{ updatedAt: 'desc' }],
      select: ['id', 'documentId', 'title', 'slug', 'content', 'ftType', 'createdAt', 'updatedAt', 'publishedAt'],
    })) as PageRow[];

    if (!rows || rows.length === 0) {
      return ctx.notFound('Page not found');
    }

    const preferred = pickPreferredRow(rows);
    const isPublished = rows.some((item) => Boolean(item.publishedAt));

    ctx.body = { data: toAdminPage(preferred, isPublished) };
  },

  async create(ctx) {
    const payload = (ctx.request.body?.data || {}) as Record<string, any>;
    const isPublished = Boolean(payload.isPublished);
    delete payload.isPublished;

    const created = await strapi.documents(PAGE_UID).create({
      data: payload,
    });

    if (isPublished) {
      await strapi.documents(PAGE_UID).update({
        documentId: created.documentId,
        status: 'published',
        data: payload,
      } as any);
    }

    const rows = (await strapi.db.query(PAGE_UID).findMany({
      where: { documentId: created.documentId },
      orderBy: [{ updatedAt: 'desc' }],
      select: ['id', 'documentId', 'title', 'slug', 'content', 'ftType', 'createdAt', 'updatedAt', 'publishedAt'],
    })) as PageRow[];

    const preferred = pickPreferredRow(rows);
    const published = rows.some((item) => Boolean(item.publishedAt));
    ctx.body = { data: toAdminPage(preferred, published) };
  },

  async update(ctx) {
    const { id } = ctx.params;
    const payload = (ctx.request.body?.data || {}) as Record<string, any>;
    const wantsPublished =
      typeof payload.isPublished === 'boolean' ? Boolean(payload.isPublished) : null;
    delete payload.isPublished;

    await strapi.documents(PAGE_UID).update({
      documentId: id,
      data: payload,
    });

    if (wantsPublished === true) {
      await strapi.documents(PAGE_UID).update({
        documentId: id,
        status: 'published',
        data: payload,
      } as any);
    }

    if (wantsPublished === false) {
      const docsApi = strapi.documents(PAGE_UID) as any;
      if (typeof docsApi.unpublish === 'function') {
        await docsApi.unpublish({ documentId: id });
      } else {
        await strapi.db.query(PAGE_UID).updateMany({
          where: { documentId: id, publishedAt: { $notNull: true } },
          data: { publishedAt: null },
        });
      }
    }

    const rows = (await strapi.db.query(PAGE_UID).findMany({
      where: { documentId: id },
      orderBy: [{ updatedAt: 'desc' }],
      select: ['id', 'documentId', 'title', 'slug', 'content', 'ftType', 'createdAt', 'updatedAt', 'publishedAt'],
    })) as PageRow[];

    if (!rows || rows.length === 0) {
      return ctx.notFound('Page not found');
    }

    const preferred = pickPreferredRow(rows);
    const published = rows.some((item) => Boolean(item.publishedAt));
    ctx.body = { data: toAdminPage(preferred, published) };
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const data = await strapi.documents(PAGE_UID).delete({
      documentId: id,
    });

    ctx.body = { data };
  },
});

