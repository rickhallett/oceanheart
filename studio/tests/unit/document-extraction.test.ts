import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import { extractDocument, IngestionError } from "../../backend/convex/lib/documentExtraction";

describe("supported engagement document extraction", () => {
  it("decodes bounded text and rejects invalid UTF-8", async () => {
    await expect(extractDocument(new TextEncoder().encode("Massage cancellation policy"), "text"))
      .resolves.toBe("Massage cancellation policy");
    await expect(extractDocument(Uint8Array.of(0xff), "text"))
      .rejects.toMatchObject({ code: "INVALID_TEXT" } satisfies Partial<IngestionError>);
  });

  it("extracts a PDF text layer and rejects a no-text scan", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    page.drawText("Fictional massage practice intake policy", { font: await pdf.embedFont(StandardFonts.Helvetica) });
    await expect(extractDocument(await pdf.save(), "pdf")).resolves.toContain("massage practice intake policy");
    const scan = await PDFDocument.create();
    scan.addPage();
    await expect(extractDocument(await scan.save(), "pdf"))
      .rejects.toMatchObject({ code: "UNREADABLE_SCAN" } satisfies Partial<IngestionError>);
  });

  it("extracts DOCX text without executing document content", async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph("Fictional therapist opening hours")] }] });
    const bytes = new Uint8Array(await Packer.toBuffer(doc));
    await expect(extractDocument(bytes, "docx")).resolves.toContain("therapist opening hours");
  });
});
