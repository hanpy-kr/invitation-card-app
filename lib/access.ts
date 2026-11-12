import 'server-only'

import { and, eq, inArray, or } from 'drizzle-orm'

import { getDb, schema } from './db/client'
import { derivedPremiumSql, planOf } from './plan'

const { invitations: inv, invitationEditors: editors } = schema

/**
 * 초대장 접근 권한 — '소유자 또는 편집자' 확인은 전부 여기 도우미로.
 * 삭제 · 편집자 관리 · 복제는 소유자만(isOwnerOf).
 * 주의: 단일 테이블 서브쿼리의 컬럼은 테이블 이름 없이 렌더링된다. 각 서브쿼리는 자기 FROM 테이블 컬럼만 쓴다.
 */
const editorInvitationIds = (userId: string) =>
  getDb()
    .select({ invitationId: editors.invitationId })
    .from(editors)
    .where(eq(editors.userId, userId))

/** invitations 테이블 WHERE 조건: 이 사용자가 고칠 수 있는 초대장 */
export function canEditWhere(userId: string) {
  return or(eq(inv.ownerId, userId), inArray(inv.id, editorInvitationIds(userId)))
}

/** 다른 테이블(rsvps · blocks 등)의 invitation_id IN (...) 용 서브쿼리 */
export function editableInvitationIds(userId: string) {
  return getDb().select({ id: inv.id }).from(inv).where(canEditWhere(userId))
}

/** 초대장 하나: 고칠 수 있으면 { ownerId, isOwner }, 아니면 null */
export async function getAccess(invitationId: string, userId: string) {
  const [row] = await getDb()
    .select({
      ownerId: inv.ownerId,
      ownerAnonymous: schema.users.anonymous,
      createdAt: inv.createdAt,
      premiumOrderId: inv.premiumOrderId,
      derivedPremium: derivedPremiumSql(),
    })
    .from(inv)
    .innerJoin(schema.users, eq(schema.users.id, inv.ownerId))
    .where(and(eq(inv.id, invitationId), canEditWhere(userId)))
  return row
    ? {
        ownerId: row.ownerId,
        isOwner: row.ownerId === userId,
        /** 소유자가 로그인 없이 시작한 임시 사용자 (사진 한도 · 발행 제한) */
        ownerAnonymous: row.ownerAnonymous,
        /** 결제 플랜 (사진 한도 등 권한 계산용) */
        plan: planOf(row),
      }
    : null
}
