"use client";

import AppImage from "@/components/ui/AppImage";
import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Shield, Zap, Loader2, BookOpen, Gift, BookOpenCheck, Trophy, Key, Trash2, AlertTriangle, Paintbrush, ChevronRight, Package, Clock, Truck, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useUserId } from "@/hooks/useUser";
import { useAuth } from "@/lib/auth-provider";
import { useUserBooks } from "@/hooks/useBooks";
import { useProfile } from "@/hooks/useAvatars";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfileData } from "@/hooks/useProfileData";
import AvatarSelector from "@/components/profile/AvatarSelector";
import { AvatarBadge } from "@/components/profile/AvatarBadge";
import { ProfileSkeleton } from "@/components/ui/SkeletonBox";
import { ReferralQR } from "@/components/profile/ReferralQR";

interface Order {
  id: string;
  book_id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  shipping_cost: number;
  total: number;
  tracking_number: string | null;
  created_at: string;
  books?: { id: string; title: string; cover_url: string | null; author: string } | null;
}

interface PurchasedBook {
  id: string;
  title: string;
  cover_url: string | null;
  author: string | null;
  types: ("digital" | "physical")[];
}

type PurchasedBookJoin = Omit<PurchasedBook, "types">;

type DigitalPurchaseRow = {
  book_id: string;
  books: PurchasedBookJoin | PurchasedBookJoin[] | null;
};

type PhysicalOrderRow = {
  book_id: string | null;
};

function pickPurchasedBook(books: DigitalPurchaseRow["books"]) {
  return Array.isArray(books) ? books[0] ?? null : books ?? null;
}

const STATUS_CONFIG: Record<Order["status"], { label: string; color: string; icon: LucideIcon; msg: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20", icon: Clock, msg: "El administrador procesará tu envío pronto." },
  shipped: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20", icon: Truck, msg: "Tu pedido está en camino." },
  delivered: { label: "Entregado", color: "bg-green-500/10 text-green-400 border border-green-500/20", icon: CheckCircle2, msg: "Entregado — gracias por tu compra." },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border border-red-500/20", icon: Clock, msg: "Esta orden fue cancelada." },
};

type Section = "personalizar" | "facturacion" | "biblioteca" | "ordenes" | "progreso" | "referidos" | "seguridad";

const sections: { key: Section; icon: LucideIcon; label: string }[] = [
  { key: "personalizar", icon: Paintbrush, label: "Personalizar" },
  { key: "facturacion", icon: CreditCard, label: "Facturación" },
  { key: "biblioteca", icon: BookOpen, label: "Biblioteca" },
  { key: "ordenes", icon: Package, label: "Órdenes" },
  { key: "progreso", icon: Trophy, label: "Progreso" },
  { key: "referidos", icon: Gift, label: "Referidos" },
  { key: "seguridad", icon: Shield, label: "Seguridad" },
];

