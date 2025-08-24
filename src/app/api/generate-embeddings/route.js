import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response("Session ID required", { status: 400 });
    }

    console.log(`[EMBEDDINGS] Processing session: ${sessionId}`);

    // 🔥 FIX: Declare processedDir BEFORE using it
    const processedDir = path.join(process.cwd(), "data", "processed");
    const documentsPath = path.join(
      processedDir,
      `documents_${sessionId}.json`
    );

    if (!existsSync(documentsPath)) {
      return new Response("Documents not found", { status: 404 });
    }

    const documentsData = await readFile(documentsPath, "utf8");
    const documents = JSON.parse(documentsData);

    console.log(`[EMBEDDINGS] Found ${documents.length} documents to embed`);

    // Check for existing embeddings to resume processing
    const existingEmbeddingsPath = path.join(
      processedDir,
      `embeddings_${sessionId}.json`
    );
    let existingEmbeddings = [];

    if (existsSync(existingEmbeddingsPath)) {
      const existingData = await readFile(existingEmbeddingsPath, "utf8");
      existingEmbeddings = JSON.parse(existingData);
    }

    const existingIds = new Set(existingEmbeddings.map(e => e.id));
    const documentsToProcess = documents.filter(
      doc => !existingIds.has(doc.id)
    );

    console.log(
      `[EMBEDDINGS] Found ${existingEmbeddings.length} existing embeddings`
    );
    console.log(
      `[EMBEDDINGS] Processing ${documentsToProcess.length} remaining documents`
    );

    // Use AI SDK embedding pattern with improved rate limiting
    const embeddingModel = google.textEmbedding("gemini-embedding-001");
    const newEmbeddings = [];
    const batchSize = 5; // Reduced for better quota management

    for (let i = 0; i < documentsToProcess.length; i += batchSize) {
      const batch = documentsToProcess.slice(i, i + batchSize);

      console.log(
        `[EMBEDDINGS] Processing batch ${i / batchSize + 1}/${Math.ceil(
          documentsToProcess.length / batchSize
        )}`
      );

      for (const doc of batch) {
        try {
          // Chunk large documents to avoid payload size limits
          const chunks = chunkDocument(doc.content, 25000);

          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const { embedding } = await embed({
              model: embeddingModel,
              value: chunks[chunkIndex],
              providerOptions: {
                google: {
                  taskType: "RETRIEVAL_DOCUMENT",
                  outputDimensionality: 768,
                },
              },
            });

            newEmbeddings.push({
              id: chunks.length > 1 ? `${doc.id}_chunk_${chunkIndex}` : doc.id,
              content: chunks[chunkIndex],
              metadata: {
                ...doc.metadata,
                isChunk: chunks.length > 1,
                chunkIndex: chunkIndex,
                totalChunks: chunks.length,
              },
              embedding: embedding,
            });

            console.log(
              `[EMBEDDINGS] ✅ Embedded document ${doc.id}${
                chunks.length > 1
                  ? ` (chunk ${chunkIndex + 1}/${chunks.length})`
                  : ""
              }`
            );

            // Increased delay for quota management
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(
            `[EMBEDDINGS] ❌ Error embedding document ${doc.id}:`,
            error.message
          );
        }
      }

      // Longer delay between batches
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Combine existing and new embeddings
    const allEmbeddings = [...existingEmbeddings, ...newEmbeddings];

    // Save all embeddings
    await writeFile(
      existingEmbeddingsPath,
      JSON.stringify(allEmbeddings, null, 2)
    );

    console.log(
      `[EMBEDDINGS] ✅ Generated ${newEmbeddings.length} new embeddings`
    );
    console.log(`[EMBEDDINGS] ✅ Total embeddings: ${allEmbeddings.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        embeddingsGenerated: newEmbeddings.length,
        totalEmbeddings: allEmbeddings.length,
        sessionId: sessionId,
        embeddingsPath: existingEmbeddingsPath,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[EMBEDDINGS ERROR]", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Helper function to chunk large documents
function chunkDocument(content, maxChunkSize = 25000) {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks = [];
  for (let i = 0; i < content.length; i += maxChunkSize) {
    chunks.push(content.substring(i, i + maxChunkSize));
  }
  return chunks;
}
