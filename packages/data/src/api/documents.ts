import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import { DOCUMENT_STYLE, DOCUMENT_TEMPLATES, UPDATE_DOCUMENT_STYLE } from './operations';
import type { DocumentStyle, DocumentStyleInput, DocumentTemplates } from './types';

export const documentStyleKey = ['documentStyle'] as const;
export const documentTemplatesKey = ['documentTemplates'] as const;

const API_ROOT = API_URL.replace(/\/graphql\/?$/, '');
/** Your resume photo (GET shows it, POST uploads one, DELETE removes it). */
export const PHOTO_URL = `${API_ROOT}/documents/photo`;

/**
 * A sample resume or cover letter in a template, to open in a new tab and compare.
 * Options: template, accent (hex), font, layout (cover letters).
 */
export function documentPreviewUrl(
  kind: 'resume' | 'cover-letter',
  options: Record<string, string>,
): string {
  const query = new URLSearchParams(options).toString();
  return `${API_ROOT}/documents/preview/${kind}.pdf${query ? `?${query}` : ''}`;
}

/** How your resume and cover letter PDFs look. */
export function useDocumentStyle() {
  return useQuery({
    queryKey: documentStyleKey,
    queryFn: async () =>
      (await graphqlClient.request<{ documentStyle: DocumentStyle }>(DOCUMENT_STYLE)).documentStyle,
  });
}

/** The templates to choose from, and whether the PDF renderer is running. */
export function useDocumentTemplates() {
  return useQuery({
    queryKey: documentTemplatesKey,
    queryFn: async () =>
      (await graphqlClient.request<{ documentTemplates: DocumentTemplates }>(DOCUMENT_TEMPLATES))
        .documentTemplates,
  });
}

export function useUpdateDocumentStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DocumentStyleInput) =>
      (
        await graphqlClient.request<{ updateDocumentStyle: DocumentStyle }>(UPDATE_DOCUMENT_STYLE, {
          input,
        })
      ).updateDocumentStyle,
    onSuccess: (style) => {
      queryClient.setQueryData(documentStyleKey, style);
    },
  });
}

async function photoRequest(method: 'POST' | 'DELETE', file?: File): Promise<DocumentStyle> {
  const init: RequestInit = { method, credentials: 'include' };
  if (file) {
    const body = new FormData();
    body.append('file', file);
    init.body = body;
  }
  const res = await fetch(PHOTO_URL, init);
  const json = (await res.json().catch(() => null)) as
    (DocumentStyle & { message?: unknown }) | null;
  if (!res.ok) {
    const message = json?.message;
    throw new Error(typeof message === 'string' ? message : `Failed (${String(res.status)})`);
  }
  return json as DocumentStyle;
}

/** Uploads a JPEG or PNG photo (at most 2 MB) for your resume. */
export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => photoRequest('POST', file),
    onSuccess: (style) => {
      queryClient.setQueryData(documentStyleKey, style);
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => photoRequest('DELETE'),
    onSuccess: (style) => {
      queryClient.setQueryData(documentStyleKey, style);
    },
  });
}
