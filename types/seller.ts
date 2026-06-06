export interface SellerInventory {
  id: string;
  seller_id: string;
  book_id: string;
  quantity: number;
  updated_at: string;
  books?: BookInventoryInfo | null;
}

export interface BookInventoryInfo {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  price_physical: number;
}

export interface SellerSale {
  id: string;
  seller_id: string;
  book_id: string;
  quantity: number;
  sale_price: number;
  sold_at: string;
  books?: BookInventoryInfo | null;
}

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

export interface StockRequestItem {
  id: string;
  request_id: string;
  book_id: string;
  quantity: number;
  received_at: string | null;
  books?: BookInventoryInfo | null;
}

export interface AdminSellerInfo {
  id: string;
  email: string;
  role: string;
  created_at: string;
  inventory_count: number;
  total_assigned: number;
  total_sold: number;
}
