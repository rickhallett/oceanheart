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
const MAX_PDF_PAGES = 200;
const MAX_DOCX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;

function assertBoundedDocxArchive(bytes: Uint8Array) {
  // Read ZIP central-directory metadata without inflating attacker-controlled data.
  // DOCX ZIP64 archives are unnecessary at this upload size and fail closed.
  let offset = 0, total = 0, entries = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 46 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x02014b50) { offset += 1; continue; }
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff) throw new IngestionError("FILE_TOO_LARGE");
    total += size;
    entries += 1;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES || entries > 2_000)
      throw new IngestionError("FILE_TOO_LARGE");
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (!entries) throw new IngestionError("EXTRACTION_FAILED");
}

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
      assertBoundedDocxArchive(bytes);
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return checked(result.value, "INVALID_TEXT");
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    try {
      if (pdf.numPages > MAX_PDF_PAGES) throw new IngestionError("FILE_TOO_LARGE");
      const pages: string[] = [];
      let textBytes = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const text = (await page.getTextContent()).items.flatMap(item => "str" in item ? [item.str] : []).join(" ");
        textBytes += new TextEncoder().encode(text).length + 1;
        if (textBytes > MAX_TEXT_BYTES) throw new IngestionError("FILE_TOO_LARGE");
        pages.push(text);
        page.cleanup();
      }
      return checked(pages.join("\n"), "UNREADABLE_SCAN");
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError(format === "text" || format === "markdown" ? "INVALID_TEXT" : "EXTRACTION_FAILED");
  }
}
