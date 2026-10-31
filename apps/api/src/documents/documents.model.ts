import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsString, Matches } from 'class-validator';
import { FONTS, LETTER_LAYOUTS, MY_WORD_FILE, RESUME_TEMPLATES } from './templates';

@ObjectType('DocumentStyle', {
  description: 'How your resume and cover letter PDFs look',
})
export class DocumentStyleModel {
  @Field({ description: 'classic, modern, compact, or mine (your own Word file)' })
  resumeTemplate!: string;

  @Field({ description: 'auto (DIN 5008 for German letters), din or modern' })
  coverLetterLayout!: string;

  @Field({ description: 'Six hex digits, e.g. "1F4E79"' })
  accentColor!: string;

  @Field({ description: 'auto (the template’s own), sans or serif' })
  font!: string;

  @Field()
  showPhoto!: boolean;

  @Field({ description: 'A photo is uploaded (GET /documents/photo shows it)' })
  hasPhoto!: boolean;
}

@InputType()
export class DocumentStyleInput {
  @Field()
  @IsIn([...RESUME_TEMPLATES.map((t) => t.id), MY_WORD_FILE.id], {
    message: 'Pick a resume template from the list',
  })
  resumeTemplate!: string;

  @Field()
  @IsIn(LETTER_LAYOUTS.map((l) => l.id), { message: 'Pick a cover letter layout from the list' })
  coverLetterLayout!: string;

  @Field()
  @IsString()
  @Matches(/^#?[0-9a-fA-F]{6}$/, { message: 'The colour is six hex digits, like #1F4E79' })
  accentColor!: string;

  @Field()
  @IsIn([...FONTS], { message: 'The font is auto, sans or serif' })
  font!: string;

  @Field()
  @IsBoolean()
  showPhoto!: boolean;
}

@ObjectType('DocumentTemplate')
export class DocumentTemplateModel {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;
}

@ObjectType('WordTemplate', {
  description: 'A master resume you uploaded as Word (.docx), and whether it works as a template',
})
export class WordTemplateModel {
  @Field({ description: 'The language of that resume (ISO 639-1)' })
  language!: string;

  @Field()
  fileName!: string;

  @Field({ description: 'Its section headings were found, so it can be filled in' })
  usable!: boolean;

  @Field(() => [String], { description: 'The section headings found, in order' })
  sections!: string[];

  @Field(() => [String], { description: 'What won’t carry over, in plain words' })
  warnings!: string[];
}

@ObjectType('DocumentTemplates', {
  description: 'The templates to choose from, and whether the PDF renderer is running',
})
export class DocumentTemplatesModel {
  @Field(() => [DocumentTemplateModel])
  resumeTemplates!: DocumentTemplateModel[];

  @Field(() => [DocumentTemplateModel])
  coverLetterLayouts!: DocumentTemplateModel[];

  @Field(() => WordTemplateModel, {
    nullable: true,
    description: 'Your own Word file: the template "mine". Null without a .docx master resume',
  })
  wordTemplate!: WordTemplateModel | null;

  @Field({ description: 'False when PDF_RENDERER_URL is empty in .env' })
  rendererConfigured!: boolean;

  @Field({
    description: 'The pdf-renderer container answers. Without it, PDFs are plain, not templated',
  })
  rendererAvailable!: boolean;
}
