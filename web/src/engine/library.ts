import manifestJson from '../library/manifest.json'

/**
 * The illustration library, built from the Figma exports by scripts/build-library.mjs.
 * Objects never change shape here: the app only places, orders and recolours them.
 */

/** Colour roles of a palette. Objects are stored with roles instead of hex, a palette maps roles back to colours. */
export const ROLES = ['bg1', 'bg2', 'bg3', 'ink', 'obj1', 'obj2', 'obj3', 'white'] as const
export type Role = (typeof ROLES)[number]
export type Colors = Record<Role, string>

/** Roles that may appear on the background; object roles (obj1–3) never do. */
export const BG_ROLES: Role[] = ['bg1', 'bg2', 'bg3']
export const OBJ_ROLES: Role[] = ['obj1', 'obj2', 'obj3']

export type Size = 'large' | 'small'
export type State = 'main' | 'bg'
export type Kind = 'flat' | 'tall' | 'medium' | 'small'
export type TileStyle = 'dots' | 'corner'
export type Corner = 'tl' | 'tr' | 'bl' | 'br'

export interface MaskInfo {
  cols: number
  rows: number
  /** scene units per mask cell */
  cell: number
  filled: number
  /** bit-packed occupancy, row-major, base64 */
  bits: string
}

export interface LibObject {
  id: string
  name: string
  kind: Kind
  synonyms: string[]
  meanings: string[]
  sizes: Record<Size, { w: number; h: number; mask: MaskInfo }>
}

export interface Palette {
  id: string
  name: string
  tile: TileStyle
  colors: Colors
  custom?: boolean
}

interface Manifest {
  schemes: Palette[]
  objects: Record<string, LibObject>
  decor: Record<TileStyle, Record<Size, { tile: number; groups: Partial<Record<Corner, string>> }>>
}

export const manifest = manifestJson as unknown as Manifest
export const OBJECTS: LibObject[] = Object.values(manifest.objects)
export const SCHEMES: Palette[] = manifest.schemes
export const objectById = (id: string) => manifest.objects[id]

/** Path markup of every object, keyed `${id}:${state}`; one file per size, loaded on demand. */
export type Bodies = Record<string, string>

const cache: Partial<Record<Size, Promise<Bodies>>> = {}
export function loadBodies(size: Size): Promise<Bodies> {
  cache[size] ??= (size === 'large' ? import('../library/bodies-large.json') : import('../library/bodies-small.json')).then(
    (m) => m.default as Bodies,
  )
  return cache[size]
}

export const SIZE_LABEL: Record<Size, string> = { large: 'Крупный', small: 'Мелкий' }
export const STATE_LABEL: Record<State, string> = { main: 'главный', bg: 'фоновый' }
