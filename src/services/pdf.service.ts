import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { getTimestamp, getTodayFormatted } from '../utils/date.util';
import { PROJECT_ROOT } from '../config/env';
import { PrinterResult } from '../types';

// Coordenadas de texto en el template PDF
const PDF_LAYOUT = {
  serial: { x: 205, yOffset: 185 },
  date: { x: 205, yOffset: 215 },
  counter: { xOffset: 165, yOffset: 250 },
  fontSize: 11,
} as const;

// PROJECT_ROOT asegura que funcione tanto desde src/ (tsx) como dist/ (node)
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'src', 'templates', 'template.pdf');

const addPrinterPage = async (
  finalPdf: PDFDocument,
  templateBytes: Buffer,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  printer: PrinterResult
): Promise<void> => {
  const templatePdf = await PDFDocument.load(templateBytes);
  const [templatePage] = await finalPdf.copyPages(templatePdf, [0]);
  finalPdf.addPage(templatePage);

  const { width, height } = templatePage.getSize();

  templatePage.drawText(printer.serial, {
    x: PDF_LAYOUT.serial.x,
    y: height - PDF_LAYOUT.serial.yOffset,
    size: PDF_LAYOUT.fontSize,
    font,
  });

  templatePage.drawText(getTodayFormatted(), {
    x: PDF_LAYOUT.date.x,
    y: height - PDF_LAYOUT.date.yOffset,
    size: PDF_LAYOUT.fontSize,
    font,
  });

  templatePage.drawText(printer.counter.toString(), {
    x: width - PDF_LAYOUT.counter.xOffset,
    y: height - PDF_LAYOUT.counter.yOffset,
    size: PDF_LAYOUT.fontSize,
    font,
  });
};

// Genera el PDF en memoria y retorna el Buffer (sin escribir a disco)
export const generatePdf = async (
  data: ReadonlyArray<PrinterResult>
): Promise<{ buffer: Buffer; filename: string }> => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template PDF no encontrado en: ${TEMPLATE_PATH}`);
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const finalPdf = await PDFDocument.create();
  const font = await finalPdf.embedFont(StandardFonts.Helvetica);

  for (const printer of data) {
    await addPrinterPage(finalPdf, templateBytes, font, printer);
  }

  const pdfBytes = await finalPdf.save();

  return {
    buffer: Buffer.from(pdfBytes),
    filename: `report-${getTimestamp()}.pdf`,
  };
};
