import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsResolver } from './documents.resolver';
import { DocumentsService } from './documents.service';
import { PdfRendererClient } from './pdf-renderer.client';

/** Resume and cover letter PDFs in the template you pick, typeset by LaTeX. */
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsResolver, PdfRendererClient],
  exports: [DocumentsService],
})
export class DocumentsModule {}
