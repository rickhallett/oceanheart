export type DocumentFormat = "text" | "markdown" | "pdf" | "docx";
export type IngestionErrorCode =
  | "FILE_TOO_LARGE"
  | "INVALID_TEXT"
  | "UNREADABLE_SCAN"
  | "EXTRACTION_FAILED";

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;
  constructor(code: IngestionErrorCode) {
    super(code);
    this.code = code;
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

function decodeXmlText(value: string) {
  return value.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos);/gi, (entity, numeric, named) => {
    if (numeric) {
      const codePoint = Number.parseInt(numeric.startsWith("x") ? numeric.slice(1) : numeric, numeric.startsWith("x") ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    return entities[named.toLowerCase()] ?? entity;
  });
}

async function extractDocx(bytes: Uint8Array) {
  assertBoundedDocxArchive(bytes);
  const { unzipSync } = await import("fflate");
  const archive = unzipSync(bytes, {
    filter: entry => entry.name === "word/document.xml",
  });
  const document = archive["word/document.xml"];
  if (!document) throw new IngestionError("EXTRACTION_FAILED");
  const xml = new TextDecoder("utf-8", { fatal: true }).decode(document);
  const paragraphs = xml.split(/<\/w:p\s*>/i).map(paragraph =>
    [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t\s*>/gi)]
      .map(match => decodeXmlText(match[1]))
      .join(""),
  );
  return checked(paragraphs.join("\n"), "INVALID_TEXT");
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
      return await extractDocx(bytes);
    }
    const { getDocument } = await import("unpdf/pdfjs");
    const loadingTask = getDocument({ data: bytes });
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
