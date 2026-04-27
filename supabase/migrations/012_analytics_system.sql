-- ============================================
-- MIGRACIÓN: Sistema de Analytics y Tipos
-- ============================================

-- 1. TABLA DE ANALYTICS EVENTS (para tracking en Supabase)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    session_id TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);

-- RLS para analytics (solo admins pueden ver, el sistema inserta)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view analytics" ON public.analytics_events;
CREATE POLICY "Admins can view analytics" ON public.analytics_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Service can insert analytics" ON public.analytics_events;
CREATE POLICY "Service can insert analytics" ON public.analytics_events
    FOR INSERT WITH CHECK (true);

-- 2. FUNCIÓN RPC PARA TRACKING (bypassea RLS del cliente)
CREATE OR REPLACE FUNCTION public.track_event(
    event_name TEXT,
    event_data JSONB DEFAULT '{}',
    user_email TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.analytics_events (event_name, event_data, user_id, user_email, session_id, user_agent)
    VALUES (
        event_name,
        event_data,
        NULLIF(auth.uid(), auth.uid())::UUID, -- NULL si no hay usuario
        COALESCE(user_email, (SELECT email FROM auth.users WHERE id = auth.uid())),
        NULL,
        current_setting('request.headers', true)::JSONB->>'user-agent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TIPOS TYPESCRIPT (creados en lib/analytics.ts y types/epub.ts)
-- Los tipos se agregarán directamente en los archivos JS/TS