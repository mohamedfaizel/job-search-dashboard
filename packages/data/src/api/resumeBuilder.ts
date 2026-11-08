import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, apiErrorFrom, graphqlClient } from './client';
import { queryKeys } from './hooks';
import { jobInsightsPrefix } from './insights';
import {
  RESTART_RESUME_BUILD,
  RESUME_BUILD,
  RESUME_BUILD_PROMPT,
  SAVE_RESUME_BUILD,
} from './operations';
import { profileKey } from './profile';
import type { ResumeBuild } from './types';

export const resumeBuildKey = (language: string | null) => ['resumeBuild', language] as const;

const API_ROOT = API_URL.replace(/\/graphql\/?$/, '');

/** The builder's resume as a PDF; `download` asks the browser to save it. */
export function resumeBuildPdfUrl(language: string, download = false): string {
  return `${API_ROOT}/resume-builder/${encodeURIComponent(language)}/resume.pdf${download ? '?download=1' : ''}`;
}

/** The builder's PDF, its page count, and whether your template was used (false = plain PDF). */
export interface BuilderPdf {
  blob: Blob;
  pages: number;
  styled: boolean;
}

export async function fetchResumeBuildPdf(language: string): Promise<BuilderPdf> {
  const res = await fetch(resumeBuildPdfUrl(language), { credentials: 'include' });
  if (!res.ok) {
    throw apiErrorFrom(await res.json().catch(() => null), `PDF failed (${String(res.status)})`);
  }
  return {
    blob: await res.blob(),
    pages: Number(res.headers.get('X-Pdf-Pages') ?? '0'),
    styled: res.headers.get('X-Pdf-Styled') !== '0',
  };
}

/** Your master resume as sections; null = your main language. */
export function useResumeBuild(language: string | null) {
  return useQuery({
    queryKey: resumeBuildKey(language),
    queryFn: async () =>
      (await graphqlClient.request<{ resumeBuild: ResumeBuild }>(RESUME_BUILD, { language }))
        .resumeBuild,
    // The builder keeps its own copy while you type; a refetch would undo unsaved keystrokes.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** After a save the resume text changed: Fit %, insights and My profile read it. */
function refreshResumeReaders(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: profileKey });
  void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
}

export function useSaveResumeBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { language: string; doc: string }) =>
      (await graphqlClient.request<{ saveResumeBuild: ResumeBuild }>(SAVE_RESUME_BUILD, vars))
        .saveResumeBuild,
    onSuccess: () => {
      refreshResumeReaders(queryClient);
    },
  });
}

/** Reads the resume into sections again: from My profile, or from an AI chat reply. */
export function useRestartResumeBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { language: string; reply?: string }) =>
      (await graphqlClient.request<{ restartResumeBuild: ResumeBuild }>(RESTART_RESUME_BUILD, vars))
        .restartResumeBuild,
    onSuccess: (build) => {
      queryClient.setQueryData(resumeBuildKey(build.language), build);
      refreshResumeReaders(queryClient);
    },
  });
}

/** The AI chat prompt that reads your resume into sections; fetched when you copy it. */
export function useResumeBuildPrompt(language: string) {
  return useQuery({
    queryKey: ['resumeBuild', 'prompt', language],
    queryFn: async () =>
      (
        await graphqlClient.request<{ resumeBuildPrompt: string }>(RESUME_BUILD_PROMPT, {
          language,
        })
      ).resumeBuildPrompt,
    enabled: false,
  });
}

/**
 * The builder's PDF for one saved version. A new version is a new key; the last PDF stays on
 * screen while the next one is made.
 */
export function useResumeBuildPdf(language: string, version: string) {
  return useQuery({
    queryKey: ['resumeBuild', 'pdf', language, version],
    queryFn: () => fetchResumeBuildPdf(language),
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
