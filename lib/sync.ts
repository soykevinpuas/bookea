import { createClientClient } from "@/lib/supabase";
import { getLocalProgress, saveLocalProgress } from "./reading";

const PROGRESS_KEY = "bookea-offline-progress";

/**
 * 8.6 - Sincronizador de Progreso Offline
 * Recorre todos los libros en localStorage y sube los que no estén sincronizados.
 */
export async function syncOfflineProgress() {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return;

    const allProgress = JSON.parse(raw);
    const bookIds = Object.keys(allProgress);
    const supabase = createClientClient();

    console.info("Iniciando sincronización de progreso offline...");

    for (const bookId of bookIds) {
      const item = allProgress[bookId];

      // Si no está sincronizado, intentamos subirlo
      if (!item.synced && item.user_id) {
        try {
          const { error } = await supabase.from("reading_progress").upsert(
            {
              user_id: item.user_id,
              book_id: item.book_id,
              cfi_position: item.cfi_position,
              percent_complete: item.percent_complete,
              last_read_at: item.last_read_at || new Date().toISOString(),
            },
            {
              onConflict: "user_id,book_id",
              ignoreDuplicates: false,
            }
          );

          if (!error) {
            // Marcar como sincronizado localmente
            item.synced = true;
            console.info(`✓ Sincronizado progreso de libro: ${bookId}`);
          } else {
            console.error(`Error al sincronizar libro ${bookId}:`, error.message);
          }
        } catch (err) {
          console.error(`Fallo crítico sincronizando ${bookId}:`, err);
        }
      }
    }

    // Guardar el estado actualizado del lote
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));

  } catch (err) {
    console.error("Error en syncOfflineProgress:", err);
  }
}
