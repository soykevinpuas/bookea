/**
 * Tipos parciales para epub.js.
 * Cubren solo la superficie que usa el lector y reducen casts en nuevos cambios.
 */

// Instancia principal del libro EPUB.
export interface EpubBook {
  id?: string;
  pack?: string;
  open?: (data: ArrayBuffer | string, type: string) => Promise<EpubBook>;
  destroy?: () => void;
}

// Controlador de renderizado de epubjs.
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

// Documento/iframe de una seccion renderizada.
export interface EpubContents {
  dom?: Document | null;
  document?: Document | null;
  iframe?: HTMLIFrameElement | null;
  window?: Window | null;
  href?: string;
  location?: { start?: { cfi?: string } };
  range?: (cfi: string) => Range | null;
  beforeLongPress?: { call?: (data: EpubGestureData) => void };
  on?: (event: string, callback: (...args: unknown[]) => void) => EpubContents;
  off?: (event: string, callback: (...args: unknown[]) => void) => EpubContents;
  onSelection?: {
    call?: (data: EpubSelectionData) => void;
  };
}

// Item del spine interno de epubjs.
export interface EpubSpineItem {
  href?: string;
  id?: string;
  index?: number;
}

// Posicion reportada por epubjs.
export interface EpubLocation {
  cfi?: string;
  displayed?: { page?: number; total?: number };
  index?: number;
}

// Datos de gestos tactiles dentro del iframe.
export interface EpubGestureData {
  x?: number;
  y?: number;
  target?: EventTarget;
  preventDefault?: () => void;
}

// Datos de seleccion de texto para highlights.
export interface EpubSelectionData {
  cfiRange?: string;
  selection?: Selection | null;
  contents?: EpubContents;
}

// Eventos relevantes del lector.
export interface EpubEvents {
  'book-ready': () => void;
  'rendition-ready': () => void;
  'rendition-mounted': () => void;
  'location-changed': (location: { start: { cfi: string } }) => void;
  'selected': (cfi: string) => void;
  'markClicked': (cfi: string) => void;
  'renderer': (contents: EpubContents) => void;
}

// Preferencias visuales del lector.
export interface BookPreferences {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'sepia';
  lineHeight: number;
  textAlign: 'justify' | 'left';
}

// Alias mantenidos para imports legacy.
export type EpubBookInstance = EpubBook;
export type EpubRenditionInstance = EpubRendition;
export type EpubContentsInstance = EpubContents;
