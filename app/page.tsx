import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/server";
import LandingHero from "@/components/LandingHero";

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  const FALLBACK_COVERS = [
    "https://picsum.photos/seed/bookcover1/400/600",
    "https://picsum.photos/seed/bookcover2/400/600",
    "https://picsum.photos/seed/bookcover3/400/600",
    "https://picsum.photos/seed/bookcover4/400/600",
    "https://picsum.photos/seed/bookcover5/400/600",
    "https://picsum.photos/seed/bookcover6/400/600",
    "https://picsum.photos/seed/bookcover7/400/600",
    "https://picsum.photos/seed/bookcover8/400/600",
  ];

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
      .sort(() => Math.random() - 0.5);
  } catch (e) {
    // Fallback silencioso
  }
  covers = covers.length > 0 ? covers : FALLBACK_COVERS;

  return <LandingHero covers={covers} />;
}
