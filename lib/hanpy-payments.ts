/**
 * 한피 결제 허브 클라이언트 — 서비스 백엔드(서버 코드)에 이 파일을 그대로 복사해 쓴다.
 * 원본: hanpy-kr/hanpy-api 의 clients/hanpy-payments.ts (허브 테스트가 이 파일로 실제 서버를 호출해 검증한다)
 *
 * - 의존성 없음 (Node 18+ 의 fetch, node:crypto)
 * - 브라우저 코드에서 import 하지 않는다. 서비스 토큰이 노출된다
 * - 사용법: docs/payments-integration.md
 * - 버전: payments v2 (2026-11-16). 바뀐 내용은 허브 레포 CHANGELOG.md
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type HanpyServiceKey = 'invitation' | 'math' | 'oneultalk' | 'hapyebo' | 'wedding' | 'toss-apps';

export type HanpyOrderStatus = 'pending' | 'paid' | 'cancel_requested' | 'refunded' | 'canceled' | 'expired';

/** 대상 단위 이용권이 붙는 대상. 예: { type: 'invitation', id: 초대장 ID } */
export interface HanpySubject {
  type: string;
  id: string;
}

export interface HanpyOrder {
  orderId: string;
  /** 그로블 결제 링크의 ?ref= 값 (hp-…) */
  ref: string;
  service: string;
  sku: string;
  /** 구매자 (서비스의 사용자 ID) */
  customerRef: string;
  /** 대상 단위 상품이면 대상, 사람 단위면 null */
  subject: HanpySubject | null;
  /** 원 단위 정수 */
  amount: number;
  currency: string;
  status: HanpyOrderStatus;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
}

export interface HanpyEntitlement {
  key: string;
  orderId: string;
  /** 대상 단위 이용권이면 대상, 사람 단위면 null */
  subject: HanpySubject | null;
  validFrom: string;
  /** null 이면 기간 제한 없음 */
  validUntil: string | null;
}

export interface HanpyProduct {
  sku: string;
  name: string;
  /** 원 단위 정수. 화면 가격은 이 값을 쓴다 */
  amount: number;
  currency: 'KRW';
  /** false 면 새 결제를 받지 않는다 (checkout 이 409 PRODUCT_NOT_ON_SALE) */
  onSale: boolean;
  /** subjectType 이 있으면 대상 단위 상품 (checkout 에 같은 종류의 subject 필수) */
  grants: { key: string; days: number | null; subjectType: string | null };
}

export interface HanpyCheckout {
  order: HanpyOrder;
  /** 사용자를 이 주소(그로블 결제창)로 보낸다 */
  action: { type: 'redirect'; url: string };
}

export type HanpyNotificationType = 'payment.paid' | 'payment.cancel_requested' | 'payment.refunded';

export interface HanpyNotification {
  type: HanpyNotificationType;
  occurredAt: string;
  order: HanpyOrder;
}

/**
 * 허브가 돌려준 오류. 화면 분기는 code 로 한다.
 * checkout: ALREADY_ENTITLED(이미 이용권 있음), PRODUCT_NOT_ON_SALE, PRODUCT_NOT_FOUND, PAYMENT_UNAVAILABLE,
 * IDEMPOTENCY_KEY_REUSED, VALIDATION_FAILED. 조회: NOT_FOUND. 공통: UNAUTHENTICATED
 */
export class HanpyApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'HanpyApiError';
  }
}

export interface HanpyPaymentsConfig {
  /** 예: https://api.han-py.com */
  origin: string;
  service: HanpyServiceKey;
  /** 서비스 토큰 원문 (환경변수에서) */
  token: string;
  timeoutMs?: number;
}

