// 6.x - Tipos y constantes del sistema de monedas de gamificación

export type CoinType = 'bronze' | 'silver' | 'gold' | 'diamond';

export type CoinSource =
  | 'review'
  | 'streak_3'
  | 'streak_5'
  | 'streak_10'
  | 'streak_30'
  | 'complete_book'
  | 'referral'
  | 'redemption';

export interface CoinBalance {
  bronze: number;
  silver: number;
  gold: number;
  diamond: number;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  coin_type: CoinType;
  amount: number;
  source: CoinSource;
  book_id: string | null;
  created_at: string;
}

export interface CoinRedemption {
  id: string;
  user_id: string;
  book_id: string;
  coin_type: CoinType;
  days_granted: number;
  expires_at: string;
  created_at: string;
}

export interface StreakMilestone {
  id: string;
  user_id: string;
  milestone_days: number;
  earned_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
}

export const COIN_DAYS: Record<CoinType, number> = {
  bronze: 3,
  silver: 7,
  gold: 14,
  diamond: 30,
};

export const COIN_COLORS: Record<CoinType, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  diamond: '#b9f2ff',
};

export const COIN_TAILWIND_CLASSES: Record<CoinType, string> = {
  bronze: 'text-amber-700 dark:text-amber-400',
  silver: 'text-gray-500 dark:text-gray-300',
  gold: 'text-yellow-500 dark:text-yellow-400',
  diamond: 'text-cyan-400 dark:text-cyan-300',
};

export const COIN_BG_CLASSES: Record<CoinType, string> = {
  bronze: 'bg-amber-700/10 dark:bg-amber-400/10 border-amber-700/20',
  silver: 'bg-gray-500/10 dark:bg-gray-300/10 border-gray-500/20',
  gold: 'bg-yellow-500/10 dark:bg-yellow-400/10 border-yellow-500/20',
  diamond: 'bg-cyan-400/10 dark:bg-cyan-300/10 border-cyan-400/20',
};

export const COIN_LABELS: Record<CoinType, string> = {
  bronze: 'Bronce',
  silver: 'Plata',
  gold: 'Oro',
  diamond: 'Diamante',
};

export const COIN_ICONS: Record<CoinType, string> = {
  bronze: '🪙',
  silver: '🥈',
  gold: '🥇',
  diamond: '💎',
};

export const SOURCE_LABELS: Record<string, string> = {
  review: 'Reseña escrita',
  streak_3: 'Racha de 3 días',
  streak_5: 'Racha de 5 días',
  streak_10: 'Racha de 10 días',
  streak_30: 'Racha de 30 días',
  complete_book: 'Libro completado',
  referral: 'Amigo referido',
  redemption: 'Canje de libro',
};

export const ANTI_ABUSE_LIMITS = {
  max_review_coins_per_month: 3,
  max_referral_coins_per_month: 3,
  max_total_redemptions_per_month: 5,
  min_review_chars_for_coin: 50,
  min_review_rating_for_coin: 3,
  min_reading_minutes_for_streak: 2,
  min_book_progress_for_quiz: 0.10,
  max_book_redemptions_per_book: 1,
} as const;
