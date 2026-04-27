/**
 * 7.1 - Analytics: Sistema de tracking de eventos para Bookea
 * Registra eventos en Supabase para análisis en el panel admin
 */

interface AnalyticsEvent {
  event_name: string;
  event_data: Record<string, unknown>;
  user_email?: string;
}

interface AnalyticsInstance {
  track: (event: string, data?: Record<string, unknown>) => Promise<void>;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name: string, data?: Record<string, unknown>) => Promise<void>;
}

let analyticsInstance: AnalyticsInstance | null = null;

/**
 * 7.1.1 - Inicializar analytics (llamar una vez)
 */
export function initAnalytics(): AnalyticsInstance {
  if (analyticsInstance) return analyticsInstance;

  const track = async (event: string, data?: Record<string, unknown>): Promise<void> => {
    try {
      const eventData: AnalyticsEvent = {
        event_name: event,
        event_data: {
          ...data,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : '',
        },
      };

      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        keepalive: true,
      });
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  };

  const identify = (userId: string, traits?: Record<string, unknown>): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_user_id', userId);
      if (traits) {
        localStorage.setItem('analytics_user_traits', JSON.stringify(traits));
      }
    }
  };

  const page = async (name: string, data?: Record<string, unknown>): Promise<void> => {
    await track('page_view', { page_name: name, ...data });
  };

  analyticsInstance = { track, identify, page };
  return analyticsInstance;
}

/**
 * 7.1.2 - Obtener instancia activa
 */
export function getAnalytics(): AnalyticsInstance {
  if (!analyticsInstance) {
    return initAnalytics();
  }
  return analyticsInstance;
}

/**
 * 7.1.3 - Constantes de eventos
 */
export const EVENTS = {
  // Autenticación
  USER_SIGNED_UP: 'user_signed_up',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',

  // Navegación
  PAGE_VIEW: 'page_view',
  CATALOG_VIEWED: 'catalog_viewed',
  BOOK_DETAIL_VIEWED: 'book_detail_viewed',
  READER_OPENED: 'reader_opened',

  // Pagos
  PAYMENT_STARTED: 'payment_started',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',

  // Biblioteca
  BOOK_ADDED_LIBRARY: 'book_added_library',
  BOOK_REMOVED_LIBRARY: 'book_removed_library',
  READING_STARTED: 'reading_started',

  // Comunidad
  REVIEW_CREATED: 'review_created',
  COMMENT_CREATED: 'comment_created',

  // Errores
  ERROR_OCCURRED: 'error_occurred',
} as const;

/**
 * 7.1.4 - Helper rápido
 */
export const track = async (event: string, data?: Record<string, unknown>): Promise<void> => {
  const analytics = getAnalytics();
  await analytics.track(event, data);
};

/**
 * 7.1.5 - Hook para usar analytics en componentes
 */
export function useAnalytics() {
  return {
    track,
    page: async (name: string, data?: Record<string, unknown>) => {
      const analytics = getAnalytics();
      await analytics.page(name, data);
    },
  };
}