/**
 * 4.1 - Tipos para epub.js
 * Define interfaces tipadas para evitar el uso de `any`
 */

export interface EpubBook {
  id?: string;
  pack?: string;
  open?: (data: ArrayBuffer | string, type: string) => Promise<EpubBook>;
  destroy?: () => void;
}

export interface EpubRendition {
  display?: (target?: string | HTMLElement) => Promise<void>;
  on?: (event: string, callback: (...args: unknown[]) => void) => EpubRendition;
  off?: (event: string, callback: (...args: unknown[]) => void) => EpubRendition;
  themes?: {
    register?: (name: string, data: Record<string, string>) => void;
    select?: (name: string) => void;
    override?: (name: string, value: string) => void;
  };
  move?: (spineItem: string) => void;
  clear?: () => void;
  getContents?: () => EpubContents[];
  settings?: Record<string, unknown>;
  spine?: {
    items?: EpubSpineItem[];
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
  };
  location?: {
    start?: EpubLocation;
    current?: EpubLocation;
  };
}

export interface EpubContents {
  dom?: Document | null;
  document?: Document | null;
  iframe?: HTMLIFrameElement | null;
  window?: Window | null;
  href?: string;
  location?: { start?: { cfi?: string } };
  beforeLongPress?: { call?: (data: EpubGestureData) => void };
  on?: (event: string, callback: (...args: unknown[]) => void) => EpubContents;
  off?: (event: string, callback: (...args: unknown[]) => void) => EpubContents;
  onSelection?: {
    call?: (data: EpubSelectionData) => void;
  };
}

export interface EpubSpineItem {
  href?: string;
  id?: string;
  index?: number;
}

export interface EpubLocation {
  cfi?: string;
  displayed?: { page?: number; total?: number };
  index?: number;
}

export interface EpubGestureData {
  x?: number;
  y?: number;
  target?: EventTarget;
  preventDefault?: () => void;
}

export interface EpubSelectionData {
  cfiRange?: string;
  selection?: Selection | null;
  contents?: EpubContents;
}

export interface EpubEvents {
  'book-ready': () => void;
  'rendition-ready': () => void;
  'rendition-mounted': () => void;
  'location-changed': (location: { start: { cfi: string } }) => void;
  'selected': (cfi: string) => void;
  'markClicked': (cfi: string) => void;
  'renderer': (contents: EpubContents) => void;
}

export interface BookPreferences {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'sepia';
  lineHeight: number;
  textAlign: 'justify' | 'left';
}

// Alias para compatibilidad
export type EpubBookInstance = EpubBook;
export type EpubRenditionInstance = EpubRendition;
export type EpubContentsInstance = EpubContents;