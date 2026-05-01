-- Migration: 013_coins_gamification.sql
-- Bookea - Sistema de monedas de gamificación y anti-abuse
-- Created: Abril 2026

-- ============================================
-- COINS (balance de monedas del usuario)
-- ============================================
CREATE TABLE public.coins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_type TEXT NOT NULL CHECK (coin_type IN ('bronze', 'silver', 'gold', 'diamond')),
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, coin_type)
);

-- ============================================
-- COIN_TRANSACTIONS (historial de movimientos)
-- ============================================
CREATE TABLE public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_type TEXT NOT NULL CHECK (coin_type IN ('bronze', 'silver', 'gold', 'diamond')),
    amount INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('review', 'streak_3', 'streak_5', 'streak_10', 'streak_30', 'complete_book', 'referral')),
    book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- COIN_REDEMPTIONS (canjes de libros con monedas)
-- ============================================
CREATE TABLE public.coin_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    coin_type TEXT NOT NULL CHECK (coin_type IN ('bronze', 'silver', 'gold', 'diamond')),
    days_granted INTEGER NOT NULL CHECK (days_granted IN (3, 7, 14, 30)),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- ============================================
-- STREAK_MILESTONES (milestones alcanzados — anti-repetición)
-- ============================================
CREATE TABLE public.streak_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    milestone_days INTEGER NOT NULL CHECK (milestone_days IN (3, 5, 10, 30)),
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, milestone_days)
);

-- ============================================
-- REFERRALS (referidos realizados)
-- ============================================
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

-- ============================================
-- MONTHLY_LIMITS_TRACKER (tracker de límites mensuales — anti-abuse)
-- ============================================
CREATE TABLE public.monthly_limits_tracker (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    limit_type TEXT NOT NULL CHECK (limit_type IN ('review_coins', 'referral_coins', 'total_coin_redemptions')),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, limit_type, month, year)
);

-- ============================================
-- MODIFY user_books: add 'coin_redemption' access_type
-- ============================================
ALTER TABLE public.user_books DROP CONSTRAINT IF EXISTS user_books_access_type_check;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_access_type_check 
    CHECK (access_type IN ('subscription', 'permanent', 'gift', 'coin_redemption'));

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_limits_tracker ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COINS POLICIES
-- ============================================
CREATE POLICY "Users can view own coins" ON public.coins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all coins" ON public.coins FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "System can manage coins via RPC" ON public.coins FOR ALL USING (true);

-- ============================================
-- COIN_TRANSACTIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own transactions" ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON public.coin_transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "System can insert transactions via RPC" ON public.coin_transactions FOR INSERT WITH CHECK (true);

-- ============================================
-- COIN_REDEMPTIONS POLICIES
-- ============================================
CREATE POLICY "Users can view own redemptions" ON public.coin_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own redemptions" ON public.coin_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all redemptions" ON public.coin_redemptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- STREAK_MILESTONES POLICIES
-- ============================================
CREATE POLICY "Users can view own streak_milestones" ON public.streak_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert streak_milestones via RPC" ON public.streak_milestones FOR INSERT WITH CHECK (true);

-- ============================================
-- REFERRALS POLICIES
-- ============================================
CREATE POLICY "Users can view own referrals as referrer" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "System can insert referrals via RPC" ON public.referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all referrals" ON public.referrals FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ============================================
-- MONTHLY_LIMITS_TRACKER POLICIES
-- ============================================
CREATE POLICY "Users can view own monthly_limits" ON public.monthly_limits_tracker FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage monthly_limits via RPC" ON public.monthly_limits_tracker FOR ALL USING (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_coins_user_id ON public.coins(user_id);
CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_created_at ON public.coin_transactions(created_at);
CREATE INDEX idx_coin_redemptions_user_id ON public.coin_redemptions(user_id);
CREATE INDEX idx_coin_redemptions_book_id ON public.coin_redemptions(book_id);
CREATE INDEX idx_streak_milestones_user_id ON public.streak_milestones(user_id);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_monthly_limits_user_id ON public.monthly_limits_tracker(user_id);

