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
  const { productName, productDescription, productLink, type } =
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

  if (type !== "COLD" && type !== "FOLLOW-UP") {
    return NextResponse.json(
      { error: "type must be COLD or FOLLOW-UP." },
      { status: 400 }
    );
  }

  const productContext = productLink
    ? `Product Name: ${productName}\nProduct Description: ${productDescription}\nProduct Link: ${productLink}`
    : `Product Name: ${productName}\nProduct Description: ${productDescription}`;

  const emailTypeInstruction =
    type === "COLD"
      ? "a cold outreach email introducing the product to a potential lead for the first time"
      : "a follow-up email sent 5 days after the first-touch email to a lead who has not responded yet, to remind, re-engage or move the conversation forward";

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a marketing expert. Given a product's details, generate ${emailTypeInstruction}.

Return a JSON object with exactly two fields:
1. "emailSubject": A compelling email subject line.
2. "emailBody": A professional, engaging email body.

IMPORTANT rules for the emailBody:
- You may use {{name}} as a placeholder for the recipient's business or contact name — it will be replaced at send time.
- Do NOT use any other placeholders (e.g. [Your Name], [Company Name]).
- If a product link is provided, embed the actual URL directly in the email text.
- The email should be ready to send with only {{name}} as the sole placeholder.

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
      emailSubject: parsed.emailSubject || "",
      emailBody: parsed.emailBody || "",
    });
  } catch (error: any) {
    console.error("OpenAI generate-template error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate email template." },
      { status: 500 }
    );
  }
}
