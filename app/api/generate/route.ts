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
  const { productName, productDescription, productLink } =
    await request.json();

  if (!productName || typeof productName !== "string") {
    return NextResponse.json(
      { error: "Product name is required." },
      { status: 400 }
    );
  }

  if (!productDescription || typeof productDescription !== "string") {
    return NextResponse.json(
      { error: "Product description is required." },
      { status: 400 }
    );
  }

  const wordCount = productDescription.trim().split(/\s+/).length;
  if (wordCount < 10 || wordCount > 300) {
    return NextResponse.json(
      { error: "Product description must be between 10 and 300 words." },
      { status: 400 }
    );
  }

  try {
    const productContext = productLink
      ? `Product Name: ${productName}\nProduct Description: ${productDescription}\nProduct Link: ${productLink}`
      : `Product Name: ${productName}\nProduct Description: ${productDescription}`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a marketing expert. Given a product's details, return a JSON object with exactly one field:
1. "targetAudience": A concise description of the recommended target audience for outreach (e.g. "Small and medium plumbing businesses in Sydney, NSW").

Return ONLY the JSON object, no other text.`,
        },
        {
          role: "user",
          content: productContext,
        },
      ],
      temperature: 0.7,
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

    return NextResponse.json({
      targetAudience: parsed.targetAudience || "",
    });
  } catch (error: any) {
    console.error("OpenAI generate error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate target audience." },
      { status: 500 }
    );
  }
}
