'use client'

import { createContext, useContext } from 'react'

export type EditorEnv = {
  invitationId: string
  mediaBaseUrl: string
  kakaoJsKey: string
  /** 사진 업로드 가능 여부 (R2 또는 로컬 우회) */
  uploadEnabled: boolean
  /** 카카오 주소 검색 가능 여부 */
  geoSearchEnabled: boolean
  /** 지금 블록에 들어 있는 사진 수 (한도 계산용) */
  photoCount: number
}

const EditorEnvContext = createContext<EditorEnv | null>(null)

export const EditorEnvProvider = EditorEnvContext.Provider

export function useEditorEnv(): EditorEnv {
  const env = useContext(EditorEnvContext)
  if (!env) throw new Error('EditorEnvProvider가 필요합니다.')
  return env
}