export default function ProfilePage() {
  const { userId, isLoading: authLoading } = useUserId();
  const { email: userEmail } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    updateName,
    isUpdatingName,
    updateAvatar,
    isUpdatingAvatar
  } = useProfile(userId);
  const { data: subscription, isLoading: subLoading } = useSubscription(userId);
  const [activeSection, setActiveSection] = useState<Section>("personalizar");
  const { data: profileData, isLoading: profileDataLoading } = useProfileData(activeSection === "referidos" ? userId : undefined);

  const referralLink = profileData?.referralLink || '';
  const referralCount = profileData?.referralCount || 0;

  const { data: allUserBooks } = useUserBooks(userId);
  const completedBooks = useMemo(
    () => (allUserBooks || []).filter((b) => (b.percent_complete || 0) >= 100).length,
    [allUserBooks]
  );

  const [portalLoading, setPortalLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [purchasedBooks, setPurchasedBooks] = useState<PurchasedBook[]>([]);
  const [purchasedLoading, setPurchasedLoading] = useState(false);
  const [purchasedLoaded, setPurchasedLoaded] = useState(false);
  const [purchasedOpen, setPurchasedOpen] = useState(false);

  useEffect(() => {
    if (profile?.name) setTempName(profile.name);
  }, [profile]);

  useEffect(() => {
    setPurchasedBooks([]);
    setPurchasedLoaded(false);
    setPurchasedOpen(false);
  }, [userId]);

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error || "Error al abrir el portal de facturación");
    } catch {
      toast.error("Error al conectar con el portal de pagos");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    try {
      await updateName(tempName);
      setIsEditingName(false);
      toast.success("Nombre actualizado");
    } catch {
      toast.error("Error al actualizar nombre");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 0) { setDeleteStep(1); return; }
    if (deleteStep === 1) {
      if (deleteConfirm !== "ELIMINAR") { toast.error('Escribe "ELIMINAR" para confirmar'); return; }
      setDeleteLoading(true);
      try {
        const response = await fetch("/api/account/delete", { method: "POST" });
        const data = await response.json();
        if (data.success) {
          toast.success("Cuenta eliminada. Redirigiendo...");
          const supabase = createClientClient();
          await supabase.auth.signOut();
          window.location.href = "/";
        } else { toast.error(data.error || "Error al eliminar cuenta"); setDeleteStep(0); }
      } catch { toast.error("Error de conexión"); setDeleteStep(0); }
      finally { setDeleteLoading(false); }
    }
  };

  const handleSaveAvatar = async (config: string) => {
    try { await updateAvatar(config); toast.success("Avatar actualizado"); }
    catch { toast.error("Error al guardar avatar"); }
  };

  useEffect(() => {
    if (!userId) return;
    if (activeSection !== "biblioteca" || !purchasedOpen || purchasedLoaded) return;

    let cancelled = false;
    const supabase = createClientClient();
    setPurchasedLoading(true);

    const loadPurchasedBooks = async () => {
      try {
        const { data: digitalData } = await supabase.from('user_books')
          .select('book_id, books!inner(id, title, cover_url, author)')
          .eq('user_id', userId)
          .eq('access_type', 'permanent');

        const bookMap = new Map<string, PurchasedBook>();
        ((digitalData || []) as DigitalPurchaseRow[]).forEach((item) => {
          const book = pickPurchasedBook(item.books);
          if (book?.id) bookMap.set(book.id, { ...book, types: ['digital'] });
        });
        const { data: physicalOrders } = await supabase
          .from('orders_physical')
          .select('book_id')
          .eq('user_id', userId);
        const physicalBookIds = [...new Set(((physicalOrders || []) as PhysicalOrderRow[]).map((o) => o.book_id).filter((bookId): bookId is string => !!bookId))];
        if (physicalBookIds.length > 0) {
          const { data: physicalBooks } = await supabase
            .from('books')
            .select('id, title, cover_url, author')
            .in('id', physicalBookIds);
          ((physicalBooks || []) as PurchasedBookJoin[]).forEach((book) => {
            if (bookMap.has(book.id)) bookMap.get(book.id)?.types.push('physical');
            else bookMap.set(book.id, { ...book, types: ['physical'] });
          });
        }

        if (!cancelled) setPurchasedBooks(Array.from(bookMap.values()));
      } finally {
        if (!cancelled) {
          setPurchasedLoaded(true);
          setPurchasedLoading(false);
        }
      }
    };

    void loadPurchasedBooks();

    return () => {
      cancelled = true;
    };
  }, [activeSection, purchasedLoaded, purchasedOpen, userId]);

  const isSubscriber = subscription?.isActive;

  const supabase = createClientClient();
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["profile-orders", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("orders_physical")
        .select("*, books(id, title, cover_url, author)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    enabled: !!userId && activeSection === "ordenes",
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  if (authLoading || (profileLoading && !profile)) return <ProfileSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070708] text-gray-900 dark:text-white py-8 px-4 sm:px-6 transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar — sticky nav */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start space-y-4">
            {/* Profile card compacta */}
            <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <AvatarBadge
                  avatarUrl={profile?.avatar_url}
                  fallbackText={profile?.name || userEmail || "U"}
                  premium={isSubscriber}
                  className="w-14 h-14 border-2 border-gray-200 dark:border-white/5 flex-shrink-0"
                  fallbackClassName={`${isSubscriber ? "bg-amber-500" : "bg-blue-600"} text-lg font-black text-white`}
                  badgeClassName="border-gray-100 dark:border-[#070708]"
                />
                <div className="min-w-0 flex-1">
                  {isEditingName ? (
                    <div className="flex gap-1.5">
                      <input value={tempName} onChange={(e) => setTempName(e.target.value)}
                        className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm outline-none text-gray-900 dark:text-white"
                        placeholder="Nombre..." autoFocus />
                      <button onClick={handleSaveName} disabled={isUpdatingName} className="bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-[10px] px-2 rounded-lg disabled:opacity-50">OK</button>
                      <button onClick={() => setIsEditingName(false)} className="text-[10px] px-2 text-gray-400">X</button>
                    </div>
                  ) : (
                    <>
                      <p onClick={() => { setTempName(profile?.name || ''); setIsEditingName(true); }}
                        className="font-bold text-sm truncate cursor-pointer hover:opacity-60 transition-opacity">
                        {profile?.name || (userEmail ? userEmail.split('@')[0] : 'Agrega tu nombre')}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-white/30 truncate">{userEmail || ''}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Mini stats inline */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-200 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40">
                  <BookOpenCheck className="w-3 h-3 text-blue-400" />
                  <span className="font-bold text-gray-900 dark:text-white">{completedBooks}</span>
                  <span className="text-gray-400 dark:text-white/40">leídos</span>
                </div>
              </div>

              {/* Subscription badge */}
              {subscription?.role === 'vendedor' ? (
                <Link href="/vendedor"
                  className="mt-3 block text-[10px] font-bold text-center py-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                >
                  Panel Vendedor →
                </Link>
              ) : subscription?.role === 'admin' ? (
                <Link href="/admin"
                  className="mt-3 block text-[10px] font-bold text-center py-1.5 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                >
                  Panel Admin →
                </Link>
              ) : (
                <div className={`mt-3 text-[10px] font-bold text-center py-1.5 rounded-lg ${
                  subLoading ? 'bg-white/5 text-white/20 animate-pulse' :
                  isSubscriber ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                }`}>
                  {subLoading ? 'Cargando...' : (isSubscriber ? 'Miembro Premium' : 'Nivel Gratis')}
                </div>
              )}

            </div>
          </aside>

          {/* Main content — chrome tabs + active section */}
          <main className="lg:col-span-8">
            {/* Chrome tabs */}
            <div className="flex gap-px overflow-x-auto overflow-y-hidden flex-nowrap mb-0">
              {sections.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold whitespace-nowrap transition-all rounded-t-lg ${
                    activeSection === key
                      ? 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white border-t border-l border-r border-gray-200 dark:border-white/10 -mb-px z-10 shadow-sm'
                      : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${activeSection === key ? (isSubscriber ? 'text-amber-500' : 'text-blue-500') : ''}`} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-b-2xl rounded-tr-2xl p-6 sm:p-8 -mt-px">
            {activeSection === "personalizar" && (
              <>
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-8">
                  <Paintbrush className={`w-5 h-5 ${isSubscriber ? 'text-amber-500' : 'text-blue-500'}`} />
                  Personalizar Avatar
                </h3>
                <AvatarSelector
                  currentAvatarConfig={profile?.avatar_url}
                  onSelect={handleSaveAvatar}
                  isUpdating={isUpdatingAvatar}
                />
              </>
            )}

            {activeSection === "facturacion" && (
              <>
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-6">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  Facturación y Plan
                </h3>

                {!isSubscriber ? (
                  <div className="p-6 bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl">
                    <p className="text-sm leading-relaxed mb-6">
                      Actualmente estás en el nivel gratuito. Actualiza a Premium para obtener acceso ilimitado a toda nuestra biblioteca digital y lectura offline.
                    </p>
                    <Link href="/subscribe" className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all hover:scale-105">
                      <Zap className="w-4 h-4" /> Activar Premium
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-gray-200 dark:bg-white/5 rounded-2xl border border-gray-300 dark:border-white/10 text-center">
                        <p className="text-[10px] text-gray-400 dark:text-white/30 uppercase tracking-widest mb-1">Estado</p>
                        <p className={`text-xl font-black ${subscription?.role === 'admin' ? 'text-purple-400' : subscription?.role === 'vendedor' ? 'text-amber-400' : 'text-green-400'}`}>
                          {subscription?.role === 'admin' ? 'Acceso VIP' : subscription?.role === 'vendedor' ? 'Vendedor' : 'Premium Activo'}
                        </p>
                      </div>
                      <div className="p-5 bg-gray-200 dark:bg-white/5 rounded-2xl border border-gray-300 dark:border-white/10 text-center">
                        <p className="text-[10px] text-gray-400 dark:text-white/30 uppercase tracking-widest mb-1">Expiración</p>
                        <p className="text-xl font-black">
                          {subscription?.role === 'admin' ? 'Vitalicio' : subscription?.role === 'vendedor' ? '—' : `${subscription?.daysRemaining ?? 0} días`}
                        </p>
                      </div>
                    </div>

                    {subscription?.role === 'vendedor' ? (
                      <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                        <p className="text-sm font-bold text-amber-500 mb-1">Rol de Vendedor</p>
                        <p className="text-xs text-white/40">Tienes acceso de vendedor. Puedes gestionar tu inventario y solicitudes desde tu panel.</p>
                      </div>
                    ) : (
                      <div className="p-6 bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left">
                          <p className="font-bold mb-1">Gestionar en Stripe</p>
                          <p className="text-xs text-gray-500 dark:text-white/40">Actualiza tu método de pago o descarga facturas.</p>
                        </div>
                        <button onClick={handlePortal} disabled={portalLoading} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-3">
                          {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                          Abrir Portal
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeSection === "biblioteca" && (
              <>
                <button onClick={() => { if (!purchasedLoading) setPurchasedOpen(!purchasedOpen); }}
                  className="w-full flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    Libros Comprados
                    {purchasedBooks.length > 0 && (
                      <span className="text-xs font-bold text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{purchasedBooks.length}</span>
                    )}
                  </h3>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${purchasedOpen ? 'rotate-90' : ''}`} />
                </button>

                {purchasedOpen && (
                  <div className="mt-5 space-y-2">
                    {purchasedLoading ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
                    ) : purchasedBooks.length === 0 ? (
                      <p className="text-sm text-white/40 text-center py-6">Aún no has comprado ningún libro.</p>
                    ) : (
                      purchasedBooks.map((book) => (
                        <Link key={book.id} href={`/book/${book.id}`}
                          className="flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 rounded-xl transition-all group">
                          {book.cover_url ? (
                            <AppImage src={book.cover_url} alt={book.title} className="w-10 h-14 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xs text-white/30 flex-shrink-0">{book.title?.charAt(0)}</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">{book.title}</p>
                            {book.author && <p className="text-xs text-gray-500 dark:text-white/40 truncate">{book.author}</p>}
                            <div className="flex gap-1 mt-1">
                              {book.types?.includes('digital') && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">Digital</span>}
                              {book.types?.includes('physical') && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">Físico</span>}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {activeSection === "progreso" && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center mb-5">
                  <Trophy className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-lg font-black text-white/80 mb-2">Progreso</h3>
                <p className="text-sm text-white/30 max-w-xs leading-relaxed">
                  Próximamente podrás trackear tu progreso, rachas y monedas conseguidas.
                </p>
              </div>
            )}

            {activeSection === "referidos" && (
              <>
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-6">
                  <Gift className="w-5 h-5 text-green-400" />
                  Invita a un Amigo
                </h3>
                {profileDataLoading && !referralLink ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : referralLink ? (
                  <ReferralQR referralLink={referralLink} referralCount={referralCount} />
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No se pudo cargar tu enlace de referido.</p>
                )}
              </>
            )}

            {activeSection === "seguridad" && (
              <>
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-4">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Seguridad
                </h3>

                <div className="p-5 bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold">Cambiar Contraseña</span>
                  </div>
                  <input
                    type="password"
                    placeholder="Nueva contraseña (mínimo 6 caracteres)"
                    className="w-full p-2.5 text-sm bg-white dark:bg-black/50 border border-gray-300 dark:border-white/20 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"
                    id="new-password-input"
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById("new-password-input") as HTMLInputElement;
                      const newPassword = input.value;
                      if (newPassword.length < 6) {
                        toast.error("La contraseña debe tener al menos 6 caracteres");
                        return;
                      }
                      setPasswordLoading(true);
                      try {
                        const supabase = createClientClient();
                        const { error } = await supabase.auth.updateUser({ password: newPassword });
                        if (error) {
                          toast.error(error.message || "Error al actualizar contraseña");
                        } else {
                          toast.success("Contraseña actualizada con éxito");
                          input.value = "";
                        }
                      } catch {
                        toast.error("Error de conexión");
                      } finally {
                        setPasswordLoading(false);
                      }
                    }}
                    disabled={passwordLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                  >
                    {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar Contraseña"}
                  </button>
                </div>
                {deleteStep === 0 ? (
                  <button onClick={() => setDeleteStep(1)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/10 transition-all">
                    <div className="flex items-center gap-3">
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">Eliminar Cuenta</span>
                    </div>
                    <span className="text-xs text-red-500 font-medium">Eliminar</span>
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">Esto eliminará tu cuenta permanentemente</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Todos tus datos, libros, progreso y suscripciones se perderán. Esta acción es irreversible.</p>
                      </div>
                    </div>
                    <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder='Escribe "ELIMINAR" para confirmar'
                      className="w-full p-2 text-sm bg-white dark:bg-black/50 border border-red-300 dark:border-red-500/30 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50" />
                    <div className="flex gap-2">
                      <button onClick={() => { setDeleteStep(0); setDeleteConfirm(""); }} disabled={deleteLoading}
                        className="flex-1 px-3 py-2 bg-gray-200 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-300 dark:hover:bg-white/10 transition-all disabled:opacity-50">Cancelar</button>
                      <button onClick={handleDeleteAccount} disabled={deleteLoading || deleteConfirm !== "ELIMINAR"}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeSection === "ordenes" && (
              <>
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-6">
                  <Package className="w-5 h-5 text-blue-400" />
                  Mis Órdenes
                </h3>
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-white/20" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Aún no has comprado libros físicos.</p>
                    <Link href="/catalog?tab=fisicos" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all">
                      Explorar catálogo físico
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => {
                      const cfg = STATUS_CONFIG[order.status];
                      const StatusIcon = cfg.icon;
                      const book = order.books as Order["books"];
                      return (
                        <div key={order.id}
                          className="bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start gap-3">
                            <Link href={`/book/${book?.id || order.book_id}`} className="shrink-0">
                              {book?.cover_url ? (
                                <AppImage src={book.cover_url} alt={book.title} className="w-12 h-[68px] rounded-lg object-cover" />
                              ) : (
                                <div className="w-12 h-[68px] rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-sm text-gray-400">📚</div>
                              )}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color} flex items-center gap-1`}>
                                  <StatusIcon className="w-3 h-3" />{cfg.label}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-white/30">
                                  {new Date(order.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                              </div>
                              <Link href={`/book/${book?.id || order.book_id}`}
                                className="text-sm font-bold text-gray-900 dark:text-white truncate block hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                {book?.title || "Libro"}
                              </Link>
                              {order.tracking_number && (
                                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-blue-500 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg">
                                  <Package className="w-2.5 h-2.5" /> Guía: {order.tracking_number}
                                </div>
                              )}
                              <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1">{cfg.msg}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-xs text-gray-900 dark:text-white">${order.total} MXN</p>
                              <p className="text-[9px] text-green-600 dark:text-green-400 font-semibold">Envío gratis</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
