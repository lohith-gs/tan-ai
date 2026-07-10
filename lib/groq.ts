// lib/groq.ts
import Groq from "groq-sdk";

function getClient(apiKey: string) {
  return new Groq({ apiKey });
}

export async function generateCheckpoints(
  aiResponse: string,
  apiKey: string
): Promise<string[]> {
  const groq = getClient(apiKey);

  const prompt = `You just gave this response:
"${aiResponse}"

Generate 2-4 potential follow-up questions a user might have. These will become clickable branch points.

Rules:
- Questions should be 5-10 words max
- Focus on common points of confusion or deeper exploration
- Format as a simple list, one per line
- No numbering or bullets

Example output:
What are Server Components?
How does this compare to Client Components?
Can you show an example?`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "You generate concise, relevant follow-up questions for educational conversations.",
      },
      { role: "user", content: prompt },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.8,
    max_tokens: 200,
  });

  const response = completion.choices[0]?.message?.content || "";

  return response
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.length < 100);
}
