import { NextRequest, NextResponse } from "next/server";
import { generateCheckpoints } from "@/lib/groq";
import { createClient } from "@/utils/supabase/server";
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const CHECKPOINT_SENTINEL = "\n[CHECKPOINTS]";
export const STREAM_ERROR_SENTINEL = "\n[STREAM_ERROR]";

const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("groq_api_key, openai_api_key, anthropic_api_key, active_provider, active_model")
    .eq("id", user.id)
    .single();

  const keyMap: Record<string, string | null | undefined> = {
    groq: profile?.groq_api_key,
    openai: profile?.openai_api_key,
    anthropic: profile?.anthropic_api_key,
  };

  const { messages, provider: overrideProvider, model: overrideModel } = await request.json();

  // Per-thread model pin (branch compare) — honored only if that provider's key exists
  let activeProvider: string = profile?.active_provider ?? "groq";
  let model: string = profile?.active_model ?? DEFAULT_MODELS[activeProvider] ?? DEFAULT_MODELS.groq;
  if (typeof overrideProvider === "string" && keyMap[overrideProvider]?.trim()) {
    activeProvider = overrideProvider;
    model = typeof overrideModel === "string" && overrideModel
      ? overrideModel
      : DEFAULT_MODELS[overrideProvider] ?? model;
  }

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

  const groqKeyForCheckpoints = profile?.groq_api_key?.trim() ?? (!hasOwnKeys ? trialKey ?? null : null);
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = "";

      function fail(error: string, isKeyError: boolean) {
        controller.enqueue(
          encoder.encode(`${STREAM_ERROR_SENTINEL}${JSON.stringify({ error, isKeyError })}`)
        );
        controller.close();
      }

      try {
        if (activeProvider === "groq") {
          const groq = new Groq({ apiKey });
          let stream;
          try {
            stream = await groq.chat.completions.create({
              messages,
              model,
              temperature: 0.7,
              max_tokens: 1024,
              stream: true,
            });
          } catch (err: any) {
            const isAuth = err?.status === 401 || err?.status === 403;
            fail(isAuth ? "Invalid API key" : "Failed to reach Groq", isAuth);
            return;
          }
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) { fullText += text; controller.enqueue(encoder.encode(text)); }
            }
          } catch (err: any) {
            const isAuth = err?.status === 401 || err?.status === 403;
            fail(isAuth ? "Invalid API key" : "Stream interrupted", isAuth);
            return;
          }

        } else if (activeProvider === "openai") {
          const openai = new OpenAI({ apiKey });
          let stream;
          try {
            stream = await openai.chat.completions.create({
              messages,
              model,
              temperature: 0.7,
              max_tokens: 1024,
              stream: true,
            });
          } catch (err: any) {
            const isAuth = err?.status === 401 || err?.status === 403;
            fail(isAuth ? "Invalid API key" : "Failed to reach OpenAI", isAuth);
            return;
          }
          try {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) { fullText += text; controller.enqueue(encoder.encode(text)); }
            }
          } catch (err: any) {
            const isAuth = err?.status === 401 || err?.status === 403;
            fail(isAuth ? "Invalid API key" : "Stream interrupted", isAuth);
            return;
          }

        } else if (activeProvider === "anthropic") {
          const anthropic = new Anthropic({ apiKey });
          const systemMsg = messages.find((m: any) => m.role === "system")?.content as string | undefined;
          const userMessages = messages.filter((m: any) => m.role !== "system");
          let stream;
          try {
            stream = await anthropic.messages.create({
              messages: userMessages,
              model,
              max_tokens: 1024,
              stream: true,
              ...(systemMsg ? { system: systemMsg } : {}),
            });
          } catch (err: any) {
            const isAuth = err?.status === 401 || err?.status === 403;
            fail(isAuth ? "Invalid API key" : "Failed to reach Anthropic", isAuth);
            return;
          }
          try {
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                const text = event.delta.text;
                if (text) { fullText += text; controller.enqueue(encoder.encode(text)); }
              }
            }
          } catch (err: any) {
            const isAuth = err?.status === 401 || err?.status === 403;
            fail(isAuth ? "Invalid API key" : "Stream interrupted", isAuth);
            return;
          }
        }

        // Checkpoint generation — always use Groq (fast/free), skip if no Groq key
        if (groqKeyForCheckpoints && fullText) {
          try {
            const checkpoints = await generateCheckpoints(fullText, groqKeyForCheckpoints);
            controller.enqueue(
              encoder.encode(`${CHECKPOINT_SENTINEL}${JSON.stringify(checkpoints)}`)
            );
          } catch {
            // checkpoints are optional
          }
        }

        controller.close();
      } catch {
        fail("Something went wrong", false);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