-- ============================================
-- RPC: add_coins — sumar monedas a usuario con anti-abuse
-- ============================================
CREATE OR REPLACE FUNCTION public.add_coins(
    p_user_id UUID,
    p_coin_type TEXT,
    p_amount INTEGER DEFAULT 1,
    p_source TEXT,
    p_book_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month INTEGER := EXTRACT(MONTH FROM NOW());
    v_year INTEGER := EXTRACT(YEAR FROM NOW());
    v_current_count INTEGER := 0;
    v_max_review_coins INTEGER := 3;
    v_max_referral_coins INTEGER := 3;
    v_milestone_exists BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- ANTI-ABUSE: Limite de monedas por reseñas (3/mes)
    IF p_source = 'review' THEN
        SELECT COALESCE(count, 0) INTO v_current_count
        FROM public.monthly_limits_tracker
        WHERE user_id = p_user_id AND limit_type = 'review_coins' AND month = v_month AND year = v_year;
        
        IF v_current_count >= v_max_review_coins THEN
            RETURN jsonb_build_object('success', false, 'error', 'monthly_review_limit_reached', 'current_count', v_current_count);
        END IF;
        
        INSERT INTO public.monthly_limits_tracker (user_id, limit_type, month, year, count)
        VALUES (p_user_id, 'review_coins', v_month, v_year, 1)
        ON CONFLICT (user_id, limit_type, month, year)
        DO UPDATE SET count = monthly_limits_tracker.count + 1, updated_at = NOW();
    END IF;

    -- ANTI-ABUSE: Limite de monedas por referidos (3/mes)
    IF p_source = 'referral' THEN
        SELECT COALESCE(count, 0) INTO v_current_count
        FROM public.monthly_limits_tracker
        WHERE user_id = p_user_id AND limit_type = 'referral_coins' AND month = v_month AND year = v_year;
        
        IF v_current_count >= v_max_referral_coins THEN
            RETURN jsonb_build_object('success', false, 'error', 'monthly_referral_limit_reached', 'current_count', v_current_count);
        END IF;
        
        INSERT INTO public.monthly_limits_tracker (user_id, limit_type, month, year, count)
        VALUES (p_user_id, 'referral_coins', v_month, v_year, 1)
        ON CONFLICT (user_id, limit_type, month, year)
        DO UPDATE SET count = monthly_limits_tracker.count + 1, updated_at = NOW();
    END IF;

    -- ANTI-ABUSE: Streak milestones solo una vez
    IF p_source LIKE 'streak_%' THEN
        DECLARE
            v_milestone INTEGER;
        BEGIN
            v_milestone := CASE
                WHEN p_source = 'streak_3' THEN 3
                WHEN p_source = 'streak_5' THEN 5
                WHEN p_source = 'streak_10' THEN 10
                WHEN p_source = 'streak_30' THEN 30
                ELSE 0
            END;
            
            SELECT EXISTS(
                SELECT 1 FROM public.streak_milestones
                WHERE user_id = p_user_id AND milestone_days = v_milestone
            ) INTO v_milestone_exists;
            
            IF v_milestone_exists THEN
                RETURN jsonb_build_object('success', false, 'error', 'milestone_already_claimed', 'milestone', v_milestone);
            END IF;
            
            INSERT INTO public.streak_milestones (user_id, milestone_days)
            VALUES (p_user_id, v_milestone);
        END;
    END IF;

    -- Insertar transaction
    INSERT INTO public.coin_transactions (user_id, coin_type, amount, source, book_id)
    VALUES (p_user_id, p_coin_type, p_amount, p_source, p_book_id);

    -- Actualizar balance
    INSERT INTO public.coins (user_id, coin_type, amount)
    VALUES (p_user_id, p_coin_type, p_amount)
    ON CONFLICT (user_id, coin_type)
    DO UPDATE SET amount = coins.amount + p_amount, updated_at = NOW();

    -- Obtener nuevo balance
    SELECT jsonb_agg(jsonb_build_object('coin_type', c.coin_type, 'amount', c.amount))
    INTO v_result
    FROM public.coins c WHERE c.user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'coins', COALESCE(v_result, '[]'::jsonb), 'source', p_source);
END;
$$;

