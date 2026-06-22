import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/server";
import LandingHero from "@/components/LandingHero";

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return <LandingHero />;
}
