"use client";

import { X } from "lucide-react";

export interface StockRequestItem {
  id: string;
  quantity: number;
  received_at: string | null;
  books: { title: string; cover_url?: string | null } | null;
}

interface StockRequestItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StockRequestItem[];
  title?: string;
  children?: (item: StockRequestItem, index: number) => React.ReactNode;
}

export default function StockRequestItemsModal({
  isOpen,
  onClose,
  items,
  title = "Libros en solicitud",
  children,
}: StockRequestItemsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="sticky top-0 z-10 bg-[#1a1a1a] flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          {items.map((item, i) =>
            children ? (
              children(item, i)
            ) : (
              <div key={item.id} className="flex items-center gap-3">
                {item.books?.cover_url && (
                  <img src={item.books.cover_url} alt="" className="w-8 h-12 rounded object-cover bg-white/5 shrink-0" />
                )}
                <span className="text-white/80 text-sm flex-1 min-w-0 truncate">
                  {item.books?.title ?? "Libro"}
                </span>
                <span className="text-white font-medium text-sm shrink-0">x{item.quantity}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                  item.received_at
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-white/5 text-white/30 border border-white/10"
                }`}>
                  {item.received_at ? "Recibido" : "No recibido"}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
