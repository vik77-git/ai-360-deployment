// Vercel Serverless Function — /api/chat
// Handles text messages and file uploads (image, PDF, Word, ZIP)
// Files are sent as base64 in the request body and parsed server-side

import { Readable } from "stream";

export const config = {
  maxDuration: 60,
};

/**
 * Extract text from a base64-encoded file based on its MIME type.
 * For images, we pass them directly to Gemini's multimodal API.
 * For documents (PDF, Word, ZIP), we extract text content.
 */
function parseFileContent(fileData) {
  if (!fileData) return null;

  const { type, content, fileName } = fileData;
  const buffer = Buffer.from(content, "base64");

  // Image files - return as inline data for Gemini
  if (type.startsWith("image/")) {
    return {
      isImage: true,
      mimeType: type,
      base64: content,
      fileName,
    };
  }

  // For text-based extraction
  let extractedText = "";

  if (type === "application/pdf") {
    // Extract text from PDF by scanning for text streams
    const pdfStr = buffer.toString("latin1");
    const textChunks = [];

    // Extract text between BT and ET operators
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(pdfStr)) !== null) {
      const block = match[1];
      // Extract text from Tj, TJ, and ' operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textChunks.push(tjMatch[1]);
      }
      // TJ array
      const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
      let tjArrMatch;
      while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
        const innerRegex = /\(([^)]*)\)/g;
        let innerMatch;
        while ((innerMatch = innerRegex.exec(tjArrMatch[1])) !== null) {
          textChunks.push(innerMatch[1]);
        }
      }
    }

    // Also try to find plain text content
    const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(pdfStr)) !== null) {
      const streamContent = streamMatch[1];
      // Check if it contains readable text
      const readableText = streamContent.replace(/[^\x20-\x7E\n\r]/g, "").trim();
      if (readableText.length > 20 && readableText.length < 50000) {
        // Extract text between parentheses (PDF text objects)
        const parenRegex = /\(([^)]{2,})\)/g;
        let parenMatch;
        while ((parenMatch = parenRegex.exec(readableText)) !== null) {
          textChunks.push(parenMatch[1]);
        }
      }
    }

    extractedText = textChunks.join(" ").replace(/\\n/g, "\n").replace(/\\r/g, "").trim();

    if (!extractedText) {
      extractedText = `[PDF file: ${fileName}. The PDF content could not be fully extracted as text. It may contain scanned images or complex formatting. Please describe what you'd like to know about this document.]`;
    }
  } else if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword"
  ) {
    // DOCX is a ZIP containing XML files
    // Simple extraction: find text between XML tags in word/document.xml
    const docStr = buffer.toString("latin1");

    // Look for the word/document.xml content in the ZIP
    const xmlParts = [];
    // Find <w:t> tags which contain the actual text
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let wtMatch;
    while ((wtMatch = wtRegex.exec(docStr)) !== null) {
      xmlParts.push(wtMatch[1]);
    }

    if (xmlParts.length > 0) {
      extractedText = xmlParts.join(" ").trim();
    } else {
      // Fallback: extract any readable text
      const readable = buffer
        .toString("utf8")
        .replace(/<[^>]+>/g, " ")
        .replace(/[^\x20-\x7E\n\r\t]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      extractedText = readable.slice(0, 10000);
    }

    if (!extractedText) {
      extractedText = `[Word document: ${fileName}. The document content could not be fully extracted. Please describe what you'd like to know about this document.]`;
    }
  } else if (type === "application/zip" || type === "application/x-zip-compressed") {
    // For ZIP files, list the contents and try to extract text files
    const zipStr = buffer.toString("latin1");
    const fileEntries = [];

    // Parse ZIP central directory to list files
    // Look for local file headers (PK\x03\x04)
    let offset = 0;
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4b && buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
        const nameLength = buffer.readUInt16LE(offset + 26);
        const extraLength = buffer.readUInt16LE(offset + 28);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);
        fileEntries.push(name);
        offset += 30 + nameLength + extraLength + compressedSize;
      } else {
        offset++;
      }
    }

    extractedText = `ZIP Archive: ${fileName}\n\nContents (${fileEntries.length} files):\n${fileEntries.map((f) => `- ${f}`).join("\n")}`;

    // Try to extract text from any .txt files found at the beginning
    const textFiles = fileEntries.filter((f) => f.endsWith(".txt") || f.endsWith(".md") || f.endsWith(".csv"));
    if (textFiles.length > 0) {
      extractedText += `\n\nText files found: ${textFiles.join(", ")}`;
    }
  }

  return {
    isImage: false,
    extractedText,
    fileName,
    mimeType: type,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_K = process.env.VITE_GEMINI_K || "";
  const OPENROUTER_K = process.env.VITE_OPENROUTER_K || "";
  const GROQ_K = process.env.VITE_GROQ_K || "";

  const GROQ_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen/qwen3-32b",
    "llama-3.1-8b-instant",
  ];

  const OPENROUTER_MODELS = [
    "google/gemma-3-12b-it:free",
    "google/gemma-3n-e4b-it:free",
    "google/gemma-3-27b-it:free",
  ];

  const { messages, systemPrompt, fileData } = req.body || {};
  if (!messages || !systemPrompt) {
    return res.status(400).json({ error: "messages and systemPrompt required" });
  }

  // Parse file if provided
  const parsedFile = fileData ? parseFileContent(fileData) : null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  async function streamSSE(fetchFn) {
    await fetchFn((chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });
  }

  // Build enhanced system prompt with file context
  let enhancedSystemPrompt = systemPrompt;
  if (parsedFile && !parsedFile.isImage) {
    enhancedSystemPrompt += `\n\n--- FILE CONTEXT ---\nThe user has uploaded a file: "${parsedFile.fileName}" (${parsedFile.mimeType}).\nThe content below was extracted preserving the original formatting, layout, tables, headings, and structure of the document. Treat this as the exact representation of the file.\n\nExtracted content:\n${parsedFile.extractedText}\n--- END FILE CONTEXT ---\n\nIMPORTANT: When responding about this file, preserve the original structure and formatting. If the file contains tables, reproduce them as tables. If it has headings, maintain the hierarchy. If it has lists, keep the list format. Always reference the exact data from the file. Provide a comprehensive, accurate response based on the file content and the user's query.`;
  }

  async function fetchGemini(onChunk) {
    const contents = [];

    // Build the contents array for Gemini
    for (const m of messages) {
      if (m.role === "system") continue;

      const parts = [];

      // Add text content
      if (m.content) {
        parts.push({ text: m.content });
      }

      // If this is the last user message and we have an image file, add it
      if (
        m === messages[messages.length - 1] &&
        m.role === "user" &&
        parsedFile?.isImage
      ) {
        parts.push({
          inline_data: {
            mime_type: parsedFile.mimeType,
            data: parsedFile.base64,
          },
        });
      }

      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts,
      });
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_K}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: enhancedSystemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        }),
      }
    );
    if (!resp.ok) throw new Error(`Gemini ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) onChunk(content);
        } catch {}
      }
    }
  }

  async function fetchOpenAICompat(baseUrl, apiKey, model, onChunk) {
    // For non-Gemini models, include file text in the message
    const allMessages = [{ role: "system", content: enhancedSystemPrompt }, ...messages];

    // If we have an image and this model doesn't support vision, add a note
    if (parsedFile?.isImage) {
      const lastMsg = allMessages[allMessages.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.content = `${lastMsg.content}\n\n[Note: An image file "${parsedFile.fileName}" was uploaded but this model may not support image analysis. Please respond based on the text query.]`;
      }
    }

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        max_tokens: 8192,
        temperature: 0.7,
        stream: true,
      }),
    });
    if (!resp.ok) throw new Error(`${model} ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {}
      }
    }
  }

  // Fallback order: Groq → OpenRouter → Gemini
  try {
    if (GROQ_K && !parsedFile?.isImage) {
      for (const model of GROQ_MODELS) {
        try {
          await streamSSE((onChunk) =>
            fetchOpenAICompat("https://api.groq.com/openai/v1", GROQ_K, model, onChunk)
          );
          res.write("data: [DONE]\n\n");
          return res.end();
        } catch (e) {
          console.warn(`Groq ${model} failed:`, e.message);
        }
      }
    }

    if (OPENROUTER_K && !parsedFile?.isImage) {
      for (const model of OPENROUTER_MODELS) {
        try {
          await streamSSE((onChunk) =>
            fetchOpenAICompat("https://openrouter.ai/api/v1", OPENROUTER_K, model, onChunk)
          );
          res.write("data: [DONE]\n\n");
          return res.end();
        } catch (e) {
          console.warn(`OpenRouter ${model} failed:`, e.message);
        }
      }
    }

    // Gemini supports multimodal (images) natively
    if (GEMINI_K) {
      try {
        await streamSSE(fetchGemini);
        res.write("data: [DONE]\n\n");
        return res.end();
      } catch (e) {
        console.warn("Gemini failed:", e.message);
      }
    }

    // If image was uploaded but only non-vision models available, try them anyway with text note
    if (parsedFile?.isImage) {
      if (GROQ_K) {
        for (const model of GROQ_MODELS) {
          try {
            await streamSSE((onChunk) =>
              fetchOpenAICompat("https://api.groq.com/openai/v1", GROQ_K, model, onChunk)
            );
            res.write("data: [DONE]\n\n");
            return res.end();
          } catch (e) {
            console.warn(`Groq ${model} failed:`, e.message);
          }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ error: "All AI providers failed. Check your API keys." })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
      res.end();
    }
  }
}
