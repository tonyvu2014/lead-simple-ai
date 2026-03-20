import { NextResponse } from "next/server";
import OpenAI from "openai";

let openai: OpenAI;

function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function POST(request: Request) {
  const { prompt } = await request.json();

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json(
      { error: "A search prompt is required." },
      { status: 400 }
    );
  }

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a business research assistant. When given a description of a type of business and location, return a JSON object with a "businesses" key containing an array of businesses matching that description. You MUST return as many businesses as possible, aim for at least 50 to 100 results. Do not stop early. Each object in the array must have "name" (string) and "email" (string) fields. Return ONLY the JSON object, no other text. Example format:
{"businesses": [{"name": "ABC Plumbing", "email": "info@abcplumbing.com"}, {"name": "XYZ Plumbing", "email": "contact@xyzplumbing.com"}]}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 16000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from OpenAI." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(content);
    const businesses = Array.isArray(parsed)
      ? parsed
      : parsed.businesses || parsed.results || [];

    return NextResponse.json({ businesses });
  } catch (error: any) {
    console.error("OpenAI search error:", error.message);
    return NextResponse.json(
      { error: "Failed to search for businesses." },
      { status: 500 }
    );
  }
}
