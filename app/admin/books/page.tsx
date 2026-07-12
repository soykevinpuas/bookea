"use client";

import AppImage from "@/components/ui/AppImage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { useState, useRef, useEffect } from "react";
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
  price_bundle: number | null;
  stock_physical: number;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

interface AdminStock {
  book_id: string;
  quantity: number;
}

type FormData = Omit<Book, "id" | "created_at"> & { id?: string; newAuthor?: string };

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
  price_bundle: null,
  stock_physical: 0,
  is_active: true,
  is_premium: true,
};

const CATEGORIES = [
  "Ficción", "No Ficción", "Novela", "Clásicos", "Misterio y Suspenso",
  "Fantasía", "Ciencia Ficción", "Romance", "Terror", "Autoayuda",
  "Negocios y Finanzas", "Historia", "Biografías", "Cuentos", "Poesía", "Otros"
];

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
  const [previewBook, setPreviewBook] = useState<UntypedValue>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const supabase = createClientClient();
      const [booksResult, stockResult] = await Promise.all([
        supabase
          .from("books")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("admin_stock")
          .select("book_id, quantity"),
      ]);

      if (booksResult.error) throw booksResult.error;
      if (stockResult.error) throw stockResult.error;

      const stockByBook = new Map<string, number>();
      for (const item of (stockResult.data ?? []) as AdminStock[]) {
        stockByBook.set(item.book_id, item.quantity);
      }

      return ((booksResult.data ?? []) as Book[]).map((book) => ({
        ...book,
        stock_physical: stockByBook.get(book.id) ?? 0,
      }));
    },
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
    const supabase = createClientClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshBooks = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      }, 120);
    };

    const channel = supabase
      .channel("admin-books-stock-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, refreshBooks)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_stock" }, refreshBooks)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      toast.success("Estado del libro actualizado");
    },
    onError: (err: UntypedValue) => toast.error(`Error: ${err.message}`),
  });

  const adjustStockMutation = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const supabase = createClientClient();
      const { data, error } = await supabase.rpc("adjust_admin_stock", {
        p_book_id: id,
        p_delta: delta,
      });
      if (error) throw error;
      const result = (data as UntypedValue) || {};
      if (!result.success) throw new Error(result.error || "Error al ajustar stock");
    },
    onMutate: ({ id }) => {
      setStockLoading((prev) => new Set(prev).add(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
    },
    onError: (_err, vars) => {
      setStockLoading((prev) => { const next = new Set(prev); next.delete(vars.id); return next; });
      toast.error("Error al ajustar stock");
    },
    onSettled: () => {
      setStockLoading(new Set());
    },
  });

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
    } catch (err: UntypedValue) {
      toast.error(`Error al subir ${type === "cover" ? "portada" : "EPUB"}: ${err.message}`);
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
    } catch (err: UntypedValue) {
      toast.error(`Error al subir foto: ${err.message}`);
    } finally {
      setAuthorPhotoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingBook.title || !editingBook.author) {
      toast.error("El título y autor son obligatorios.");
      return;
    }

    const desiredStock = Math.max(0, Math.floor(Number(editingBook.stock_physical) || 0));
    const stockDelta = desiredStock - initialStockPhysical;

    setSaving(true);
    try {
      const supabase = createClientClient();

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

      const payload: Record<string, UntypedValue> = {
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
        if (stockDelta !== 0) {
          const { data: stockResult, error: stockError } = await supabase.rpc("adjust_admin_stock", {
            p_book_id: editingBook.id,
            p_delta: stockDelta,
          });
          if (stockError) throw stockError;
          const result = (stockResult as UntypedValue) || {};
          if (!result.success) throw new Error(result.error || "No se pudo ajustar el stock");
        }
        toast.success("Libro actualizado con éxito");
      } else {
        const { data: createdBook, error } = await supabase.from("books").insert(payload).select("id").single();
        if (error) throw error;
        const initialStock = desiredStock;
        if (createdBook?.id && initialStock > 0) {
          const { data: stockResult, error: stockError } = await supabase.rpc("adjust_admin_stock", {
            p_book_id: createdBook.id,
            p_delta: initialStock,
          });
          if (stockError) throw stockError;
          const result = (stockResult as UntypedValue) || {};
          if (!result.success) throw new Error(result.error || "No se pudo asignar stock inicial");
        }
        toast.success("Libro creado con éxito");
      }

      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      setShowModal(false);
    } catch (err: UntypedValue) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
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

      {/* Table */}
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
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Libro</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden sm:table-cell">Categoría</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Contenido</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden md:table-cell">EPUB</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden md:table-cell">Físico</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Estado</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Stock</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {book.cover_url ? (
                        <button onClick={() => setPreviewBook(book)} className="shrink-0 p-0 border-0 bg-transparent cursor-pointer">
                          <AppImage src={book.cover_url} alt={book.title} className="w-8 h-11 object-contain rounded-md flex-shrink-0 bg-white/5 shadow-inner hover:ring-2 hover:ring-blue-500/50 transition-all" />
                        </button>
                      ) : (
                        <div className="w-8 h-11 bg-white/10 rounded-md flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-white truncate max-w-[140px]">{book.title}</p>
                        <p className="text-white/40 text-xs truncate">{book.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-white/50 hidden sm:table-cell">
                    {book.category ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    {book.is_premium ? (
                      <span className="text-blue-400 font-medium text-xs border border-blue-400/20 px-2 py-0.5 rounded-full bg-blue-400/5">PREMIUM</span>
                    ) : (
                      <span className="text-green-400 font-medium text-xs border border-green-400/20 px-2 py-0.5 rounded-full bg-green-400/5">GRATIS</span>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    {book.epub_url ? (
                      <span className="text-green-400 font-medium text-xs">✓ EPUB</span>
                    ) : (
                      <span className="text-red-400/60 font-medium text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-white/70 hidden md:table-cell">${book.price_physical}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: book.id, isActive: !book.is_active })}
                      title={book.is_active ? "Desactivar" : "Activar"}
                    >
                      {book.is_active ? (
                        <ToggleRight className="w-6 h-6 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-white/25" />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustStockMutation.mutate({ id: book.id, delta: -1 })}
                        disabled={stockLoading.has(book.id) || book.stock_physical <= 0}
                        className="p-0.5 bg-white/5 hover:bg-red-500/20 rounded transition-colors disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-white/70 min-w-[2ch] text-center text-sm font-medium tabular-nums">
                        {stockLoading.has(book.id) ? <Loader2 className="w-3 h-3 animate-spin inline" /> : book.stock_physical}
                      </span>
                      <button
                        onClick={() => adjustStockMutation.mutate({ id: book.id, delta: 1 })}
                        disabled={stockLoading.has(book.id)}
                        className="p-0.5 bg-white/5 hover:bg-green-500/20 rounded transition-colors disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => openEdit(book)}
                      className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-xs font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal — Add / Edit Book */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <h2 className="font-bold text-lg">{editingBook.id ? "Editar Libro" : "Agregar Libro"}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
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
              <div className="grid grid-cols-3 gap-3">
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
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Stock físico</label>
                  <input
                    type="number"
                    min="0"
                    value={editingBook.stock_physical}
                    onChange={(e) => setEditingBook((p) => ({ ...p, stock_physical: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
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
            <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-white/8">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingBook.id ? "Guardar cambios" : "Crear libro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewBook && (
        <BookPreviewModal book={previewBook} onClose={() => setPreviewBook(null)} />
      )}
    </div>
  );
}
