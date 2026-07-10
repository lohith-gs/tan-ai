import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.',
      { status: 500 }
    );
  }

  const { messages } = await request.json();

  const result = streamText({
    model: anthropic('claude-opus-4-5'),
    system:
      'You are a helpful, knowledgeable AI assistant. Format responses using markdown when it improves clarity — use code blocks for code, bold for key terms, and bullet lists for enumerations. Be concise but thorough.',
    messages,
  });

  return result.toTextStreamResponse();
}
