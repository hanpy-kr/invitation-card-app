import 'server-only'

import { createHanpyPayments } from './hanpy-payments'

/** 한피 결제 허브 클라이언트 (서버 전용). 토큰 · 주소는 환경변수에서만 읽는다 */
export const hanpy = createHanpyPayments({
  origin: process.env.HANPY_API_ORIGIN ?? '',
  service: 'invitation',
  token: process.env.HANPY_SERVICE_TOKEN ?? '',
})
