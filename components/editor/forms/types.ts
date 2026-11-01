import type { BlockConfigMap, BlockType } from '@/shared/blocks'

export type FormProps<K extends BlockType> = {
  config: BlockConfigMap[K]
  update: (fn: (config: BlockConfigMap[K]) => BlockConfigMap[K]) => void
}

/** 일부 필드만 바꾸는 도우미 */
export function patcher<C>(update: (fn: (config: C) => C) => void) {
  return (patch: Partial<C>) => update((c) => ({ ...c, ...patch }))
}
