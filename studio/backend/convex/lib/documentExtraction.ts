export type DocumentFormat = "text" | "markdown" | "pdf" | "docx";
export type IngestionErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_TEXT"
  | "UNREADABLE_SCAN"
  | "EXTRACTION_FAILED";

export class IngestionError extends Error {
  constructor(readonly code: IngestionErrorCode) {
    super(code);
  }
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 32 * 1024;

function checked(text: string, emptyCode: IngestionErrorCode) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.includes("\0")) throw new IngestionError(emptyCode);
  if (new TextEncoder().encode(normalized).length > MAX_TEXT_BYTES)
    throw new IngestionError("FILE_TOO_LARGE");
  return normalized;
}

export async function extractDocument(
  bytes: Uint8Array,
  format: DocumentFormat,
): Promise<string> {
  if (!bytes.length) throw new IngestionError("INVALID_TEXT");
  if (bytes.length > MAX_FILE_BYTES) throw new IngestionError("FILE_TOO_LARGE");
  try {
    if (format === "text" || format === "markdown") {
      return checked(new TextDecoder("utf-8", { fatal: true }).decode(bytes), "INVALID_TEXT");
    }
    if (format === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return checked(result.value, "INVALID_TEXT");
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.flatMap(item => "str" in item ? [item.str] : []).join(" "));
    }
    return checked(pages.join("\n"), "UNREADABLE_SCAN");
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError(format === "text" || format === "markdown" ? "INVALID_TEXT" : "EXTRACTION_FAILED");
  }
}
