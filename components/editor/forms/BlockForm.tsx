'use client'

import type { BlockConfigMap, BlockType } from '@/shared/blocks'
import type { EditorBlock } from '@/shared/invitation'

import CoverForm from './CoverForm'
import GalleryForm from './GalleryForm'
import GreetingForm from './GreetingForm'
import GuestbookForm from './GuestbookForm'
import LocationForm from './LocationForm'
import RsvpForm from './RsvpForm'

type AnyUpdater = (fn: (c: EditorBlock['config']) => EditorBlock['config']) => void

/** 블록 종류에 맞는 updater로 좁힘 (config 타입은 block.type과 항상 짝이 맞는다) */
const as = <K extends BlockType>(update: AnyUpdater) =>
  update as unknown as (fn: (c: BlockConfigMap[K]) => BlockConfigMap[K]) => void

export default function BlockForm({ block, update }: { block: EditorBlock; update: AnyUpdater }) {
  switch (block.type) {
    case 'cover':
      return <CoverForm config={block.config} update={as<'cover'>(update)} />
    case 'greeting':
      return <GreetingForm config={block.config} update={as<'greeting'>(update)} />
    case 'gallery':
      return <GalleryForm config={block.config} update={as<'gallery'>(update)} />
    case 'location':
      return <LocationForm config={block.config} update={as<'location'>(update)} />
    case 'rsvp':
      return <RsvpForm config={block.config} update={as<'rsvp'>(update)} />
    case 'guestbook':
      return <GuestbookForm config={block.config} update={as<'guestbook'>(update)} />
  }
}