-- ============================================
-- RPC: redeem_coin — canjear moneda por acceso a libro
-- ============================================
CREATE OR REPLACE FUNCTION public.redeem_coin(
    p_user_id UUID,
    p_book_id UUID,
    p_coin_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coin_amount INTEGER := 0;
    v_days_granted INTEGER;
    v_expires_at TIMESTAMPTZ;
    v_month INTEGER := EXTRACT(MONTH FROM NOW());
    v_year INTEGER := EXTRACT(YEAR FROM NOW());
    v_current_redemptions INTEGER := 0;
    v_max_monthly_redemptions INTEGER := 5;
BEGIN
    -- Verificar cantidad de monedas disponibles
    SELECT COALESCE(amount, 0) INTO v_coin_amount
    FROM public.coins
    WHERE user_id = p_user_id AND coin_type = p_coin_type;

    IF v_coin_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'coin_type', p_coin_type);
    END IF;

    -- Verificar que no haya canjeado este libro antes
    IF EXISTS (SELECT 1 FROM public.coin_redemptions WHERE user_id = p_user_id AND book_id = p_book_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'book_already_redeemed');
    END IF;

    -- También verificar en user_books (ya puede tener acceso por otro medio)
    IF EXISTS (SELECT 1 FROM public.user_books WHERE user_id = p_user_id AND book_id = p_book_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_has_access');
    END IF;

    -- ANTI-ABUSE: Limite de 5 canjes por mes
    SELECT COALESCE(count, 0) INTO v_current_redemptions
    FROM public.monthly_limits_tracker
    WHERE user_id = p_user_id AND limit_type = 'total_coin_redemptions' AND month = v_month AND year = v_year;

    IF v_current_redemptions >= v_max_monthly_redemptions THEN
        RETURN jsonb_build_object('success', false, 'error', 'monthly_redemption_limit_reached', 'current_count', v_current_redemptions);
    END IF;

    -- Determinar días según moneda
    v_days_granted := CASE
        WHEN p_coin_type = 'bronze' THEN 3
        WHEN p_coin_type = 'silver' THEN 7
        WHEN p_coin_type = 'gold' THEN 14
        WHEN p_coin_type = 'diamond' THEN 30
        ELSE 0
    END;

    v_expires_at := NOW() + (v_days_granted || ' days')::INTERVAL;

    -- Descontar moneda
    UPDATE public.coins SET amount = amount - 1, updated_at = NOW()
    WHERE user_id = p_user_id AND coin_type = p_coin_type;

    -- Insertar canje
    INSERT INTO public.coin_redemptions (user_id, book_id, coin_type, days_granted, expires_at)
    VALUES (p_user_id, p_book_id, p_coin_type, v_days_granted, v_expires_at);

    -- Insertar en user_books
    INSERT INTO public.user_books (user_id, book_id, access_type, expires_at)
    VALUES (p_user_id, p_book_id, 'coin_redemption', v_expires_at)
    ON CONFLICT (user_id, book_id) DO NOTHING;

    -- Actualizar tracker mensual
    INSERT INTO public.monthly_limits_tracker (user_id, limit_type, month, year, count)
    VALUES (p_user_id, 'total_coin_redemptions', v_month, v_year, 1)
    ON CONFLICT (user_id, limit_type, month, year)
    DO UPDATE SET count = monthly_limits_tracker.count + 1, updated_at = NOW();

    -- Insertar transaction de gasto
    INSERT INTO public.coin_transactions (user_id, coin_type, amount, source, book_id)
    VALUES (p_user_id, p_coin_type, -1, 'redemption', p_book_id);

    -- Obtener nuevo balance
    DECLARE
        v_new_coins JSONB;
    BEGIN
        SELECT jsonb_agg(jsonb_build_object('coin_type', c.coin_type, 'amount', c.amount))
        INTO v_new_coins
        FROM public.coins c WHERE c.user_id = p_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'coins', COALESCE(v_new_coins, '[]'::jsonb),
            'days_granted', v_days_granted,
            'expires_at', v_expires_at
        );
    END;
END;
$$;

