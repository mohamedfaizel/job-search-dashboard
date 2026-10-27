import { BadRequestException } from '@nestjs/common';
import { extractRawText } from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Tidies extracted text: no trailing spaces, at most one blank line in a row. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The parts of a multer upload we use. */
export interface UploadedResume {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** Plain text from an uploaded PDF or Word (.docx) resume. */
export async function extractResumeText(file: UploadedResume): Promise<string> {
  const name = file.originalname.toLowerCase();
  let text: string;
  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(new Uint8Array(file.buffer));
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (file.mimetype === DOCX || name.endsWith('.docx')) {
    text = (await extractRawText({ buffer: file.buffer })).value;
  } else {
    throw new BadRequestException('Upload a PDF or Word (.docx) file');
  }
  const tidied = tidy(text);
  if (!tidied) {
    throw new BadRequestException(
      "Couldn't find any text in this file. Is it a scanned image? Paste the text instead.",
    );
  }
  return tidied;
}
