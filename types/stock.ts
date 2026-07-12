import type { SellerSale } from "@/types/seller";

// Datos minimos de libro incluidos en snapshots/eventos de stock.
export interface StockBookInfo {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  price_physical: number | null;
}

// Snapshot canonico devuelto por las RPCs de stock despues de cada mutacion.
export interface StockSnapshot {
  admin_id: string | null;
  seller_id: string | null;
  seller_email: string | null;
  book_id: string;
  book: StockBookInfo | null;
  warehouse_quantity: number;
  assigned_quantity: number;
  seller_quantity: number;
  seller_total_quantity: number;
  seller_inventory_count: number;
  total_physical: number;
  updated_at: string;
  version: string;
}

// Evento de stock publicado por Realtime y tambien incluido en respuestas RPC.
export interface StockEventPayload {
  id: string;
  action: string;
  snapshot_after?: StockSnapshot | null;
}

// Respuesta comun de RPCs de stock; mantiene campos legacy y agrega snapshots.
export interface StockMutationResult {
  success: boolean;
  error?: string;
  assigned?: number;
  removed?: number;
  restored?: number;
  adjusted?: number;
  mutation_id?: string;
  snapshots?: StockSnapshot[];
  events?: StockEventPayload[];
  sale?: SellerSale & { admin_id?: string | null };
}
