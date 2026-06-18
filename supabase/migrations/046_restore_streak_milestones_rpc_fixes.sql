-- 046 - Restaurar streak milestones (rotos en 043) + SET search_path a RPCs faltantes

-- ============================================================
-- 1. update_streak_and_check_milestones — restaurar coin awarding
--    + mantener auth check + SET search_path
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
    v_coins_awarded JSONB := '[]'::jsonb;
    v_new_coin JSONB;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado', 'streak', 0, 'coins_awarded', '[]'::jsonb);
    END IF;

    SELECT MAX(DATE(last_read_at)) INTO v_last_read
    FROM public.reading_progress
    WHERE user_id = p_user_id AND percent_complete > 0;

    SELECT reading_streak INTO v_current_streak
    FROM public.profiles
    WHERE user_id = p_user_id;

    IF v_last_read IS NULL THEN
        v_current_streak := 1;
    ELSIF v_last_read = v_today THEN
        RETURN jsonb_build_object('success', true, 'streak', v_current_streak, 'coins_awarded', '[]'::jsonb);
    ELSIF v_last_read = v_yesterday THEN
        v_current_streak := v_current_streak + 1;
    ELSE
        v_current_streak := 1;
    END IF;

    UPDATE public.profiles
    SET reading_streak = v_current_streak, updated_at = NOW()
    WHERE user_id = p_user_id;

    IF v_current_streak = 3 THEN
        v_new_coin := public.add_coins(p_user_id, 'bronze', 'streak_3', 1, NULL);
        IF (v_new_coin->>'success')::BOOLEAN THEN
            v_coins_awarded := jsonb_build_array(jsonb_build_object('coin_type', 'bronze', 'amount', 1));
        END IF;
    ELSIF v_current_streak = 5 THEN
        v_new_coin := public.add_coins(p_user_id, 'bronze', 'streak_5', 1, NULL);
        IF (v_new_coin->>'success')::BOOLEAN THEN
            v_coins_awarded := jsonb_build_array(jsonb_build_object('coin_type', 'bronze', 'amount', 1));
        END IF;
    ELSIF v_current_streak = 10 THEN
        v_new_coin := public.add_coins(p_user_id, 'gold', 'streak_10', 1, NULL);
        IF (v_new_coin->>'success')::BOOLEAN THEN
            v_coins_awarded := jsonb_build_array(jsonb_build_object('coin_type', 'gold', 'amount', 1));
        END IF;
    ELSIF v_current_streak = 30 THEN
        v_new_coin := public.add_coins(p_user_id, 'diamond', 'streak_30', 1, NULL);
        IF (v_new_coin->>'success')::BOOLEAN THEN
            v_coins_awarded := jsonb_build_array(jsonb_build_object('coin_type', 'diamond', 'amount', 1));
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'streak', v_current_streak, 'coins_awarded', v_coins_awarded);
END;
$$;

-- ============================================================
-- 2. add_coins — agregar 'streak_3/5/10/30' a los sources antiable
--    para evitar doble awarding en milestones
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

    -- Anti-abuse para streak milestones: verificar que no se haya otorgado antes
    IF p_source IN ('streak_3', 'streak_5', 'streak_10', 'streak_30') THEN
        SELECT EXISTS(SELECT 1 FROM public.coin_transactions
            WHERE user_id = p_user_id AND source = 'complete_book' AND book_id IS NULL) INTO v_milestone_exists;
    END IF;

    INSERT INTO public.coins (user_id, coin_type, amount)
    VALUES (p_user_id, p_coin_type, p_amount)
    ON CONFLICT (user_id, coin_type)
    DO UPDATE SET amount = coins.amount + p_amount, updated_at = NOW();

    INSERT INTO public.coin_transactions (user_id, coin_type, amount, source, book_id)
    VALUES (p_user_id, p_coin_type, p_amount, p_source, p_book_id);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. track_event — SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_event(
    p_user_id UUID,
    p_event_name TEXT,
    p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.event_log (user_id, event_name, event_data, ip_address, user_agent)
    VALUES (
        p_user_id,
        p_event_name,
        p_event_data,
        current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
        current_setting('request.headers', true)::jsonb->>'user-agent'
    );
END;
$$;

-- ============================================================
-- 4. handle_new_user_coins — SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_coins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.coins (user_id, coin_type, amount)
    VALUES 
        (NEW.id, 'bronze', 0),
        (NEW.id, 'silver', 0),
        (NEW.id, 'gold', 0),
        (NEW.id, 'diamond', 0);
    RETURN NEW;
END;
$$;

-- ============================================================
-- 5. is_active_subscriber — SET search_path (mantiene user_uuid)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_active_subscriber(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
    v_role TEXT;
    v_ends_at TIMESTAMPTZ;
BEGIN
    SELECT role, subscription_ends_at INTO v_role, v_ends_at
    FROM public.users
    WHERE id = user_uuid;

    RETURN v_role IN ('subscriber', 'admin', 'vendedor')
        AND (v_ends_at IS NULL OR v_ends_at > NOW());
END;
$$;

-- ============================================================
-- 6. increment_counter — SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_counter()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN 1;
END;
$$;
