import 'server-only'

import { desc, eq } from 'drizzle-orm'

import { getDb, schema } from './db/client'

/** 내 초대장 목록 (쿼리 1회) */
export async function listMyInvitations(userId: string) {
  return getDb()
    .select({
      id: schema.invitations.id,
      slug: schema.invitations.slug,
      title: schema.invitations.title,
      eventType: schema.invitations.eventType,
      eventAt: schema.invitations.eventAt,
      status: schema.invitations.status,
      updatedAt: schema.invitations.updatedAt,
    })
    .from(schema.invitations)
    .where(eq(schema.invitations.ownerId, userId))
    .orderBy(desc(schema.invitations.updatedAt))
}
