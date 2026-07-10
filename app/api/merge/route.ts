import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

const SYNTHESIS_SYSTEM = `You merge insights from a side exploration (a "branch") back into a main conversation.
Given the branch conversation transcript, produce a concise synthesis that will be injected into the main conversation as context.

Capture:
- Key findings and conclusions reached in the branch
- Decisions made and their reasoning
- Concrete facts, numbers, or code worth carrying forward

Rules:
- Write a compact briefing, not a narrative ("the user asked... the AI said...")
- No preamble, no meta-commentary, no pleasantries
- Use markdown. Keep it under 250 words.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { branchName, messages } = await request.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No branch messages to merge" }, { status: 422 });
  }

  const transcript = messages
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const userPrompt = `Branch topic: "${branchName}"\n\nBranch conversation:\n\n${transcript}`;

  try {
    let synthesis = "";

    if (activeProvider === "groq") {
      const groq = new Groq({ apiKey });
      const res = await groq.chat.completions.create({
        messages: [
          { role: "system", content: SYNTHESIS_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        model,
        temperature: 0.3,
        max_tokens: 600,
      });
      synthesis = res.choices[0]?.message?.content ?? "";
    } else if (activeProvider === "openai") {
      const openai = new OpenAI({ apiKey });
      const res = await openai.chat.completions.create({
        messages: [
          { role: "system", content: SYNTHESIS_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        model,
        temperature: 0.3,
        max_tokens: 600,
      });
      synthesis = res.choices[0]?.message?.content ?? "";
    } else if (activeProvider === "anthropic") {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model,
        max_tokens: 600,
        system: SYNTHESIS_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      });
      synthesis = res.content[0]?.type === "text" ? res.content[0].text : "";
    }

    if (!synthesis.trim()) {
      return NextResponse.json({ error: "Empty synthesis from model" }, { status: 502 });
    }
    return NextResponse.json({ synthesis: synthesis.trim() });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const isAuth = status === 401 || status === 403;
    return NextResponse.json(
      { error: isAuth ? "Invalid API key" : "Merge synthesis failed" },
      { status: isAuth ? 401 : 500 }
    );
  }
}