export function createHanpyPayments(config: HanpyPaymentsConfig) {
  const origin = config.origin.replace(/\/+$/, '');
  const timeoutMs = config.timeoutMs ?? 10_000;

  async function call<T>(method: 'GET' | 'POST', path: string, init: { body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.token}`,
      'x-hanpy-service': config.service,
      accept: 'application/json',
    };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (init.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;

    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const requestId = response.headers.get('x-request-id') ?? undefined;
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const problem = (data ?? {}) as { code?: string; title?: string };
      throw new HanpyApiError(response.status, problem.code ?? 'UNKNOWN', requestId, problem.title ?? `HTTP ${response.status}`);
    }
    return data as T;
  }

  async function getEntitlementsOf(query: string): Promise<HanpyEntitlement[]> {
    return (await call<{ items: HanpyEntitlement[] }>('GET', `/v1/payments/entitlements?${query}`)).items;
  }

  return {
    /**
     * 결제 시작. idempotencyKey 는 "이 결제 시도" 하나에 하나 (예: crypto.randomUUID() 를 만들어 두고 재시도 때 같은 값).
     * 같은 키로 다시 부르면 처음 만든 주문을 돌려준다.
     * 대상 단위 상품이면 subject 를 넣는다. 그 대상(사람 단위면 그 사람)에 기간 제한 없는 같은 이용권이 이미 있으면 ALREADY_ENTITLED.
     */
    checkout(input: { sku: string; customerRef: string; subject?: HanpySubject; idempotencyKey: string }): Promise<HanpyCheckout> {
      return call('POST', '/v1/payments/checkout', {
        body: { sku: input.sku, customerRef: input.customerRef, ...(input.subject ? { subject: input.subject } : {}) },
        idempotencyKey: input.idempotencyKey,
      });
    },

    /** 이 서비스의 상품과 가격 (판매 중지 포함) */
    async listProducts(): Promise<HanpyProduct[]> {
      return (await call<{ items: HanpyProduct[] }>('GET', '/v1/payments/products')).items;
    },

    getOrder(orderId: string): Promise<HanpyOrder> {
      return call('GET', `/v1/payments/orders/${encodeURIComponent(orderId)}`);
    },

    /** 주문 목록 (최신순, 기본 20개·최대 100개). customerRef 와 subject 중 하나 이상 */
    async listOrders(filter: {
      customerRef?: string;
      subject?: HanpySubject;
      status?: HanpyOrderStatus;
      limit?: number;
    }): Promise<HanpyOrder[]> {
      const q = new URLSearchParams();
      if (filter.customerRef) q.set('customerRef', filter.customerRef);
      if (filter.subject) {
        q.set('subjectType', filter.subject.type);
        q.set('subjectId', filter.subject.id);
      }
      if (filter.status) q.set('status', filter.status);
      if (filter.limit) q.set('limit', String(filter.limit));
      return (await call<{ items: HanpyOrder[] }>('GET', `/v1/payments/orders?${q}`)).items;
    },

    /** 사람 단위로 지금 유효한 이용 권한 (대상 단위 이용권은 포함하지 않는다) */
    getEntitlements(customerRef: string): Promise<HanpyEntitlement[]> {
      return getEntitlementsOf(new URLSearchParams({ customerRef }).toString());
    },

    async hasEntitlement(customerRef: string, key: string): Promise<boolean> {
      return (await this.getEntitlements(customerRef)).some((e) => e.key === key);
    },

    /** 대상 단위로 지금 유효한 이용 권한. 대상 여러 개(최대 100)를 한 번에 */
    getSubjectEntitlements(subjectType: string, subjectIds: readonly string[]): Promise<HanpyEntitlement[]> {
      if (subjectIds.length === 0) return Promise.resolve([]);
      return getEntitlementsOf(new URLSearchParams({ subjectType, subjectIds: subjectIds.join(',') }).toString());
    },

    async hasSubjectEntitlement(subject: HanpySubject, key: string): Promise<boolean> {
      return (await this.getSubjectEntitlements(subject.type, [subject.id])).some((e) => e.key === key);
    },
  };
}

export type HanpyPayments = ReturnType<typeof createHanpyPayments>;

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined;
  const value = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 허브가 보낸 결제 알림이 진짜인지 확인한다. rawBody 는 받은 본문 문자열 그대로 (JSON.parse 전).
 * ok 면 event.order 로 처리하고 2xx 로 답한다. 같은 알림이 다시 올 수 있으니 eventId 로 중복을 거른다.
 */
export function verifyHanpyNotification(input: {
  rawBody: string;
  headers: HeaderSource;
  secret: string;
  toleranceSec?: number;
  nowMs?: number;
}):
  | { ok: true; eventId: string; event: HanpyNotification }
  | { ok: false; reason: 'MISSING_HEADER' | 'EXPIRED' | 'BAD_SIGNATURE' | 'BAD_BODY' } {
  const eventId = readHeader(input.headers, 'x-hanpy-event-id');
  const timestamp = readHeader(input.headers, 'x-hanpy-timestamp');
  const signature = readHeader(input.headers, 'x-hanpy-signature');
  if (!eventId || !timestamp || !signature) return { ok: false, reason: 'MISSING_HEADER' };

  const ts = Number(timestamp);
  const nowSec = (input.nowMs ?? Date.now()) / 1000;
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > (input.toleranceSec ?? 300)) return { ok: false, reason: 'EXPIRED' };

  const expected = Buffer.from(createHmac('sha256', input.secret).update(`${timestamp}.${input.rawBody}`).digest('hex'));
  const given = Buffer.from(signature.trim().toLowerCase());
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'BAD_SIGNATURE' };

  try {
    return { ok: true, eventId, event: JSON.parse(input.rawBody) as HanpyNotification };
  } catch {
    return { ok: false, reason: 'BAD_BODY' };
  }
}
