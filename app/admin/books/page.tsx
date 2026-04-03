"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClientClient } from "@/lib/supabase";
import { useState, useRef } from "react";
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
} from "lucide-react";

interface Book {
  id: string;
  title: string;
  author: string;
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
  created_at: string;
}

type FormData = Omit<Book, "id" | "created_at"> & { id?: string };

const EMPTY_FORM: FormData = {
  title: "",
  slug: "",
  author: "",
  description: "",
  category: "",
  cover_url: "",
  epub_url: "",
  price_digital: 0,
  price_physical: 199,
  price_bundle: null,
  stock_physical: 0,
  is_active: true,
};

const CATEGORIES = [
  "Clásico", "Novela", "Fantasía", "Ciencia Ficción", "Romance",
  "Misterio", "Histórico", "Autoayuda", "Ensayo", "Poesía", "Otro"
];

export default function AdminBooksPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<FormData>(EMPTY_FORM);
  const [uploading, setUploading] = useState<"cover" | "epub" | null>(null);
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const supabase = createClientClient();
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Book[];
    },
  });

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
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const openNew = () => {
    setEditingBook(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (book: Book) => {
    setEditingBook({ ...book });
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
    } catch (err: any) {
      toast.error(`Error al subir ${type === "cover" ? "portada" : "EPUB"}: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!editingBook.title || !editingBook.author) {
      toast.error("El título y autor son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClientClient();
      const slug = editingBook.slug || editingBook.title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]/g, "");
      
      const payload = {
        title: editingBook.title,
        author: editingBook.author,
        description: editingBook.description,
        category: editingBook.category,
        cover_url: editingBook.cover_url,
        epub_url: editingBook.epub_url,
        price_digital: Number(editingBook.price_digital),
        price_physical: Number(editingBook.price_physical),
        price_bundle: editingBook.price_bundle ? Number(editingBook.price_bundle) : null,
        stock_physical: Number(editingBook.stock_physical),
        is_active: editingBook.is_active,
      };

      if (editingBook.id) {
        const { error } = await supabase.from("books").update(payload).eq("id", editingBook.id);
        if (error) throw error;
        toast.success("Libro actualizado con éxito");
      } else {
        const { error } = await supabase.from("books").insert(payload);
        if (error) throw error;
        toast.success("Libro creado con éxito");
      }

      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      setShowModal(false);
    } catch (err: any) {
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
          <h1 className="text-2xl font-bold">Libros</h1>
          <p className="text-white/40 text-sm mt-1">
            {(books || []).length} libro{(books || []).length !== 1 ? "s" : ""} en el catálogo
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/20" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay libros todavía.</p>
          <button onClick={openNew} className="mt-4 text-blue-400 hover:underline text-sm">
            Agregar el primero →
          </button>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Libro</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden sm:table-cell">Categoría</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Créditos</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden md:table-cell">Físico</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40 hidden md:table-cell">Stock</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Estado</th>
                <th className="text-left px-5 py-3.5 font-medium text-white/40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {book.cover_url ? (
                        <img src={book.cover_url} alt={book.title} className="w-8 h-11 object-cover rounded-md flex-shrink-0" />
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
                    {book.price_digital === 0 ? (
                      <span className="text-green-400 font-medium">GRATIS</span>
                    ) : (
                      <span className="text-white">{book.price_digital}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-white/70 hidden md:table-cell">${book.price_physical}</td>
                  <td className="px-5 py-4 text-white/70 hidden md:table-cell">{book.stock_physical}</td>
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
                  <input
                    value={editingBook.author}
                    onChange={(e) => setEditingBook((p) => ({ ...p, author: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="Antoine de Saint-Exupéry"
                  />
                </div>
              </div>

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
                  <label className="text-xs text-white/40 font-medium mb-1.5 block">Créditos (Digital)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingBook.price_digital}
                    onChange={(e) => setEditingBook((p) => ({ ...p, price_digital: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <p className="text-[10px] text-white/25 mt-1">1 crédito = acceso por 30 días</p>
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
                    onChange={(e) => setEditingBook((p) => ({ ...p, stock_physical: Number(e.target.value) }))}
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
                      <img src={editingBook.cover_url} alt="Cover" className="h-full w-full object-cover rounded-xl" />
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

              {/* Active toggle */}
              <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Publicar en catálogo</p>
                  <p className="text-xs text-white/40 mt-0.5">Los usuarios podrán ver y comprar este libro</p>
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
    </div>
  );
}
