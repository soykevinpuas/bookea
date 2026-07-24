"use client";

import AppImage from "@/components/ui/AppImage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { applyStockMutationResult, getStockSnapshots, STOCK_QUERY_OPTIONS } from "@/lib/stock-cache";
import type { StockMutationResult } from "@/types/stock";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X,
  Upload,
  BookOpen,
  Loader2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  ImageIcon,
  FileText,
  Plus,
  Minus,
} from "lucide-react";
import BookPreviewModal from "@/components/BookPreviewModal";

interface Book {
  id: string;
  title: string;
  author: string;
  author_id?: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  slug: string;
  epub_url: string | null;
  price_digital: number;
  price_physical: number;
  acquisition_cost: number;
  price_bundle: number | null;
  stock_physical: number;
  stock_total: number;
  stock_warehouse: number;
  stock_assigned: number;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

type FormData = Omit<Book, "id" | "created_at"> & { id?: string; newAuthor?: string };
type BookPayload = Record<string, string | number | boolean | null | undefined>;
type StockAdjustmentVariables = { id: string; stockDelta: number };
type StockAdjustmentContext = { previousBooks?: Book[] };
type StockLock = Pick<Book, "stock_physical" | "stock_total" | "stock_warehouse" | "stock_assigned"> & {
  expiresAt: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado";
}

const EMPTY_FORM: FormData = {
  title: "",
  slug: "",
  author: "",
  author_id: undefined,
  description: "",
  category: "",
  cover_url: "",
  epub_url: "",
  price_digital: 0,
  price_physical: 199,
  acquisition_cost: 100,
  price_bundle: null,
  stock_physical: 0,
  stock_total: 0,
  stock_warehouse: 0,
  stock_assigned: 0,
  is_active: true,
  is_premium: true,
};

const CATEGORIES = [
  "Ficción", "No Ficción", "Novela", "Clásicos", "Misterio y Suspenso",
  "Fantasía", "Ciencia Ficción", "Romance", "Terror", "Autoayuda",
  "Negocios y Finanzas", "Historia", "Biografías", "Cuentos", "Poesía", "Otros"
];

function previewStockAdjustment(books: Book[] | undefined, bookId: string, delta: number) {
  if (!books) return books;

  return books.map((book) => {
    if (book.id !== bookId) return book;

    const nextWarehouse = Math.max(0, book.stock_warehouse + delta);
    const nextTotal = nextWarehouse + book.stock_assigned;

    return {
      ...book,
      stock_physical: nextTotal,
      stock_total: nextTotal,
      stock_warehouse: nextWarehouse,
    };
  });
}

export default function AdminBooksPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<FormData>(EMPTY_FORM);
  const [initialStockPhysical, setInitialStockPhysical] = useState(0);
  const [uploading, setUploading] = useState<"cover" | "epub" | null>(null);
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);
  const [authorBio, setAuthorBio] = useState("");
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState("");
  const [authorPhotoUploading, setAuthorPhotoUploading] = useState(false);
  const authorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [filterTab, setFilterTab] = useState<"all" | "physical" | "no-epub">("all");
  const [stockLoading, setStockLoading] = useState<Set<string>>(new Set());
  const stockWritesRef = useRef(new Set<string>());
  const stockLocksRef = useRef(new Map<string, StockLock>());
  const [previewBook, setPreviewBook] = useState<Book | null>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const res = await fetch("/api/admin/books-stock", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar libros");
      const now = Date.now();
      return (json.books as Book[]).map((book) => {
        const lock = stockLocksRef.current.get(book.id);
        if (!lock) return book;
        if (lock.expiresAt <= now) {
          stockLocksRef.current.delete(book.id);
          return book;
        }
        return { ...book, ...lock };
      });
    },
    ...STOCK_QUERY_OPTIONS,
  });

  const { data: authors = [] } = useQuery({
    queryKey: ["admin-authors"],
    queryFn: async () => {
      const supabase = createClientClient();
      const { data } = await supabase.from("authors").select("id, name, slug, bio, photo_url").order("name");
      return data || [];
    },
  });

  const filteredBooks = filterTab === "all" ? books : books.filter((b) => {
    if (filterTab === "physical") return b.stock_physical > 0;
    if (filterTab === "no-epub") return !b.epub_url;
    return true;
  });

  useEffect(() => {
    if (editingBook.author_id) {
      const author = authors.find(a => a.id === editingBook.author_id);
      if (author) {
        setAuthorBio(author.bio || "");
        setAuthorPhotoUrl(author.photo_url || "");
      }
    } else {
      setAuthorBio("");
      setAuthorPhotoUrl("");
    }
  }, [editingBook.author_id, authors]);

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const supabase = createClientClient();
      const { error } = await supabase.from("books").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-books"] });
      const previous = queryClient.getQueryData<Book[]>(["admin-books"]);
      queryClient.setQueryData<Book[]>(["admin-books"], (old) => old?.map((book) =>
        book.id === id ? { ...book, is_active: isActive } : book
      ));
      return { previous };
    },
    onSuccess: () => {
      toast.success("Estado del libro actualizado");
    },
    onError: (err: unknown, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["admin-books"], context.previous);
      toast.error(`Error: ${getErrorMessage(err)}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-books"], refetchType: "inactive" }),
  });

  const adjustStockMutation = useMutation<StockMutationResult, Error, StockAdjustmentVariables, StockAdjustmentContext>({
    mutationFn: async ({ id, stockDelta }) => {
      const res = await fetch("/api/admin/books-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: id, delta: stockDelta }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al ajustar stock");
      return json as StockMutationResult;
    },
    onMutate: async ({ id, stockDelta }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-books"] });
      const previousBooks = queryClient.getQueryData<Book[]>(["admin-books"]);
      const currentBook = previousBooks?.find((book) => book.id === id);
      if (currentBook) {
        const nextWarehouse = Math.max(0, currentBook.stock_warehouse + stockDelta);
        const nextTotal = nextWarehouse + currentBook.stock_assigned;
        stockLocksRef.current.set(id, {
          stock_physical: nextTotal,
          stock_total: nextTotal,
          stock_warehouse: nextWarehouse,
          stock_assigned: currentBook.stock_assigned,
          expiresAt: Date.now() + 15_000,
        });
      }
      queryClient.setQueryData<Book[]>(["admin-books"], (old) => previewStockAdjustment(old, id, stockDelta));
      setStockLoading((prev) => new Set(prev).add(id));
      return { previousBooks };
    },
    onSuccess: (result) => {
      // El snapshot de la RPC es la fuente confirmada; un refetch inmediato puede
      // leer una réplica atrasada y devolver visualmente el stock al valor anterior.
      const snapshot = getStockSnapshots(result)[0];
      if (snapshot) {
        stockLocksRef.current.set(snapshot.book_id, {
          stock_physical: snapshot.total_physical,
          stock_total: snapshot.total_physical,
          stock_warehouse: snapshot.warehouse_quantity,
          stock_assigned: snapshot.assigned_quantity,
          expiresAt: Date.now() + 15_000,
        });
      }
      applyStockMutationResult(queryClient, result);
    },
    onError: (err: unknown, vars, context) => {
      stockLocksRef.current.delete(vars.id);
      if (context?.previousBooks) queryClient.setQueryData(["admin-books"], context.previousBooks);
      setStockLoading((prev) => { const next = new Set(prev); next.delete(vars.id); return next; });
      toast.error(getErrorMessage(err) || "Error al ajustar stock");
    },
    onSettled: (_result, _error, vars) => {
      stockWritesRef.current.delete(vars.id);
      setStockLoading((prev) => { const next = new Set(prev); next.delete(vars.id); return next; });
    },
  });

  const adjustStock = (book: Book, delta: number) => {
    if (stockWritesRef.current.has(book.id)) return;
    if (delta < 0 && book.stock_warehouse <= 0) return;

    stockWritesRef.current.add(book.id);
    adjustStockMutation.mutate({ id: book.id, stockDelta: delta });
  };

  const openNew = () => {
    setEditingBook(EMPTY_FORM);
    setInitialStockPhysical(0);
    setShowModal(true);
  };

  const openEdit = (book: Book) => {
    setEditingBook({ ...book });
    setInitialStockPhysical(book.stock_physical);
    setShowModal(true);
  };

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
    const supabase = createClientClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "cover" | "epub") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(type);

    try {
      const ext = file.name.split(".").pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      let publicUrl: string;
      if (type === "cover") {
        publicUrl = await uploadFile(file, "covers", uniqueName);
        setEditingBook((prev) => ({ ...prev, cover_url: publicUrl }));
        toast.success("Portada subida");
      } else {
        publicUrl = await uploadFile(file, "epubs", uniqueName);
        setEditingBook((prev) => ({ ...prev, epub_url: publicUrl }));
        toast.success("Archivo EPUB subido");
      }
    } catch (err: unknown) {
      toast.error(`Error al subir ${type === "cover" ? "portada" : "EPUB"}: ${getErrorMessage(err)}`);
    } finally {
      setUploading(null);
    }
  };

  const handleAuthorPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAuthorPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const uniqueName = `authors/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const publicUrl = await uploadFile(file, "covers", uniqueName);
      setAuthorPhotoUrl(publicUrl);
      toast.success("Foto del autor subida");
    } catch (err: unknown) {
      toast.error(`Error al subir foto: ${getErrorMessage(err)}`);
    } finally {
      setAuthorPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingBook.title || !editingBook.author) {
      toast.error("El título y autor son obligatorios.");
      return;
    }

    const desiredStock = Math.max(
      editingBook.stock_assigned || 0,
      Math.floor(Number(editingBook.stock_physical) || 0)
    );
    const stockDelta = desiredStock - initialStockPhysical;

    setSaving(true);
    try {
      const supabase = createClientClient();
      let stockResult: StockMutationResult | null = null;
      let createdNewBook = false;

      // Crear nuevo autor si es necesario
      let authorId = editingBook.author_id;
      if (!authorId && editingBook.newAuthor) {
        const slug = editingBook.newAuthor.toLowerCase().replace(/ /g, "-").replace(/[^\wáéíóúñ-]/g, "");
        const { data: newAuthor, error: createAuthorError } = await supabase
          .from("authors")
          .insert({ name: editingBook.newAuthor, slug, bio: authorBio || null, photo_url: authorPhotoUrl || null })
          .select("id")
          .single();
        if (createAuthorError) throw createAuthorError;
        authorId = newAuthor.id;
        queryClient.invalidateQueries({ queryKey: ["admin-authors"] });
      } else if (!authorId && editingBook.author) {
        // Si tiene nombre pero no es nuevo (select directo), buscar el ID
        const { data: existing } = await supabase
          .from("authors")
          .select("id")
          .eq("name", editingBook.author)
          .single();
        if (existing) authorId = existing.id;
      }

      // Update author bio/photo
      if (authorId) {
        const { error: updateAuthorError } = await supabase
          .from("authors")
          .update({ bio: authorBio || null, photo_url: authorPhotoUrl || null })
          .eq("id", authorId);
        if (updateAuthorError) throw updateAuthorError;
      }

      const payload: BookPayload = {
        title: editingBook.title,
        author: editingBook.author,
        author_id: authorId,
        description: editingBook.description,
        category: editingBook.category,
        cover_url: editingBook.cover_url,
        epub_url: editingBook.epub_url,
        price_digital: Number(editingBook.price_digital),
        price_physical: Number(editingBook.price_physical),
        price_bundle: editingBook.price_bundle ? Number(editingBook.price_bundle) : null,
        is_active: editingBook.is_active,
        is_premium: editingBook.is_premium,
      };

      if (editingBook.id) {
        const { error } = await supabase.from("books").update(payload).eq("id", editingBook.id);
        if (error) throw error;
        const stockRes = await fetch("/api/admin/books-stock", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: editingBook.id,
            acquisitionCost: Math.max(0, Number(editingBook.acquisition_cost) || 0),
            ...(stockDelta !== 0 ? { totalStock: desiredStock } : {}),
          }),
        });
        const stockJson = await stockRes.json();
        if (!stockRes.ok) throw new Error(stockJson.error || "No se pudo guardar el costo o el stock");
        if (stockDelta !== 0) stockResult = stockJson as StockMutationResult;
        queryClient.setQueryData<Book[]>(["admin-books"], (old) => old?.map((book) =>
          book.id === editingBook.id
            ? { ...book, ...payload, acquisition_cost: editingBook.acquisition_cost } as Book
            : book
        ));
        toast.success("Libro actualizado con éxito");
      } else {
        const { data: createdBook, error } = await supabase.from("books").insert(payload).select("id").single();
        if (error) throw error;
        const initialStock = desiredStock;
        if (createdBook?.id) {
          const stockRes = await fetch("/api/admin/books-stock", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: createdBook.id,
              acquisitionCost: Math.max(0, Number(editingBook.acquisition_cost) || 0),
              ...(initialStock > 0 ? { totalStock: initialStock } : {}),
            }),
          });
          const stockJson = await stockRes.json();
          if (!stockRes.ok) throw new Error(stockJson.error || "No se pudo guardar el costo o el stock inicial");
          if (initialStock > 0) stockResult = stockJson as StockMutationResult;
        }
        createdNewBook = true;
        toast.success("Libro creado con éxito");
      }

      applyStockMutationResult(queryClient, stockResult);
      if (createdNewBook) {
        await queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["admin-books"], refetchType: "inactive" });
      }
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 pb-28 sm:p-6 sm:pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 pl-10 md:pl-0">
            <BookOpen className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <span>Libros</span>
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {filteredBooks.length} de {(books || []).length} libro{(books || []).length !== 1 ? "s" : ""}
          </p>

        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Agregar libro
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-0.5 bg-white/5 border border-white/8 rounded-lg mb-4 w-fit">
        {[
          { key: "all" as const, label: "Todos" },
          { key: "physical" as const, label: "Solo Físico" },
          { key: "no-epub" as const, label: "Sin EPUB" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilterTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              filterTab === t.key
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tarjetas: priorizan stock y acciones sin columnas apretadas en móvil. */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay libros en esta categoría.</p>
          <button onClick={openNew} className="mt-4 text-blue-400 hover:underline text-sm">
            Agregar el primero →
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredBooks.map((book) => {
            const updatingStock = stockLoading.has(book.id);
            return (
              <article key={book.id} className="rounded-2xl border border-white/8 bg-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                <div className="flex gap-3">
                  <button onClick={() => setPreviewBook(book)} className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {book.cover_url ? (
                      <AppImage src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="m-auto h-full w-6 text-white/20" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-white">{book.title}</h2>
                        <p className="truncate text-xs text-white/45">{book.author}</p>
                      </div>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: book.id, isActive: !book.is_active })}
                        title={book.is_active ? "Desactivar libro" : "Activar libro"}
                        className="shrink-0"
                      >
                        {book.is_active ? (
                          <ToggleRight className="h-7 w-7 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-white/25" />
                        )}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase">
                      <span className={book.is_premium ? "rounded-full bg-blue-400/10 px-2 py-1 text-blue-400" : "rounded-full bg-green-400/10 px-2 py-1 text-green-400"}>
                        {book.is_premium ? "Premium" : "Gratis"}
                      </span>
                      <span className={book.epub_url ? "rounded-full bg-green-400/10 px-2 py-1 text-green-400" : "rounded-full bg-red-400/10 px-2 py-1 text-red-300"}>
                        {book.epub_url ? "EPUB listo" : "Sin EPUB"}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-white/45">
                        ${book.price_physical}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/50">Stock físico total</p>
                      <p className="text-[10px] text-white/30">
                        {book.stock_warehouse} en almacén
                        {book.stock_assigned > 0 ? ` + ${book.stock_assigned} con vendedores` : ""}
                      </p>
                    </div>
                    {updatingStock && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Guardando
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3">
                    <button
                      onClick={() => adjustStock(book, -1)}
                      disabled={updatingStock || book.stock_warehouse <= 0}
                      aria-label={`Quitar una unidad de ${book.title}`}
                      className="flex h-11 items-center justify-center rounded-xl border border-red-400/15 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <strong className="text-center text-3xl font-black tabular-nums text-white">
                      {book.stock_physical}
                    </strong>
                    <button
                      onClick={() => adjustStock(book, 1)}
                      disabled={updatingStock}
                      aria-label={`Agregar una unidad de ${book.title}`}
                      className="flex h-11 items-center justify-center rounded-xl border border-green-400/15 bg-green-500/10 text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => openEdit(book)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar datos y costo
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal — Add / Edit Book */}
      {showModal && typeof document !== "undefined" && createPortal((
        <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-[#1a1a1a] shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <h2 className="font-bold text-lg">{editingBook.id ? "Editar Libro" : "Agregar Libro"}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Title / Author */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Título *</label>
                  <input
                    value={editingBook.title}
                    onChange={(e) => setEditingBook((p) => ({ ...p, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="El Principito"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Autor *</label>
                  <select
                    value={editingBook.author_id || ""}
                    onChange={(e) => {
                      const selected = authors.find(a => a.id === e.target.value);
                      if (selected) {
                        setEditingBook((p) => ({ ...p, author_id: selected.id, author: selected.name, newAuthor: undefined }));
                      } else {
                        setEditingBook((p) => ({ ...p, author_id: undefined, author: "", newAuthor: "" }));
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="">Seleccionar autor...</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id || ''}>{a.name}</option>
                    ))}
                    <option value="__new__">+ Agregar nuevo autor...</option>
                  </select>
                  {editingBook.author_id === undefined && editingBook.newAuthor !== undefined && (
                    <input
                      value={editingBook.newAuthor || ""}
                      onChange={(e) => setEditingBook((p) => ({ ...p, author: e.target.value, newAuthor: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors mt-2"
                      placeholder="Nombre del nuevo autor"
                    />
                  )}
                </div>
              </div>

              {/* Author Photo & Bio (only for existing authors) */}
              {editingBook.author_id && (
                <div className="col-span-2 space-y-3 p-4 bg-white/5 border border-white/8 rounded-xl">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Autor: {editingBook.author}</p>

                  <div>
                    <label className="text-xs text-white/40 font-medium mb-1.5 block">Foto del autor</label>
                    <button
                      type="button"
                      onClick={() => authorPhotoInputRef.current?.click()}
                      className="w-full h-24 bg-white/5 border border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/8 hover:border-white/25 transition-all text-white/40 hover:text-white/70"
                    >
                      {authorPhotoUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : authorPhotoUrl ? (
                        <AppImage src={authorPhotoUrl} alt={editingBook.author} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-xs">Subir foto</span>
                        </>
                      )}
                    </button>
                    <input
                      ref={authorPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAuthorPhotoUpload}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/40 font-medium mb-1.5 block">Biografía del autor</label>
                    <textarea
                      value={authorBio}
                      onChange={(e) => setAuthorBio(e.target.value)}
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                      placeholder="Biografía del autor..."
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Descripción</label>
                <textarea
                  value={editingBook.description ?? ""}
                  onChange={(e) => setEditingBook((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                  placeholder="Synopsis del libro..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-white/40 font-medium mb-1.5 block">Categoría</label>
                <select
                  value={editingBook.category ?? ""}
                  onChange={(e) => setEditingBook((p) => ({ ...p, category: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Precio Digital (Ref)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingBook.price_digital}
                    onChange={(e) => setEditingBook((p) => ({ ...p, price_digital: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <p className="text-[10px] text-white/25 mt-1">Precio referencial informativo</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Físico (MXN)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingBook.price_physical}
                    onChange={(e) => setEditingBook((p) => ({ ...p, price_physical: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Costo compra</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingBook.acquisition_cost}
                    onChange={(e) => setEditingBook((p) => ({ ...p, acquisition_cost: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <p className="text-[10px] text-white/25 mt-1">Predeterminado $100; acepta $0</p>
                </div>
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Stock total</label>
                  <input
                    type="number"
                    min={editingBook.stock_assigned}
                    value={editingBook.stock_physical}
                    onChange={(e) => setEditingBook((p) => ({
                      ...p,
                      stock_physical: Math.max(p.stock_assigned || 0, Number(e.target.value) || 0),
                    }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  {editingBook.stock_assigned > 0 && (
                    <p className="text-[10px] text-white/25 mt-1">
                      {editingBook.stock_warehouse} en almacén · {editingBook.stock_assigned} con vendedores
                    </p>
                  )}
                </div>
              </div>

              {/* File Uploads */}
              <div className="grid grid-cols-2 gap-3">
                {/* Cover Upload */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Portada</label>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full h-24 bg-white/5 border border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/8 hover:border-white/25 transition-all text-white/40 hover:text-white/70"
                  >
                    {uploading === "cover" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : editingBook.cover_url ? (
                      <AppImage src={editingBook.cover_url} alt="Cover" className="h-full w-full object-cover rounded-xl" />
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs">Subir imagen</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "cover")}
                  />
                </div>

                {/* EPUB Upload */}
                <div>
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Archivo EPUB</label>
                  <button
                    type="button"
                    onClick={() => epubInputRef.current?.click()}
                    className="w-full h-24 bg-white/5 border border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-white/8 hover:border-white/25 transition-all text-white/40 hover:text-white/70"
                  >
                    {uploading === "epub" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : editingBook.epub_url ? (
                      <>
                        <FileText className="w-5 h-5 text-green-400" />
                        <span className="text-xs text-green-400">EPUB listo</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span className="text-xs">Subir .epub</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={epubInputRef}
                    type="file"
                    accept=".epub"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "epub")}
                  />
                </div>
              </div>

                <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Contenido Premium</p>
                    <p className="text-xs text-white/40 mt-0.5">Requiere suscripción activa para leerse</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingBook((p) => ({ ...p, is_premium: !p.is_premium }))}
                  >
                    {editingBook.is_premium ? (
                      <ToggleRight className="w-8 h-8 text-blue-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-white/25" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Publicar en catálogo</p>
                    <p className="text-xs text-white/40 mt-0.5">Visible para todos los usuarios</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingBook((p) => ({ ...p, is_active: !p.is_active }))}
                  >
                    {editingBook.is_active ? (
                      <ToggleRight className="w-8 h-8 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-white/25" />
                    )}
                  </button>
                </div>
            </div>

            {/* Modal Footer */}
            <div className="relative z-10 grid shrink-0 grid-cols-2 gap-3 border-t border-white/8 bg-[#1a1a1a] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingBook.id ? "Guardar cambios" : "Crear libro"}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {previewBook && (
        <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />
      )}
    </div>
  );
}
