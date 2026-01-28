"use client";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export async function processWithAI(
  text: string,
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("API key required");
  }

  if (!prompt) {
    return text;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://everlast.app",
      "X-Title": "Everlast",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const result = data.choices?.[0]?.message?.content;
  if (!result) {
    throw new Error("No response from AI");
  }

  return result.trim();
}
