import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, apiErrorFrom, graphqlClient } from './client';
import { queryKeys } from './hooks';
import { jobInsightsPrefix } from './insights';
import {
  COPY_SECTION_TO_MASTER,
  IMPROVE_LETTER,
  IMPROVE_LETTER_PROMPT,
  IMPROVE_SECTION,
  IMPROVE_SECTION_PROMPT,
  JOB_COVER_LETTER,
  JOB_RESUME_BUILD,
  RESET_JOB_RESUME_BUILD,
  RESTART_RESUME_BUILD,
  RESUME_BUILD,
  RESUME_BUILD_PROMPT,
  SAVE_JOB_COVER_LETTER,
  SAVE_JOB_RESUME_BUILD,
  SAVE_RESUME_BUILD,
  START_JOB_RESUME_BUILD,
} from './operations';
import { profileKey } from './profile';
import type {
  ImproveLetterInput,
  ImproveSectionInput,
  JobCoverLetter,
  JobResumeBuild,
  LetterSuggestion,
  ResumeBuild,
  SectionSuggestion,
} from './types';

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

/** A job's resume copy as a PDF. */
export function jobResumeBuildPdfUrl(jobId: string, download = false): string {
  return `${API_ROOT}/resume-builder/job/${encodeURIComponent(jobId)}/resume.pdf${download ? '?download=1' : ''}`;
}

export async function fetchResumeBuildPdf(language: string): Promise<BuilderPdf> {
  return fetchPdf(resumeBuildPdfUrl(language));
}

export async function fetchJobResumeBuildPdf(jobId: string): Promise<BuilderPdf> {
  return fetchPdf(jobResumeBuildPdfUrl(jobId));
}

/** A job's cover letter as a PDF. */
export function jobCoverLetterPdfUrl(jobId: string, download = false): string {
  return `${API_ROOT}/resume-builder/job/${encodeURIComponent(jobId)}/cover-letter.pdf${download ? '?download=1' : ''}`;
}

export async function fetchJobCoverLetterPdf(jobId: string): Promise<BuilderPdf> {
  return fetchPdf(jobCoverLetterPdfUrl(jobId));
}

async function fetchPdf(url: string): Promise<BuilderPdf> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    throw apiErrorFrom(await res.json().catch(() => null), `PDF failed (${String(res.status)})`);
  }
  return {
    blob: await res.blob(),
    pages: Number(res.headers.get('X-Pdf-Pages') ?? '0'),
    styled: res.headers.get('X-Pdf-Styled') !== '0',
  };
}

export async function fetchResumeBuild(language: string | null): Promise<ResumeBuild> {
  return (await graphqlClient.request<{ resumeBuild: ResumeBuild }>(RESUME_BUILD, { language }))
    .resumeBuild;
}

export async function saveResumeBuild(vars: { language: string; doc: string }) {
  return (await graphqlClient.request<{ saveResumeBuild: ResumeBuild }>(SAVE_RESUME_BUILD, vars))
    .saveResumeBuild;
}

export async function restartResumeBuild(vars: { language: string; reply?: string }) {
  return (
    await graphqlClient.request<{ restartResumeBuild: ResumeBuild }>(RESTART_RESUME_BUILD, vars)
  ).restartResumeBuild;
}

export async function fetchResumeBuildPrompt(language: string): Promise<string> {
  return (
    await graphqlClient.request<{ resumeBuildPrompt: string }>(RESUME_BUILD_PROMPT, { language })
  ).resumeBuildPrompt;
}

/** Your master resume as sections; null = your main language. */
export function useResumeBuild(language: string | null) {
  return useQuery({
    queryKey: resumeBuildKey(language),
    queryFn: () => fetchResumeBuild(language),
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
    mutationFn: saveResumeBuild,
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
    queryFn: () => fetchResumeBuildPrompt(language),
    enabled: false,
  });
}

/**
 * The builder's PDF for one saved version. A new version is a new key; the last PDF stays on
 * screen while the next one is made.
 */
export function useResumeBuildPdf(language: string, version: string, enabled = true) {
  return useQuery({
    queryKey: ['resumeBuild', 'pdf', language, version],
    queryFn: () => fetchResumeBuildPdf(language),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export const jobResumeBuildKey = (jobId: string) => ['jobResumeBuild', jobId] as const;

/** Your resume for one job: its copy, or your master resume until you start one. */
export function useJobResumeBuild(jobId: string | null) {
  return useQuery({
    queryKey: jobResumeBuildKey(jobId ?? ''),
    queryFn: async () =>
      (await graphqlClient.request<{ jobResumeBuild: JobResumeBuild }>(JOB_RESUME_BUILD, { jobId }))
        .jobResumeBuild,
    enabled: jobId !== null,
    // The builder keeps its own copy while you type; a refetch would undo unsaved keystrokes.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The job copy's text changed: its score, the Apply kit and the Job posts table read it. */
function refreshJobReaders(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
}

export function useStartJobResumeBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) =>
      (
        await graphqlClient.request<{ startJobResumeBuild: JobResumeBuild }>(
          START_JOB_RESUME_BUILD,
          { jobId },
        )
      ).startJobResumeBuild,
    onSuccess: (build) => {
      queryClient.setQueryData(jobResumeBuildKey(build.jobId), build);
      refreshJobReaders(queryClient);
    },
  });
}

export function useSaveJobResumeBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; doc: string }) =>
      (
        await graphqlClient.request<{ saveJobResumeBuild: JobResumeBuild }>(
          SAVE_JOB_RESUME_BUILD,
          vars,
        )
      ).saveJobResumeBuild,
    onSuccess: () => {
      refreshJobReaders(queryClient);
    },
  });
}

