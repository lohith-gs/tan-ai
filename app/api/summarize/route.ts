import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { anchorIndex, estimateTokens, KEEP_VERBATIM, SUMMARIZE_TRIGGER_TOKENS } from "@/lib/context";
import { toModelContent } from "@/lib/merge";
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

// Structured format so categories survive repeated re-distillation instead of
// melting into prose.
const DISTILL_SYSTEM = `You maintain a rolling summary of an ongoing conversation. You receive the existing summary (possibly empty) and a new chunk of conversation, and produce ONE updated summary that replaces the old one.

Output exactly this markdown structure:
**Goal:** what the user is ultimately trying to do
**Key facts:** specific facts, numbers, names, code details mentioned (bullet list)
**Decisions:** conclusions reached and choices made, with brief reasoning (bullet list)
**Open questions:** unresolved points still in play (bullet list; omit section if none)

Rules:
- Merge the new chunk INTO the existing summary; drop nothing important, deduplicate.
- No narrative ("the user asked... the AI explained..."), no filler, no pleasantries.
- Keep the whole summary under 300 words.`;

interface MsgRow { id: string; role: string; content: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await request.json();
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 422 });

  const { data: thread } = await supabase
    .from("threads")
    .select("id, user_id, summary, summarized_up_to_message_id")
    .eq("id", threadId)
    .single();
  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (!messages?.length) return NextResponse.json({ skipped: true });

  const oldAnchor: string | null = thread.summarized_up_to_message_id;
  const start = anchorIndex(messages, oldAnchor ?? undefined);
  const region = (messages as MsgRow[]).slice(start, Math.max(start, messages.length - KEEP_VERBATIM));
  if (region.length === 0) return NextResponse.json({ skipped: true });

  const regionTokens = region.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  if (regionTokens <= SUMMARIZE_TRIGGER_TOKENS) return NextResponse.json({ skipped: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("groq_api_key, openai_api_key, anthropic_api_key, active_provider, active_model")
    .eq("id", user.id)
    .single();

  let activeProvider: string = profile?.active_provider ?? "groq";
  let model: string = profile?.active_model ?? DEFAULT_MODELS[activeProvider] ?? DEFAULT_MODELS.groq;
  const keyMap: Record<string, string | null | undefined> = {
    groq: profile?.groq_api_key,
    openai: profile?.openai_api_key,
    anthropic: profile?.anthropic_api_key,
  };
  let apiKey = keyMap[activeProvider]?.trim();

  // Trial mode: users with no keys of their own use the server's Groq key
  const hasOwnKeys = Object.values(keyMap).some((k) => k?.trim());
  const trialKey = (process.env.TRIAL_GROQ_API_KEY ?? process.env.GROQ_API_KEY)?.trim();
  if (!apiKey && !hasOwnKeys && trialKey) {
    apiKey = trialKey;
    activeProvider = "groq";
    model = DEFAULT_MODELS.groq;
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: hasOwnKeys
          ? "No API key configured"
          : "Trial is unavailable right now. Add your own API key (Groq keys are free)." },
      { status: 400 }
    );
  }

  const transcript = region
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${toModelContent(m.content)}`)
    .join("\n\n");
  const userPrompt = `Existing summary:\n${thread.summary ?? "(none yet)"}\n\nNew conversation chunk to merge in:\n\n${transcript}`;

  try {
    let summary = "";
    if (activeProvider === "groq") {
      const groq = new Groq({ apiKey });
      const res = await groq.chat.completions.create({
        messages: [
          { role: "system", content: DISTILL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        model, temperature: 0.2, max_tokens: 700,
      });
      summary = res.choices[0]?.message?.content ?? "";
    } else if (activeProvider === "openai") {
      const openai = new OpenAI({ apiKey });
      const res = await openai.chat.completions.create({
        messages: [
          { role: "system", content: DISTILL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        model, temperature: 0.2, max_tokens: 700,
      });
      summary = res.choices[0]?.message?.content ?? "";
    } else if (activeProvider === "anthropic") {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model, max_tokens: 700, system: DISTILL_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      });
      summary = res.content[0]?.type === "text" ? res.content[0].text : "";
    }
    if (!summary.trim()) return NextResponse.json({ error: "Empty summary" }, { status: 502 });

    const newAnchorId = region[region.length - 1].id;

    // Optimistic lock: only write if the anchor is unchanged since we read it,
    // so two concurrent runs can't clobber each other.
    let query = supabase
      .from("threads")
      .update({ summary: summary.trim(), summarized_up_to_message_id: newAnchorId })
      .eq("id", threadId);
    query = oldAnchor === null
      ? query.is("summarized_up_to_message_id", null)
      : query.eq("summarized_up_to_message_id", oldAnchor);
    const { data: updated } = await query.select("id");

    if (!updated?.length) return NextResponse.json({ skipped: true }); // lost the race

    return NextResponse.json({ summary: summary.trim(), anchorId: newAnchorId });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const isAuth = status === 401 || status === 403;
    return NextResponse.json(
      { error: isAuth ? "Invalid API key" : "Summarization failed" },
      { status: isAuth ? 401 : 500 }
    );
  }
}
