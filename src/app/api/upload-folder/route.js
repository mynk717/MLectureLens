import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    const paths = formData.getAll("paths");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    console.log(`[UPLOAD] Processing ${files.length} files`);

    // Create data directory structure
    const dataDir = path.join(process.cwd(), "data");
    const rawDir = path.join(dataDir, "raw");
    const processedDir = path.join(dataDir, "processed");

    // Ensure directories exist
    await mkdir(dataDir, { recursive: true });
    await mkdir(rawDir, { recursive: true });
    await mkdir(processedDir, { recursive: true });

    const sessionId = Date.now().toString();
    const sessionDir = path.join(rawDir, sessionId);
    await mkdir(sessionDir, { recursive: true });

    let processedFiles = 0;
    const courseStructure = {};
    const parsedDocuments = [];

    // Process each uploaded file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = paths[i] || file.name;

      // Only process SRT and VTT files
      if (!relativePath.match(/\.(srt|vtt)$/i)) {
        console.log(`[UPLOAD] Skipping non-subtitle file: ${relativePath}`);
        continue;
      }

      console.log(`[UPLOAD] Processing: ${relativePath}`);

      // Extract course structure from path
      const pathParts = relativePath.split("/").filter(part => part.length > 0);
      const course = pathParts[0] || "Unknown Course";
      const chapter = pathParts[1] || "Unknown Chapter";
      const filename = pathParts[pathParts.length - 1];

      // Create directory structure
      const filePath = path.join(sessionDir, relativePath);
      const fileDir = path.dirname(filePath);

      if (!existsSync(fileDir)) {
        await mkdir(fileDir, { recursive: true });
      }

      // Write file to disk
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Parse subtitle content
      const content = buffer.toString("utf-8");
      const cleanedContent = parseSubtitleFile(content, relativePath);

      if (cleanedContent.trim()) {
        // Create document entry
        const documentId = `${course}_${chapter}_${filename}`.replace(
          /[^a-zA-Z0-9_]/g,
          "_"
        );

        parsedDocuments.push({
          id: documentId,
          content: cleanedContent,
          metadata: {
            course: course,
            chapter: chapter,
            filename: filename,
            originalPath: relativePath,
            type: path.extname(filename).toLowerCase(),
          },
        });

        // Track course structure
        if (!courseStructure[course]) {
          courseStructure[course] = {};
        }
        if (!courseStructure[course][chapter]) {
          courseStructure[course][chapter] = [];
        }
        courseStructure[course][chapter].push(filename);
      }

      processedFiles++;
    }

    // Save parsed documents
    const documentsPath = path.join(
      processedDir,
      `documents_${sessionId}.json`
    );
    await writeFile(documentsPath, JSON.stringify(parsedDocuments, null, 2));

    console.log(`[UPLOAD] Successfully processed ${processedFiles} files`);
    console.log(`[UPLOAD] Generated ${parsedDocuments.length} documents`);

    return NextResponse.json({
      success: true,
      filesProcessed: processedFiles,
      documentsGenerated: parsedDocuments.length,
      sessionId: sessionId,
      courseStructure: courseStructure,
      documentsPath: documentsPath,
    });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json(
      { error: "Upload processing failed", details: error.message },
      { status: 500 }
    );
  }
}

// 🔥 ENHANCED parseSubtitleFile function with better number removal
function parseSubtitleFile(content, filename) {
  try {
    let cleanText = "";

    if (filename.toLowerCase().endsWith(".srt")) {
      // Parse SRT format
      const subtitleBlocks = content
        .split("\n\n")
        .filter(block => block.trim());

      for (const block of subtitleBlocks) {
        const lines = block.split("\n");
        if (lines.length >= 3) {
          // Skip sequence number and timestamp, get text content
          const textLines = lines.slice(2);
          const text = textLines.join(" ").trim();
          if (text) {
            cleanText += text + " ";
          }
        }
      }
    } else if (filename.toLowerCase().endsWith(".vtt")) {
      // Parse VTT format
      const lines = content.split("\n");
      let inTextBlock = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip WebVTT header and metadata
        if (
          trimmedLine.startsWith("WEBVTT") ||
          trimmedLine.startsWith("NOTE") ||
          trimmedLine === ""
        ) {
          continue;
        }

        // Skip timestamp lines
        if (trimmedLine.includes("-->")) {
          inTextBlock = true;
          continue;
        }

        // Collect text content
        if (inTextBlock && trimmedLine) {
          cleanText += trimmedLine + " ";
        }
      }
    }

    // 🔥 ENHANCED CLEANING: Remove all unwanted elements
    return cleanText
      .replace(/\[.*?\]/g, "") // Remove stage directions [music], [applause]
      .replace(/\(.*?\)/g, "") // Remove parenthetical notes (pause), (clears throat)
      .replace(/\b\d+\s+/g, "") // 🔥 NEW: Remove standalone numbers (1, 2, 3, 4, etc.)
      .replace(/^\d+\s*/gm, "") // 🔥 NEW: Remove numbers at start of lines
      .replace(/\s+\d+\s+/g, " ") // 🔥 NEW: Remove numbers between words
      .replace(/\d+\./g, "") // 🔥 NEW: Remove numbered lists (1., 2., 3.)
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\s+([.!?])/g, "$1") // Fix punctuation spacing
      .replace(/\s*,\s*/g, ", ") // Fix comma spacing
      .replace(/\s*\.\s*/g, ". ") // Fix period spacing
      .replace(/^\s+|\s+$/g, "") // Trim start and end
      .trim();
  } catch (error) {
    console.error(`[PARSE ERROR] Failed to parse ${filename}:`, error);
    return "";
  }
}
