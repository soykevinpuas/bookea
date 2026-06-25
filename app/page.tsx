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
      .filter((url): url is string => !!url);
  } catch (e) {
    // Fallback silencioso
  }

  // Mezclar portadas reales con fallbacks para asegurar variedad
  const fallbacks = [
    "https://picsum.photos/seed/fallback1/400/600",
    "https://picsum.photos/seed/fallback2/400/600",
    "https://picsum.photos/seed/fallback3/400/600",
    "https://picsum.photos/seed/fallback4/400/600",
    "https://picsum.photos/seed/fallback5/400/600",
    "https://picsum.photos/seed/fallback6/400/600",
    "https://picsum.photos/seed/fallback7/400/600",
    "https://picsum.photos/seed/fallback8/400/600",
  ];
  covers = [...covers, ...fallbacks].sort(() => Math.random() - 0.5);

  return <LandingHero covers={covers} />;
}