-- ============================================
-- RPC: track_referral — registrar referido y otorgar moneda
-- ============================================
CREATE OR REPLACE FUNCTION public.track_referral(
    p_referrer_id UUID,
    p_referred_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar que no sea auto-referencia
    IF p_referrer_id = p_referred_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'self_referral_not_allowed');
    END IF;

    -- Verificar que ya existe el referido
    IF EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id = p_referrer_id AND referred_id = p_referred_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'referral_already_tracked');
    END IF;

    -- Registrar referido
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (p_referrer_id, p_referred_id);

    -- Otorgar moneda de plata al referidor (+ anti-abuse en add_coins)
    RETURN public.add_coins(p_referrer_id, 'silver', 1, 'referral', NULL);
END;
$$;

-- ============================================
-- RPC: get_user_coins — obtener balance del usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_coins(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coins JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_object_agg(coin_type, amount),
        '{"bronze": 0, "silver": 0, "gold": 0, "diamond": 0}'::jsonb
    ) INTO v_coins
    FROM public.coins
    WHERE user_id = p_user_id;

    RETURN v_coins;
END;
$$;

-- ============================================
-- RPC: update_streak_and_check_milestones — actualizar racha
-- ============================================
CREATE OR REPLACE FUNCTION public.update_streak_and_check_milestones(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_streak INTEGER := 0;
    v_last_read DATE := NULL;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_new_coin JSONB;
BEGIN
    -- Obtener última fecha de lectura activa desde reading_progress
    -- (un día cuenta si leyó al menos algo ese día)
    SELECT MAX(DATE(last_read_at)) INTO v_last_read
    FROM public.reading_progress
    WHERE user_id = p_user_id AND percent_complete > 0;

    -- Obtener racha actual del perfil
    SELECT reading_streak INTO v_current_streak
    FROM public.profiles
    WHERE user_id = p_user_id;

    -- Determinar nueva racha
    IF v_last_read IS NULL THEN
        -- Primera lectura, racha = 1
        v_current_streak := 1;
    ELSIF v_last_read = v_today THEN
        -- Ya leyó hoy, no cambiar racha
        RETURN jsonb_build_object('success', true, 'streak', v_current_streak, 'coins_awarded', '[]'::jsonb);
    ELSIF v_last_read = v_yesterday THEN
        -- Leyó ayer, incrementar racha
        v_current_streak := v_current_streak + 1;
    ELSE
        -- Pasó más de 1 día, reiniciar racha
        v_current_streak := 1;
    END IF;

    -- Actualizar perfil
    UPDATE public.profiles
    SET reading_streak = v_current_streak, updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Verificar milestones y otorgar monedas
    DECLARE
        v_coins_awarded JSONB := '[]'::jsonb;
        v_milestone_result JSONB;
        v_coin_type TEXT;
    BEGIN
        IF v_current_streak >= 30 THEN
            v_coin_type := 'diamond';
        ELSIF v_current_streak >= 10 THEN
            v_coin_type := 'gold';
        ELSIF v_current_streak >= 5 THEN
            v_coin_type := 'bronze';
        ELSIF v_current_streak >= 3 THEN
            v_coin_type := 'bronze';
        ELSE
            RETURN jsonb_build_object('success', true, 'streak', v_current_streak, 'coins_awarded', '[]'::jsonb);
        END IF;

        v_milestone_result := public.add_coins(p_user_id, v_coin_type, 1, 'streak_' || v_current_streak::TEXT, NULL);

        IF (v_milestone_result->>'success')::BOOLEAN THEN
            v_coins_awarded := jsonb_build_array(
                jsonb_build_object('coin_type', v_coin_type, 'amount', 1)
            );
        END IF;
    END;

    RETURN jsonb_build_object('success', true, 'streak', v_current_streak, 'coins_awarded', v_coins_awarded);
END;
$$;

-- ============================================
-- AUTO-CREATE COINS TRIGGER — crear monedas iniciales al registrarse
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_coins()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar registros de monedas iniciales (0 de cada tipo)
    INSERT INTO public.coins (user_id, coin_type, amount)
    VALUES 
        (NEW.id, 'bronze', 0),
        (NEW.id, 'silver', 0),
        (NEW.id, 'gold', 0),
        (NEW.id, 'diamond', 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_init_coins
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_coins();
