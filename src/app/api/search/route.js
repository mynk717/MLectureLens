import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { query, sessionId, limit = 5 } = await req.json();

    if (!query) {
      return new Response("Query required", { status: 400 });
    }

    console.log(`[SEARCH] Searching for: "${query}"`);

    // Generate embedding for the query
    const embeddingModel = google.textEmbedding("gemini-embedding-001");
    const { embedding: queryEmbedding } = await embed({
      model: embeddingModel,
      value: query,
      providerOptions: {
        google: {
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: 768,
        },
      },
    });

    // Load stored embeddings
    const processedDir = path.join(process.cwd(), "data", "processed");
    const embeddingsPath = path.join(
      processedDir,
      `embeddings_${sessionId}.json`
    );

    if (!existsSync(embeddingsPath)) {
      return new Response("Embeddings not found", { status: 404 });
    }

    const embeddingsData = await readFile(embeddingsPath, "utf8");
    const embeddings = JSON.parse(embeddingsData);

    console.log(`[SEARCH] Loaded ${embeddings.length} embeddings`);

    // Calculate similarity scores
    const results = embeddings.map(doc => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    // Sort by similarity score (highest first) and limit results
    const topResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[SEARCH] Found ${topResults.length} relevant documents`);

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        results: topResults.map(result => ({
          id: result.id,
          content: result.content,
          metadata: result.metadata,
          score: result.score,
        })),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[SEARCH ERROR]", error);
    return new Response(`Search error: ${error.message}`, { status: 500 });
  }
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
