import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { SessionUser } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import { DocumentStyleInput, DocumentStyleModel, DocumentTemplatesModel } from './documents.model';
import { DocumentsService } from './documents.service';

/** Each user has their own document style: the id comes from the session cookie. */
@Resolver()
export class DocumentsResolver {
  constructor(private readonly documents: DocumentsService) {}

  @Query(() => DocumentStyleModel, { description: 'How your resume and cover letter PDFs look' })
  documentStyle(@CurrentUser() user: SessionUser): Promise<DocumentStyleModel> {
    return this.documents.style(user.id);
  }

  @Query(() => DocumentTemplatesModel)
  documentTemplates(@CurrentUser() user: SessionUser): Promise<DocumentTemplatesModel> {
    return this.documents.templates(user.id);
  }

  @Mutation(() => DocumentStyleModel)
  updateDocumentStyle(
    @CurrentUser() user: SessionUser,
    @Args('input') input: DocumentStyleInput,
  ): Promise<DocumentStyleModel> {
    return this.documents.updateStyle(user.id, input);
  }

  @Mutation(() => DocumentStyleModel, {
    description:
      'Saves Claude’s reply to the design prompt as My design and makes it your default template',
  })
  saveMyDesign(
    @CurrentUser() user: SessionUser,
    @Args('reply') reply: string,
  ): Promise<DocumentStyleModel> {
    return this.documents.saveMyDesign(user.id, reply.slice(0, 20_000));
  }

  @Mutation(() => DocumentStyleModel, { description: 'Deletes My design' })
  deleteMyDesign(@CurrentUser() user: SessionUser): Promise<DocumentStyleModel> {
    return this.documents.deleteMyDesign(user.id);
  }
}
