import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/server";
import LandingHero from "@/components/LandingHero";

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: books } = await admin
    .from("books")
    .select("cover_url")
    .eq("is_active", true)
    .not("cover_url", "is", null)
    .limit(18);

  let covers = (books ?? [])
    .map((b) => b.cover_url)
    .filter((url): url is string => !!url);

  if (covers.length === 0) {
    covers = [
      "https://picsum.photos/seed/fallback1/400/600",
      "https://picsum.photos/seed/fallback2/400/600",
      "https://picsum.photos/seed/fallback3/400/600",
      "https://picsum.photos/seed/fallback4/400/600",
      "https://picsum.photos/seed/fallback5/400/600",
      "https://picsum.photos/seed/fallback6/400/600",
    ];
  }

  return <LandingHero covers={covers} />;
}
