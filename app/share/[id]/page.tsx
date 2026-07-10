import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import SharedView from "@/components/SharedView";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shared_conversations")
    .select("title")
    .eq("id", id)
    .single();
  return {
    title: data ? `${data.title} | tan(AI)` : "Shared conversation | tan(AI)",
    description: "A branched AI conversation shared from tan(AI).",
  };
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shared_conversations")
    .select("title, snapshot, updated_at")
    .eq("id", id)
    .single();

  if (!data?.snapshot) notFound();

  return <SharedView snapshot={data.snapshot} sharedAt={data.updated_at} />;
}
