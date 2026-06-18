-- 043 - Agregar auth checks a TODOS los RPCs SECURITY DEFINER que carecían
-- += SET search_path a funciones sin él
-- += FOR UPDATE a redeem_coin (race condition en gasto de monedas)

-- ============================================================
-- 1. decrement_stock (mig 036) — sin auth check, sin SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_stock INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT stock_physical INTO current_stock FROM public.books WHERE id = p_book_id FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Libro no encontrado';
  END IF;

  IF current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', current_stock, p_quantity;
  END IF;

  UPDATE public.books SET stock_physical = stock_physical - p_quantity
  WHERE id = p_book_id;
END;
$$;

-- ============================================================
-- 2. increment_stock (mig 025) — sin auth check, sin SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_stock(p_book_id UUID, p_quantity INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.books SET stock_physical = stock_physical + p_quantity
  WHERE id = p_book_id;
END;
$$;

-- ============================================================
-- 3. add_coins (mig 013) — sin auth check: cualquiera podía agregar monedas a cualquiera
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_coins(
    p_user_id UUID,
    p_coin_type TEXT,
    p_source TEXT,
    p_amount INTEGER DEFAULT 1,
    p_book_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

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

    IF p_source = 'streak_milestone' THEN
        SELECT EXISTS(SELECT 1 FROM public.streak_milestones WHERE user_id = p_user_id AND milestone = p_book_id::TEXT) INTO v_milestone_exists;
        IF v_milestone_exists THEN
            RETURN jsonb_build_object('success', false, 'error', 'milestone_already_awarded');
        END IF;
    END IF;

    INSERT INTO public.coins (user_id, coin_type, amount)
    VALUES (p_user_id, p_coin_type, p_amount)
    ON CONFLICT (user_id, coin_type)
    DO UPDATE SET amount = coins.amount + p_amount, updated_at = NOW();

    INSERT INTO public.coin_transactions (user_id, coin_type, amount, source, book_id)
    VALUES (p_user_id, p_coin_type, p_amount, p_source, p_book_id);

    IF p_source = 'streak_milestone' THEN
        INSERT INTO public.streak_milestones (user_id, milestone)
        VALUES (p_user_id, p_book_id::TEXT);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 4. redeem_coin (mig 013) — sin auth check + sin FOR UPDATE (race condition)
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_coin(
    p_user_id UUID,
    p_book_id UUID,
    p_coin_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    SELECT COALESCE(amount, 0) INTO v_coin_amount
    FROM public.coins
    WHERE user_id = p_user_id AND coin_type = p_coin_type
    FOR UPDATE;

    IF v_coin_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'coin_type', p_coin_type);
    END IF;

    IF EXISTS (SELECT 1 FROM public.coin_redemptions WHERE user_id = p_user_id AND book_id = p_book_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'book_already_redeemed');
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_books WHERE user_id = p_user_id AND book_id = p_book_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_has_access');
    END IF;

    SELECT COALESCE(count, 0) INTO v_current_redemptions
    FROM public.monthly_limits_tracker
    WHERE user_id = p_user_id AND limit_type = 'total_coin_redemptions' AND month = v_month AND year = v_year;

    IF v_current_redemptions >= v_max_monthly_redemptions THEN
        RETURN jsonb_build_object('success', false, 'error', 'monthly_redemption_limit_reached', 'current_count', v_current_redemptions);
    END IF;

    v_days_granted := CASE
        WHEN p_coin_type = 'bronze' THEN 3
        WHEN p_coin_type = 'silver' THEN 7
        WHEN p_coin_type = 'gold' THEN 14
        WHEN p_coin_type = 'diamond' THEN 30
        ELSE 0
    END;

    v_expires_at := NOW() + (v_days_granted || ' days')::INTERVAL;

    UPDATE public.coins SET amount = amount - 1, updated_at = NOW()
    WHERE user_id = p_user_id AND coin_type = p_coin_type;

    INSERT INTO public.coin_redemptions (user_id, book_id, coin_type, days_granted, expires_at)
    VALUES (p_user_id, p_book_id, p_coin_type, v_days_granted, v_expires_at);

    INSERT INTO public.user_books (user_id, book_id, access_type, expires_at)
    VALUES (p_user_id, p_book_id, 'coin_redemption', v_expires_at)
    ON CONFLICT (user_id, book_id) DO NOTHING;

    INSERT INTO public.monthly_limits_tracker (user_id, limit_type, month, year, count)
    VALUES (p_user_id, 'total_coin_redemptions', v_month, v_year, 1)
    ON CONFLICT (user_id, limit_type, month, year)
    DO UPDATE SET count = monthly_limits_tracker.count + 1, updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'days_granted', v_days_granted);
END;
$$;

-- ============================================================
-- 5. get_user_coins (mig 013) — sin auth check: cualquiera ve saldo de cualquiera
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_coins(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_coins JSONB;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('error', 'No autorizado');
    END IF;

    SELECT COALESCE(
        jsonb_object_agg(coin_type, amount),
        '{"bronze": 0, "silver": 0, "gold": 0, "diamond": 0}'::jsonb
    ) INTO v_coins
    FROM public.coins
    WHERE user_id = p_user_id;

    RETURN v_coins;
END;
$$;

-- ============================================================
-- 6. update_streak_and_check_milestones (mig 013) — sin auth check
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_streak_and_check_milestones(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_streak INTEGER := 0;
    v_last_read DATE := NULL;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_new_coin JSONB;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado', 'streak', 0, 'coins_awarded', '[]'::jsonb);
    END IF;

    SELECT MAX(DATE(last_read_at)) INTO v_last_read
    FROM public.reading_progress
    WHERE user_id = p_user_id;

    IF v_last_read IS DISTINCT FROM v_today AND v_last_read IS DISTINCT FROM v_yesterday THEN
        INSERT INTO public.profiles (user_id, reading_streak, updated_at)
        VALUES (p_user_id, 1, NOW())
        ON CONFLICT (user_id) DO UPDATE SET reading_streak = 1, updated_at = NOW();
        v_current_streak := 1;
    ELSE
        UPDATE public.profiles
        SET reading_streak = CASE WHEN v_last_read = v_yesterday THEN reading_streak + 1 ELSE reading_streak END,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING reading_streak INTO v_current_streak;
    END IF;

    RETURN jsonb_build_object('success', true, 'streak', v_current_streak, 'coins_awarded', '[]'::jsonb);
END;
$$;

-- ============================================================
-- 7. handle_new_user (mig 001) — SECURITY DEFINER sin SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, id)
    VALUES (NEW.id, NEW.id);
    RETURN NEW;
END;
$$;

-- ============================================================
-- 8. admin_change_user_role (mig 025) — SECURITY DEFINER sin SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_change_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_role TEXT;
    affected INT;
BEGIN
    SELECT role INTO caller_role
    FROM public.users
    WHERE id = auth.uid();

    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'No autorizado');
    END IF;

    UPDATE public.users SET role = new_role WHERE id = target_user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;

    RETURN json_build_object('success', true);
END;
$$;
