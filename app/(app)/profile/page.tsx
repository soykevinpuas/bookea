"use client";

import { createClientClient } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { User, CreditCard, Shield, Zap, Loader2, Sparkles, BookOpen, Coins, Flame, Gift, Circle, BookOpenCheck, Trophy, Key, Trash2, AlertTriangle, Package, Paintbrush, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useUserId } from "@/hooks/useUser";
import { useUserBooks } from "@/hooks/useBooks";
import { useProfile } from "@/hooks/useAvatars";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfileData } from "@/hooks/useProfileData";
import { parseAvatarConfig } from "@/lib/avatars-v2";
import { AnimalEngine } from "@/components/avatars/AnimalEngine";
import AvatarSelector from "@/components/profile/AvatarSelector";
import { ProfileSkeleton } from "@/components/ui/SkeletonBox";
import { CoinBalanceDisplay } from "@/components/ui/CoinBalance";
import { ReferralQR } from "@/components/profile/ReferralQR";

type Section = "personalizar" | "facturacion" | "biblioteca" | "progreso" | "referidos" | "seguridad";

const sections: { key: Section; icon: typeof User; label: string }[] = [
  { key: "personalizar", icon: Paintbrush, label: "Personalizar" },
  { key: "facturacion", icon: CreditCard, label: "Facturación" },
  { key: "biblioteca", icon: BookOpen, label: "Biblioteca" },
  { key: "progreso", icon: Trophy, label: "Progreso" },
  { key: "referidos", icon: Gift, label: "Referidos" },
  { key: "seguridad", icon: Shield, label: "Seguridad" },
];

