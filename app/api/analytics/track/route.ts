import { NextRequest, NextResponse } from 'next/server';

/**
 * Analytics Track API: Recibe eventos y los guarda en Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_name, event_data, user_email } = body;

    if (!event_name) {
      return NextResponse.json({ error: 'Event name required' }, { status: 400 });
    }

    // Import dinámico para evitar circulares
    const { createClient } = await import('@/lib/server');
    const supabase = await createClient();

    const { error } = await supabase.rpc('track_event', {
      event_name,
      event_data: event_data || {},
      user_email: user_email || null,
    });

    if (error) {
      console.error('[Analytics API] Error:', error);
      return NextResponse.json({ error: 'Failed to track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Analytics API] Fatal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * GET: Métricas para admins (opcional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7d';

  const { createClient } = await import('@/lib/server');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: role } = await supabase.rpc('get_my_role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Calcular fecha límite
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_name, event_data, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }

  // Agregar métricas
  const metrics = {
    total_events: data?.length || 0,
    events_by_type: {} as Record<string, number>,
    unique_users: new Set(data?.map((e: UntypedValue) => e.event_data?.user_id).filter(Boolean)).size,
    period,
  };

  data?.forEach((event: UntypedValue) => {
    const name = event.event_name;
    metrics.events_by_type[name] = (metrics.events_by_type[name] || 0) + 1;
  });

  return NextResponse.json(metrics);
}