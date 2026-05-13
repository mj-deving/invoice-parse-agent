import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { groundTruthCases } from "../src/eval/groundTruth";

async function makePdf(text: string) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  let y = 790;

  for (const line of text.split(/\r?\n/)) {
    if (y < 48) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawText(line, { x: 48, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 17;
  }

  return pdf.save();
}

await mkdir("corpus", { recursive: true });
for (const item of groundTruthCases) {
  const txtPath = item.documentPath;
  const pdfPath = join("corpus", `${basename(txtPath, ".txt")}.pdf`);
  const text = await readFile(txtPath, "utf8");
  await writeFile(pdfPath, await makePdf(text));
}