export default function ProfilePage() {
  const { userId, isLoading: authLoading } = useUserId();
  const {
    profile,
    isLoading: profileLoading,
    updateName,
    isUpdatingName,
    updateAvatar,
    isUpdatingAvatar
  } = useProfile(userId);
  const { data: subscription, isLoading: subLoading } = useSubscription(userId);
  const { data: profileData, isLoading: profileDataLoading } = useProfileData(userId);

  const coinsBalance = profileData?.coins;
  const streak = profileData?.streak ?? 0;
  const referralLink = profileData?.referralLink || '';
  const referralCount = profileData?.referralCount || 0;

  const { data: allUserBooks } = useUserBooks(userId);
  const completedBooks = useMemo(
    () => (allUserBooks || []).filter((b: any) => (b.percent_complete || 0) >= 100).length,
    [allUserBooks]
  );

  const [activeSection, setActiveSection] = useState<Section>("personalizar");
  const [portalLoading, setPortalLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [purchasedBooks, setPurchasedBooks] = useState<any[]>([]);
  const [purchasedLoading, setPurchasedLoading] = useState(false);
  const [purchasedOpen, setPurchasedOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (!userId) return;
    const supabase = createClientClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, [userId]);

  const parsedAvatar = useMemo(() =>
    profile?.avatar_url ? parseAvatarConfig(profile.avatar_url) : null,
    [profile?.avatar_url]
  );

  useEffect(() => {
    if (profile?.name) setTempName(profile.name);
  }, [profile]);

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

  const handlePasswordReset = async () => {
    setPasswordLoading(true);
    try {
      const supabase = createClientClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { toast.error("No se encontró tu correo"); setPasswordLoading(false); return; }
      const response = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await response.json();
      if (data.success) toast.success("Correo de restablecimiento enviado");
      else toast.error(data.error || "Error al enviar correo");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setPasswordLoading(false);
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
    const supabase = createClientClient();
    setPurchasedLoading(true);
    supabase.from('user_books')
      .select('book_id, books!inner(id, title, cover_url, author)')
      .eq('user_id', userId)
      .eq('access_type', 'permanent')
      .then(async ({ data: digitalData }) => {
        const bookMap = new Map<string, any>();
        (digitalData || []).forEach((item: any) => {
          const book = item.books;
          if (book?.id) bookMap.set(book.id, { ...book, types: ['digital'] });
        });
        const { data: physicalOrders } = await supabase
          .from('orders_physical')
          .select('book_id')
          .eq('user_id', userId);
        const physicalBookIds = [...new Set((physicalOrders || []).map((o: any) => o.book_id))];
        if (physicalBookIds.length > 0) {
          const { data: physicalBooks } = await supabase
            .from('books')
            .select('id, title, cover_url, author')
            .in('id', physicalBookIds);
          (physicalBooks || []).forEach((book: any) => {
            if (bookMap.has(book.id)) bookMap.get(book.id).types.push('physical');
            else bookMap.set(book.id, { ...book, types: ['physical'] });
          });
        }
        setPurchasedBooks(Array.from(bookMap.values()));
        setPurchasedLoading(false);
      });
  }, [userId]);

  const isSubscriber = subscription?.isActive;

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
                <div className="w-14 h-14 rounded-full border-2 border-gray-200 dark:border-white/5 overflow-hidden bg-white dark:bg-[#111] flex-shrink-0 relative">
                  {profile?.avatar_url && parsedAvatar ? (
                    <AnimalEngine type={parsedAvatar.type} color={parsedAvatar.color} seed={parsedAvatar.seed} size="100%" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isSubscriber ? 'bg-amber-500' : 'bg-blue-600'} text-lg font-black text-white`}>
                      {(profile?.name || userEmail || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isSubscriber && <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-gray-100 dark:border-[#070708]" />}
                </div>
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
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="font-bold text-gray-900 dark:text-white">{streak ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40">
                  <BookOpenCheck className="w-3 h-3 text-blue-400" />
                  <span className="font-bold text-gray-900 dark:text-white">{completedBooks}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40">
                  <Circle className="w-3 h-3 text-amber-400 fill-current" />
                  <span className="font-bold text-gray-900 dark:text-white">
                    {coinsBalance ? (coinsBalance.bronze || 0) + (coinsBalance.silver || 0) + (coinsBalance.gold || 0) + (coinsBalance.diamond || 0) : 0}
                  </span>
                </div>
              </div>

              {/* Subscription badge */}
              <div className={`mt-3 text-[10px] font-bold text-center py-1.5 rounded-lg ${
                subLoading ? 'bg-white/5 text-white/20 animate-pulse' :
                isSubscriber ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
              }`}>
                {subLoading ? 'Cargando...' : (subscription?.role === 'admin' ? 'Premium Admin' : subscription?.role === 'vendedor' ? 'Vendedor' : (isSubscriber ? 'Miembro Premium' : 'Nivel Gratis'))}
              </div>
            </div>

            {/* Section navigation */}
            <nav className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-2 space-y-0.5">
              {sections.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                    activeSection === key
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeSection === key ? (isSubscriber ? 'text-amber-500' : 'text-blue-500') : ''}`} />
                  {label}
                  <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${activeSection === key ? 'rotate-90' : ''} text-gray-400`} />
                </button>
              ))}
            </nav>

            {/* Quick links */}
            <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-3 space-y-1">
              <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 rounded-xl transition-all">
                <Sparkles className={`w-4 h-4 ${isSubscriber ? 'text-amber-500' : 'text-blue-500'}`} />
                Mi Biblioteca
              </Link>
              <Link href="/orders" className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 rounded-xl transition-all">
                <Package className="w-4 h-4" />
                Mis Órdenes
              </Link>
            </div>
          </aside>

          {/* Main content — only active section */}
          <main className="lg:col-span-8">
            {activeSection === "personalizar" && (
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8">
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-8">
                  <Paintbrush className={`w-5 h-5 ${isSubscriber ? 'text-amber-500' : 'text-blue-500'}`} />
                  Personalizar Avatar
                </h3>
                <AvatarSelector
                  currentAvatarConfig={profile?.avatar_url}
                  onSelect={handleSaveAvatar}
                  isUpdating={isUpdatingAvatar}
                />
              </div>
            )}

            {activeSection === "facturacion" && (
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8">
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
              </div>
            )}

            {activeSection === "biblioteca" && (
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8">
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
                      purchasedBooks.map((book: any) => (
                        <Link key={book.id} href={`/book/${book.id}`}
                          className="flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 rounded-xl transition-all group">
                          {book.cover_url ? (
                            <img src={book.cover_url} alt={book.title} className="w-10 h-14 rounded-lg object-cover flex-shrink-0" />
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
              </div>
            )}

            {activeSection === "progreso" && (
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8">
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-6">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Progreso
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {coinsBalance && (
                    <div className="bg-gray-200 dark:bg-white/5 rounded-xl p-4 border border-gray-300 dark:border-white/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold">Monedas</span>
                      </div>
                      <CoinBalanceDisplay balance={coinsBalance} variant="full" />
                    </div>
                  )}
                  <div className="bg-gray-200 dark:bg-white/5 rounded-xl p-4 border border-gray-300 dark:border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-bold">Racha: {streak ?? 0} días</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="text-center p-1.5 rounded bg-white/5"><p className="text-[10px] font-bold text-amber-500">3d</p></div>
                      <div className="text-center p-1.5 rounded bg-white/5"><p className="text-[10px] font-bold text-amber-500">5d</p></div>
                      <div className="text-center p-1.5 rounded bg-white/5"><p className="text-[10px] font-bold text-yellow-500">10d</p></div>
                      <div className="text-center p-1.5 rounded bg-white/5"><p className="text-[10px] font-bold text-cyan-400">30d</p></div>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-white/30 mt-2">Lee 2+ min para contar</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "referidos" && referralLink && (
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8">
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-6">
                  <Gift className="w-5 h-5 text-green-400" />
                  Invita a un Amigo
                </h3>
                <ReferralQR referralLink={referralLink} referralCount={referralCount} />
              </div>
            )}

            {activeSection === "seguridad" && (
              <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
                <h3 className="text-xl font-black flex items-center gap-2.5 mb-4">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Seguridad
                </h3>

                <button onClick={handlePasswordReset} disabled={passwordLoading}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl hover:bg-gray-300 dark:hover:bg-white/10 transition-all disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold">Cambiar Contraseña</span>
                  </div>
                  {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <span className="text-xs text-blue-500 font-medium">Enviar correo</span>}
                </button>

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
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
