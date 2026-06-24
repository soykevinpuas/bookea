import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import LandingHero from "@/components/LandingHero";

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  const { data: books } = await supabase
    .from("books")
    .select("cover_url")
    .not("cover_url", "is", null)
    .limit(18);

  const covers = (books ?? [])
    .map((b) => b.cover_url)
    .filter((url): url is string => !!url);

  return <LandingHero covers={covers} />;
}
