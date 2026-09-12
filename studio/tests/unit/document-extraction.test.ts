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

  it("rejects an oversized declared DOCX archive before inflation", async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph("Fictional policy")] }] });
    const bytes = new Uint8Array(await Packer.toBuffer(doc));
    const view = new DataView(bytes.buffer);
    for (let offset = 0; offset + 46 <= bytes.length; offset += 1) {
      if (view.getUint32(offset, true) === 0x02014b50) {
        view.setUint32(offset + 24, 17 * 1024 * 1024, true);
        break;
      }
    }
    await expect(extractDocument(bytes, "docx"))
      .rejects.toMatchObject({ code: "FILE_TOO_LARGE" } satisfies Partial<IngestionError>);
  });

  it("stops PDF extraction when accumulated text exceeds the limit", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let pageIndex = 0; pageIndex < 8; pageIndex += 1) {
      const page = pdf.addPage([600, 900]);
      for (let line = 0; line < 100; line += 1)
        page.drawText("massage ".repeat(15), { font, size: 8, x: 8, y: 890 - line * 8 });
    }
    await expect(extractDocument(await pdf.save(), "pdf"))
      .rejects.toMatchObject({ code: "FILE_TOO_LARGE" } satisfies Partial<IngestionError>);
  });
});
