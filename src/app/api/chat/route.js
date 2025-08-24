import { streamText, convertToModelMessages } from "ai"; // 🔑 ADD convertToModelMessages
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      console.error("[API ERROR] Missing GOOGLE_API_KEY");
      return new Response("API key not configured", { status: 500 });
    }

    const { messages } = await req.json();

    console.log("[API DEBUG] Processing messages:", messages?.length || 0);

    const result = await streamText({
      model: google("models/gemini-2.5-flash"),
      messages: convertToModelMessages(messages), // 🔑 CONVERT UIMessages to ModelMessages
      temperature: 0.7,
      maxTokens: 2000,
    });

    console.log("[API DEBUG] Stream created, returning response");

    // Try these methods in order:
    if (typeof result.toUIMessageStreamResponse === "function") {
      return result.toUIMessageStreamResponse();
    }

    if (typeof result.toTextStreamResponse === "function") {
      return result.toTextStreamResponse();
    }

    if (typeof result.toAIStreamResponse === "function") {
      return result.toAIStreamResponse();
    }

    // Fallback
    throw new Error("No valid stream response method found");
  } catch (error) {
    console.error("[API ERROR]", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
