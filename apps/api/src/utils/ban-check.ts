import type { Core } from '@strapi/strapi';

export async function checkBan(strapi: Core.Strapi, user: any, ctx: any): Promise<boolean> {
  if (!user?.banned) return false;

  if (user.bannedUntil && new Date(user.bannedUntil) < new Date()) {
    // Expired → auto-unban
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { banned: false, bannedUntil: null, banReason: null },
    });
    return false;
  }

  const until = user.bannedUntil
    ? ` đến ${new Date(user.bannedUntil).toLocaleDateString('vi-VN')}`
    : ' vĩnh viễn';
  ctx.forbidden(`Tài khoản bị hạn chế${until}`);
  return true;
}
