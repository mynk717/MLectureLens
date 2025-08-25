import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
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

    const baseDir = "/tmp/data";
    const rawDir = path.join(baseDir, "raw");
    const processedDir = path.join(baseDir, "processed");

    // Ensure directories exist
    await mkdir(rawDir, { recursive: true });
    await mkdir(processedDir, { recursive: true });

    const sessionId = Date.now().toString();
    const sessionDir = path.join(rawDir, sessionId);
    await mkdir(sessionDir, { recursive: true });

    let processedFiles = 0;
    const courseStructure = {};
    const parsedDocuments = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = paths[i] || file.name;

      // Only process subtitle files (SRT/VTT)
      if (!relativePath.match(/\.(srt|vtt)$/i)) {
        console.log(`[UPLOAD] Skipping non-subtitle file: ${relativePath}`);
        continue;
      }

      console.log(`[UPLOAD] Processing: ${relativePath}`);

      // Extract course/chapter info from path
      const pathParts = relativePath.split("/").filter(Boolean);
      const course = pathParts[0] || "Unknown Course";
      const chapter = pathParts[1] || "Unknown Chapter";
      const filename = pathParts[pathParts.length - 1];

      // Create full file path
      const filePath = path.join(sessionDir, relativePath);
      const fileDir = path.dirname(filePath);
      await mkdir(fileDir, { recursive: true });

      // Write file to /tmp
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Parse subtitle content (use your parseSubtitleFile method)
      const content = buffer.toString("utf-8");
      const cleanedContent = parseSubtitleFile(content, relativePath);

      if (cleanedContent.trim()) {
        const documentId = `${course}_${chapter}_${filename}`.replace(/[^a-zA-Z0-9_]/g, "_");

        parsedDocuments.push({
          id: documentId,
          content: cleanedContent,
          metadata: {
            course,
            chapter,
            filename,
            originalPath: relativePath,
            type: path.extname(filename).toLowerCase(),
          },
        });

        // Build course structure map
        courseStructure[course] = courseStructure[course] || {};
        courseStructure[course][chapter] = courseStructure[course][chapter] || [];
        courseStructure[course][chapter].push(filename);
      }

      processedFiles++;
    }

    // Save parsed documents JSON in /tmp processed dir
    const documentsPath = path.join(processedDir, `documents_${sessionId}.json`);
    await writeFile(documentsPath, JSON.stringify(parsedDocuments, null, 2));

    console.log(`[UPLOAD] Successfully processed ${processedFiles} files`);
    console.log(`[UPLOAD] Generated ${parsedDocuments.length} documents`);

    return NextResponse.json({
      success: true,
      filesProcessed: processedFiles,
      documentsGenerated: parsedDocuments.length,
      sessionId,
      courseStructure,
      documentsPath,
    });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json({ error: "Upload processing failed", details: error.message }, { status: 500 });
  }
}

// Example parseSubtitleFile function (reuse your existing enhanced version)
function parseSubtitleFile(content, filename) {
  try {
    let cleanText = "";

    if (filename.toLowerCase().endsWith(".srt")) {
      const subtitleBlocks = content.split("\n\n").filter(block => block.trim());
      for (const block of subtitleBlocks) {
        const lines = block.split("\n");
        if (lines.length >= 3) {
          const textLines = lines.slice(2);
          const text = textLines.join(" ").trim();
          if (text) cleanText += text + " ";
        }
      }
    } else if (filename.toLowerCase().endsWith(".vtt")) {
      const lines = content.split("\n");
      let inTextBlock = false;
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("WEBVTT") || trimmedLine.startsWith("NOTE") || trimmedLine === "") continue;
        if (trimmedLine.includes("-->")) { inTextBlock = true; continue; }
        if (inTextBlock && trimmedLine) cleanText += trimmedLine + " ";
      }
    }

    return cleanText
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\b\d+\s+/g, "")
      .replace(/^\d+\s*/gm, "")
      .replace(/\s+\d+\s+/g, " ")
      .replace(/\d+\./g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([.!?])/g, "$1")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s*\.\s*/g, ". ")
      .replace(/^\s+|\s+$/g, "")
      .trim();
  } catch (error) {
    console.error(`[PARSE ERROR] Failed to parse ${filename}:`, error);
    return "";
  }
}
