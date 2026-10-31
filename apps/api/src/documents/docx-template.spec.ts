import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { makeDocx } from '../../test/docx-fixture';
import { analyseDocx, DocxTemplateError, fillDocx } from './docx-template';
import { parseResume } from './resume-doc';

const TAILORED = parseResume(
  `# Ada Lovelace
Senior Frontend Engineer
London | ada@example.com

## Profil
Entwicklerin mit **fünf Jahren** React & <TypeScript>.

## Berufserfahrung
### Frontend Developer | Example GmbH
London | 01/2021 – heute
- Dashboard für 40 Teams, mit *Figma*.

## Kenntnisse
- React, TypeScript, Figma, Kanban
`,
  'Ada',
);
const PROPS = { title: 'Ada Lovelace – Lebenslauf', author: 'Ada Lovelace', language: 'de' };

const unzip = async (bytes: Buffer) => {
  const zip = await JSZip.loadAsync(bytes);
  const read = async (path: string) => (await zip.file(path)?.async('string')) ?? null;
  return { zip, read };
};

describe('analyseDocx', () => {
  it('finds the section headings of a Word resume', async () => {
    expect(await analyseDocx(await makeDocx())).toEqual({
      usable: true,
      sections: ['PROFILE', 'EXPERIENCE', 'SKILLS'],
      warnings: [],
    });
  });

  it('says why a file without headings or a broken file cannot be used', async () => {
    const plain = await analyseDocx(await makeDocx('<w:p><w:r><w:t>Hello</w:t></w:r></w:p>'));
    expect(plain.usable).toBe(false);
    expect(plain.warnings[0]).toContain('No section headings found');
    const broken = await analyseDocx(Buffer.from('not a zip'));
    expect(broken).toEqual({
      usable: false,
      sections: [],
      warnings: ['This is not a Word (.docx) file'],
    });
  });

  it('warns that tables below the header do not carry over', async () => {
    const withTable = await analyseDocx(
      await makeDocx(
        '<w:p><w:r><w:t>Ada</w:t></w:r></w:p><w:p><w:r><w:t>Skills</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>React</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
      ),
    );
    expect(withTable.usable).toBe(true);
    expect(withTable.warnings.join(' ')).toContain('Tables and text boxes');
  });
});

describe('fillDocx', () => {
  it('keeps your header and copies the formatting of each part', async () => {
    const out = await fillDocx(await makeDocx(), TAILORED, PROPS);
    const { read } = await unzip(out);
    const xml = (await read('word/document.xml')) ?? '';
    // The header is yours, with the tailored headline in its own formatting.
    expect(xml).toContain('<w:sz w:val="52"/></w:rPr><w:t xml:space="preserve">Ada Lovelace</w:t>');
    expect(xml).toContain(
      '<w:rPr><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve">Senior Frontend Engineer</w:t>',
    );
    expect(xml).toContain('London | ada@example.com');
    // Headings in capitals with your border and colour, like the ones in your file.
    expect(xml).toMatch(
      /<w:pBdr>.*?<\/w:pBdr><\/w:pPr><w:r><w:rPr><w:b\/><w:color w:val="8B1E3F"\/><w:sz w:val="24"\/><\/w:rPr><w:t xml:space="preserve">BERUFSERFAHRUNG</,
    );
    // Dates after the tab, in your italic grey.
    expect(xml).toContain(
      '<w:t xml:space="preserve">Frontend Developer | Example GmbH</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:i/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">London | 01/2021 – heute</w:t>',
    );
    // Bullets in your list style; Markdown bold and italics become Word bold and italics.
    expect(xml).toContain(
      '<w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t xml:space="preserve">Dashboard für 40 Teams, mit </w:t></w:r><w:r><w:rPr><w:i/><w:iCs/></w:rPr><w:t xml:space="preserve">Figma</w:t>',
    );
    expect(xml).toContain(
      '<w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">fünf Jahren</w:t>',
    );
    // Text is escaped, so it can't break the file.
    expect(xml).toContain('React &amp; &lt;TypeScript&gt;.');
    // The old sections are gone; the page setup stays.
    expect(xml).not.toContain('five years');
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
  });

  it('leaves only the title and your name in the file properties', async () => {
    const { zip, read } = await unzip(await fillDocx(await makeDocx(), TAILORED, PROPS));
    const core = (await read('docProps/core.xml')) ?? '';
    expect(core).toContain('<dc:title>Ada Lovelace – Lebenslauf</dc:title>');
    expect(core).toContain('<dc:creator>Ada Lovelace</dc:creator>');
    expect(core).not.toMatch(/Old Author|secret/);
    expect(zip.file('docProps/custom.xml')).toBeNull();
    expect(await read('_rels/.rels')).not.toContain('custom.xml');
    expect(await read('[Content_Types].xml')).not.toContain('custom.xml');
  });

  it('finds the headline by your profile headline, else by a role under your name', async () => {
    const body = (second: string) =>
      `<w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p><w:p><w:r><w:t>${second}</w:t></w:r></w:p><w:p><w:r><w:t>Skills</w:t></w:r></w:p><w:p><w:r><w:t>React</w:t></w:r></w:p>`;
    const xmlOf = async (bytes: Buffer) =>
      (await (await unzip(bytes)).read('word/document.xml')) ?? '';
    // A place under the name is not a headline: it stays.
    const place = await fillDocx(await makeDocx(body('London, UK')), TAILORED, PROPS);
    expect(await xmlOf(place)).toContain('London, UK');
    // Your profile headline is found wherever it is.
    const known = await fillDocx(await makeDocx(body('Mathematician')), TAILORED, {
      ...PROPS,
      knownHeadlines: ['mathematician'],
    });
    expect(await xmlOf(known)).toContain('Senior Frontend Engineer');
    expect(await xmlOf(known)).not.toContain('Mathematician');
  });

  it('refuses a file it cannot use', async () => {
    await expect(
      fillDocx(await makeDocx('<w:p><w:r><w:t>Hi</w:t></w:r></w:p>'), TAILORED, PROPS),
    ).rejects.toBeInstanceOf(DocxTemplateError);
  });
});
