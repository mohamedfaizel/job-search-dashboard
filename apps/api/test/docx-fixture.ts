import JSZip from 'jszip';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const p = (text: string, pPr = '', rPr = '') =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const HEADING_PPR =
  '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="8B1E3F"/></w:pBdr>';
const HEADING_RPR = '<w:b/><w:color w:val="8B1E3F"/><w:sz w:val="24"/>';
const BULLET_PPR = '<w:pStyle w:val="ListBullet"/>';

/** The body of a small Word resume, in the shape most CVs have. */
export const RESUME_BODY = [
  p('Ada Lovelace', '', '<w:b/><w:color w:val="8B1E3F"/><w:sz w:val="52"/>'),
  p('Frontend Developer', '', '<w:color w:val="555555"/>'),
  p('London | ada@example.com'),
  p('PROFILE', HEADING_PPR, HEADING_RPR),
  p('Frontend developer with five years of React.'),
  p('EXPERIENCE', HEADING_PPR, HEADING_RPR),
  `<w:p><w:pPr><w:tabs><w:tab w:pos="9638" w:val="right"/></w:tabs></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Frontend Developer | Example GmbH</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:i/><w:color w:val="666666"/></w:rPr><w:t>01/2021 – today</w:t></w:r></w:p>`,
  p('Built a dashboard used by 40 teams.', BULLET_PPR),
  p('SKILLS', HEADING_PPR, HEADING_RPR),
  p('React, TypeScript', BULLET_PPR),
].join('');

/** A minimal but valid .docx with this body, an old author and custom properties. */
export async function makeDocx(body = RESUME_BODY): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Old Author</dc:creator><cp:keywords>secret keywords</cp:keywords></cp:coreProperties>`,
  );
  zip.file(
    'docProps/custom.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"><property name="Tracker">x</property></Properties>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
