import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 });

  const { key, provider = "groq" } = await request.json();
  if (!key?.trim()) return NextResponse.json({ valid: false, error: "No key provided" });

  try {
    if (provider === "groq") {
      const groq = new Groq({ apiKey: key.trim() });
      await groq.chat.completions.create({
        messages: [{ role: "user", content: "hi" }],
        model: "llama-3.1-8b-instant",
        max_tokens: 1,
      });
    } else if (provider === "openai") {
      const openai = new OpenAI({ apiKey: key.trim() });
      await openai.chat.completions.create({
        messages: [{ role: "user", content: "hi" }],
        model: "gpt-4o-mini",
        max_tokens: 1,
      });
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: key.trim() });
      await anthropic.messages.create({
        messages: [{ role: "user", content: "hi" }],
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1,
      });
    } else {
      return NextResponse.json({ valid: false, error: "Unknown provider" });
    }
    return NextResponse.json({ valid: true });
  } catch (err: any) {
    const isAuthError = err?.status === 401 || err?.status === 403;
    return NextResponse.json({
      valid: false,
      error: isAuthError ? "Invalid API key" : (err?.message ?? "Validation failed"),
    });
  }
}
