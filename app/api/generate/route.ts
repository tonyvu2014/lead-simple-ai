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
  if (wordCount < 50 || wordCount > 300) {
    return NextResponse.json(
      { error: "Product description must be between 50 and 300 words." },
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
          content: `You are a marketing expert. Given a product's details, generate a JSON object with exactly three fields:
1. "targetAudience": A concise description of the recommended target audience for outreach (e.g. "Small and medium plumbing businesses in Sydney, NSW").
2. "emailSubject": A compelling email subject line to promote/introduce the product to potential leads.
3. "emailBody": A convincing marketing email body to send to potential leads. The email should be professional, engaging, and highlight the product's value proposition.

IMPORTANT rules for the emailBody:
- Do NOT include any placeholders for recipient personal details (e.g. [Recipient Name], [Your Name], [Company Name], Dear [Name], etc.). Write the email in a generic way that can be sent to anyone without modification.
- If a product link is provided, embed the actual URL directly in the email text. Do NOT use placeholders like [Product Link] or [URL].
- The email should be ready to send as-is with no manual edits needed.

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
      emailSubject: parsed.emailSubject || "",
      emailBody: parsed.emailBody || "",
    });
  } catch (error: any) {
    console.error("OpenAI generate error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate marketing content." },
      { status: 500 }
    );
  }
}
