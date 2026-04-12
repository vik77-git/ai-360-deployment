import Tesseract from "tesseract.js";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedFileResult {
  text: string;
  fileName: string;
  mimeType: string;
}

/**
 * Parse text from image using Tesseract.js OCR — preserves spatial layout
 */
async function parseImage(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: () => {},
  });

  // Use block/line structure from Tesseract to preserve layout
  const ocrData = data as any;
  if (ocrData.paragraphs && ocrData.paragraphs.length > 0) {
    const blocks: string[] = [];
    for (const para of ocrData.paragraphs) {
      const lines: string[] = [];
      for (const line of para.lines) {
        const words = line.words.map((w: any) => w.text).join(" ");
        if (words.trim()) lines.push(words);
      }
      if (lines.length > 0) blocks.push(lines.join("\n"));
    }
    if (blocks.length > 0) return blocks.join("\n\n");
  }

  return data.text || "[No text could be extracted from the image]";
}

/**
 * Parse text from PDF using pdf.js — preserves line breaks, columns, and spatial layout
 */
async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    if (items.length === 0) continue;

    // Sort items by vertical position (top to bottom), then horizontal (left to right)
    const sorted = [...items].filter((it) => it.str !== undefined).sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5]; // y descending (PDF coords are bottom-up)
      if (Math.abs(yDiff) > 2) return yDiff;
      return a.transform[4] - b.transform[4]; // x ascending
    });

    // Group items into lines based on y-position proximity
    const lines: { y: number; items: any[] }[] = [];
    for (const item of sorted) {
      const y = item.transform[5];
      const lastLine = lines[lines.length - 1];
      if (lastLine && Math.abs(lastLine.y - y) < 3) {
        lastLine.items.push(item);
      } else {
        lines.push({ y, items: [item] });
      }
    }

    // Build page text preserving spacing between items on the same line
    const pageLines: string[] = [];
    for (const line of lines) {
      // Sort items left to right within the line
      line.items.sort((a: any, b: any) => a.transform[4] - b.transform[4]);

      let lineStr = "";
      let lastEndX = 0;
      for (const item of line.items) {
        const x = item.transform[4];
        const gap = x - lastEndX;
        // If gap is large, insert tab for column separation; small gap = space
        if (lastEndX > 0 && gap > 20) {
          lineStr += "\t";
        } else if (lastEndX > 0 && gap > 2) {
          lineStr += " ";
        }
        lineStr += item.str;
        lastEndX = x + (item.width || item.str.length * 5);
      }
      if (lineStr.trim()) pageLines.push(lineStr);
    }

    if (pageLines.length > 0) {
      textParts.push(`--- Page ${i} ---\n${pageLines.join("\n")}`);
    }
  }

  return textParts.join("\n\n") || "[No text could be extracted from the PDF]";
}

/**
 * Parse text from Word document using mammoth — preserves paragraphs, headings, lists, and tables
 */
async function parseWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // First try converting to markdown to preserve structure (headings, lists, tables)
  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    if (htmlResult.value) {
      // Convert HTML to structured plain text preserving formatting
      const structured = htmlToStructuredText(htmlResult.value);
      if (structured.trim()) return structured;
    }
  } catch {
    // Fall back to raw text
  }

  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "[No text could be extracted from the Word document]";
}

/**
 * Convert HTML output from mammoth to structured plain text
 * preserving headings, lists, tables, and paragraph breaks
 */
function htmlToStructuredText(html: string): string {
  let text = html;

  // Headings → markdown-style
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n");
  text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "\n##### $1\n");
  text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "\n###### $1\n");

  // Table handling — preserve as markdown tables
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[][] = [];
    const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rowMatches) {
      const cells: string[] = [];
      const cellMatches = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      for (const cell of cellMatches) {
        const cellText = cell.replace(/<[^>]+>/g, "").trim();
        cells.push(cellText);
      }
      rows.push(cells);
    }
    if (rows.length === 0) return "";

    const maxCols = Math.max(...rows.map((r) => r.length));
    const colWidths = Array(maxCols).fill(3);
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        colWidths[i] = Math.max(colWidths[i], row[i].length);
      }
    }

    let tableStr = "\n";
    for (let r = 0; r < rows.length; r++) {
      const paddedCells = Array(maxCols)
        .fill("")
        .map((_, i) => (rows[r][i] || "").padEnd(colWidths[i]));
      tableStr += "| " + paddedCells.join(" | ") + " |\n";
      if (r === 0) {
        tableStr += "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |\n";
      }
    }
    return tableStr + "\n";
  });

  // Lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n• $1");
  text = text.replace(/<\/[ou]l>/gi, "\n");
  text = text.replace(/<[ou]l[^>]*>/gi, "");

  // Bold/italic
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Paragraphs and line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<p[^>]*>/gi, "");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Clean up excessive blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Main file parser - extracts text from image, PDF, or Word doc
 */
export async function parseFile(file: File): Promise<ParsedFileResult> {
  const mimeType = file.type;
  let text = "";

  if (mimeType.startsWith("image/")) {
    text = await parseImage(file);
  } else if (mimeType === "application/pdf") {
    text = await parsePDF(file);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    text = await parseWord(file);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  return {
    text,
    fileName: file.name,
    mimeType,
  };
}
