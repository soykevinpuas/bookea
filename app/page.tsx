import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/server";
import LandingHero from "@/components/LandingHero";

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  let covers: string[] = [];
  try {
    const admin = createAdminClient();
    const { data: books } = await admin
      .from("books")
      .select("cover_url")
      .eq("is_active", true)
      .not("cover_url", "is", null)
      .limit(50);
    covers = (books ?? [])
      .map((b) => b.cover_url)
      .filter((url): url is string => !!url)
      .slice(0, 12);
  } catch {
    // Si falla Supabase o la service role, no mostramos fotos externas ajenas al catalogo.
  }

  return <LandingHero covers={covers} />;
}
