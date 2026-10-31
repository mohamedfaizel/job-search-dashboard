import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

export interface PdfProperties {
  /** "Mohamed Faizel – Resume" */
  title: string;
  author: string;
  /** ISO 639-1, e.g. "de". */
  language: string;
}

/**
 * Sets the PDF's properties to what a recruiter should see, and nothing else: your name as
 * the author, a plain title, the language. The typesetting program's own Creator and Producer
 * entries, keywords and the XMP metadata copy are removed, so no tool name and no hidden text
 * travels with your application.
 */
export async function cleanPdf(bytes: Uint8Array, props: PdfProperties): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  // Setting the title creates the Info dictionary when the PDF has none.
  doc.setTitle(props.title, { showInWindowTitleBar: true });
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  if (info instanceof PDFDict) {
    for (const key of ['Creator', 'Producer', 'Keywords', 'Subject', 'Trapped']) {
      info.delete(PDFName.of(key));
    }
  }
  doc.catalog.delete(PDFName.of('Metadata'));
  doc.catalog.delete(PDFName.of('PieceInfo'));
  doc.setAuthor(props.author);
  doc.setLanguage(props.language);
  const now = new Date();
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  return doc.save();
}
