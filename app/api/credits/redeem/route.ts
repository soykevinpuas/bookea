import { createClient } from "@/lib/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { bookId } = await req.json();

    if (!bookId) {
      return NextResponse.json({ error: "ID de libro requerido" }, { status: 400 });
    }

    // 1. Verificar créditos disponibles
    const { data: creditData, error: creditError } = await supabase
      .from("subscription_credits")
      .select("id, credits_remaining")
      .eq("user_id", user.id)
      .maybeSingle();

    if (creditError) throw creditError;

    if (!creditData || creditData.credits_remaining <= 0) {
      return NextResponse.json({ 
        error: "No tienes créditos suficientes", 
        noCredits: true 
      }, { status: 403 });
    }

    // 2. Verificar si ya tiene acceso
    const { data: existingAccess } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle();

    if (existingAccess) {
      return NextResponse.json({ 
        error: "Ya tienes acceso a este libro", 
        alreadyOwned: true 
      }, { status: 400 });
    }

    // 3. Restar crédito y otorgar acceso (Transacción manual)
    const { error: updateError } = await supabase
      .from("subscription_credits")
      .update({ credits_remaining: creditData.credits_remaining - 1 })
      .eq("id", creditData.id);

    if (updateError) throw updateError;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: accessError } = await supabase
      .from("user_books")
      .insert({
        user_id: user.id,
        book_id: bookId,
        access_type: "subscription",
        expires_at: expiresAt.toISOString()
      });

    if (accessError) throw accessError;

    return NextResponse.json({ 
      success: true, 
      message: "Libro desbloqueado con éxito por 30 días" 
    });

  } catch (error: any) {
    console.error("Error en redeem-credit:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
