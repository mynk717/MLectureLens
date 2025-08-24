import { streamText, convertToModelMessages } from "ai";
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

    const { messages, sessionId } = await req.json();

    console.log("[API DEBUG] Processing messages:", messages?.length || 0);
    console.log("[API DEBUG] Session ID:", sessionId);

    const lastMessage = messages[messages.length - 1];
    const userQuery =
      lastMessage?.parts?.[0]?.text || lastMessage?.content || "";

    // Perform RAG search if we have a sessionId and user query
    let contextText = "";
    let sources = [];

    if (sessionId && userQuery) {
      try {
        console.log("[RAG] Searching for relevant content...");

        const searchResponse = await fetch(
          `${
            process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000"
          }/api/search`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: userQuery,
              sessionId: sessionId,
              limit: 3,
            }),
          }
        );

        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();

          if (searchResults.results && searchResults.results.length > 0) {
            contextText = searchResults.results
              .map(
                result =>
                  `[${result.metadata.course} - ${result.metadata.chapter}]\n${result.content}`
              )
              .join("\n\n---\n\n");

            sources = searchResults.results.map(result => ({
              course: result.metadata.course,
              chapter: result.metadata.chapter,
              filename: result.metadata.filename,
              score: result.score,
            }));

            console.log(
              `[RAG] Found ${searchResults.results.length} relevant documents`
            );
          }
        }
      } catch (error) {
        console.error("[RAG ERROR]", error);
        // Continue without RAG if search fails
      }
    }

    // Enhance the conversation with retrieved context
    let enhancedMessages = convertToModelMessages(messages);

    if (contextText) {
      // Add system message with context
      enhancedMessages = [
        {
          role: "system",
          content: `You are MLectureLens, an AI assistant that helps students with Node.js and Python programming courses. 

Use the following relevant course content to answer the user's question. If the context doesn't contain relevant information, provide a helpful general answer but mention that you don't have specific course material on that topic.

RELEVANT COURSE CONTENT:
${contextText}

Always cite which course and chapter your information comes from when referencing the provided content.`,
        },
        ...enhancedMessages,
      ];
    }

    const result = await streamText({
      model: google("models/gemini-2.5-flash"),
      messages: enhancedMessages,
      temperature: 0.7,
      maxTokens: 2000,
    });

    console.log("[API DEBUG] Stream created, returning response");

    // Use the method that works for your AI SDK version
    if (typeof result.toUIMessageStreamResponse === "function") {
      return result.toUIMessageStreamResponse();
    } else if (typeof result.toTextStreamResponse === "function") {
      return result.toTextStreamResponse();
    } else {
      return result.toDataStreamResponse();
    }
  } catch (error) {
    console.error("[API ERROR] Full error:", error);
    return new Response(
      JSON.stringify({
        error: "Stream creation failed",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
