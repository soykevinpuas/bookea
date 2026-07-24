// Inventario fisico activo asignado a un vendedor.
export interface SellerInventory {
  id: string;
  seller_id: string;
  book_id: string;
  quantity: number;
  updated_at: string;
  books?: BookInventoryInfo | null;
}

// Datos minimos de libro embebidos en inventario, ventas y solicitudes.
export interface BookInventoryInfo {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  price_physical: number;
  acquisition_cost?: number;
}

// Venta reportada por vendedor y liquidable por admin.
export interface SellerSale {
  id: string;
  seller_id: string;
  book_id: string;
  quantity: number;
  sale_price: number;
  acquisition_cost: number;
  sold_at: string;
  paid_at: string | null;
  books?: BookInventoryInfo | null;
}

// Solicitud de reposicion de stock creada por vendedor.
export interface StockRequest {
  id: string;
  seller_id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: StockRequestItem[];
  seller?: { id: string; email: string } | null;
}

// Linea de libro/cantidad dentro de una solicitud de stock.
export interface StockRequestItem {
  id: string;
  request_id: string;
  book_id: string;
  quantity: number;
  received_at: string | null;
  books?: BookInventoryInfo | null;
}

// Resumen operativo de vendedor para vistas admin.
export interface AdminSellerInfo {
  id: string;
  email: string;
  role: string;
  created_at: string;
  inventory_count: number;
  total_assigned: number;
  total_sold: number;
}