/** Throws the job's changes away: the copy becomes your master resume again. */
export function useResetJobResumeBuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) =>
      (
        await graphqlClient.request<{ resetJobResumeBuild: JobResumeBuild }>(
          RESET_JOB_RESUME_BUILD,
          { jobId },
        )
      ).resetJobResumeBuild,
    onSuccess: (build) => {
      queryClient.setQueryData(jobResumeBuildKey(build.jobId), build);
      refreshJobReaders(queryClient);
    },
  });
}

/** Puts one section of the job's resume into your master resume. */
export function useCopySectionToMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; sectionId: string }) =>
      (
        await graphqlClient.request<{ copySectionToMaster: JobResumeBuild }>(
          COPY_SECTION_TO_MASTER,
          vars,
        )
      ).copySectionToMaster,
    onSuccess: (build) => {
      // The returned masterDoc is the new master; the builder keeps the job doc it has.
      queryClient.setQueryData(jobResumeBuildKey(build.jobId), (old: JobResumeBuild | undefined) =>
        old ? { ...old, masterDoc: build.masterDoc } : build,
      );
      void queryClient.invalidateQueries({ queryKey: ['resumeBuild'] });
      refreshResumeReaders(queryClient);
    },
  });
}

/** A job copy's PDF for one saved version (see useResumeBuildPdf). */
export function useJobResumeBuildPdf(jobId: string, version: string, enabled = true) {
  return useQuery({
    queryKey: ['jobResumeBuild', 'pdf', jobId, version],
    queryFn: () => fetchJobResumeBuildPdf(jobId),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The AI chat prompt that improves one section; fetched when you copy it. */
export function useImproveSectionPrompt() {
  return useMutation({
    mutationFn: async (input: ImproveSectionInput) =>
      (
        await graphqlClient.request<{ improveSectionPrompt: string }>(IMPROVE_SECTION_PROMPT, {
          input,
        })
      ).improveSectionPrompt,
  });
}

/**
 * An improved section from the AI chat reply you pasted, or (no reply) from your own saved AI
 * key. It changes nothing: you keep or discard the suggestion on screen.
 */
export function useImproveSection() {
  return useMutation({
    mutationFn: async (input: ImproveSectionInput) =>
      (
        await graphqlClient.request<{ improveSection: SectionSuggestion }>(IMPROVE_SECTION, {
          input,
        })
      ).improveSection,
  });
}

export const jobCoverLetterKey = (jobId: string) => ['jobCoverLetter', jobId] as const;

/** The cover letter saved for a job. The editor keeps its own copy while you type. */
export function useJobCoverLetter(jobId: string, enabled = true) {
  return useQuery({
    queryKey: jobCoverLetterKey(jobId),
    enabled,
    queryFn: async () =>
      (await graphqlClient.request<{ jobCoverLetter: JobCoverLetter }>(JOB_COVER_LETTER, { jobId }))
        .jobCoverLetter,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Saves the letter. The Apply kit reads the same text, so its readers are refreshed. */
export function useSaveJobCoverLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { jobId: string; text: string }) =>
      (
        await graphqlClient.request<{ saveJobCoverLetter: JobCoverLetter }>(
          SAVE_JOB_COVER_LETTER,
          vars,
        )
      ).saveJobCoverLetter,
    onSuccess: (letter) => {
      queryClient.setQueryData(jobCoverLetterKey(letter.jobId), letter);
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}

/** A job's letter PDF for one saved version (see useResumeBuildPdf). */
export function useJobCoverLetterPdf(jobId: string, version: string, enabled = true) {
  return useQuery({
    queryKey: ['jobCoverLetter', 'pdf', jobId, version],
    queryFn: () => fetchJobCoverLetterPdf(jobId),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The AI chat prompt that writes or improves the letter; fetched when you copy it. */
export function useImproveLetterPrompt() {
  return useMutation({
    mutationFn: async (input: ImproveLetterInput) =>
      (
        await graphqlClient.request<{ improveLetterPrompt: string }>(IMPROVE_LETTER_PROMPT, {
          input,
        })
      ).improveLetterPrompt,
  });
}

/**
 * A letter from the AI chat reply you pasted, or (no reply) from your own saved AI key. It
 * changes nothing: you keep or discard it on screen.
 */
export function useImproveLetter() {
  return useMutation({
    mutationFn: async (input: ImproveLetterInput) =>
      (await graphqlClient.request<{ improveLetter: LetterSuggestion }>(IMPROVE_LETTER, { input }))
        .improveLetter,
  });
}
