import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import { queryKeys } from './hooks';
import { jobInsightsPrefix } from './insights';
import {
  DELETE_LANGUAGE_RESUME,
  MY_PROFILE,
  SAVE_LANGUAGE_RESUME,
  TRANSLATION_PROMPT,
  UPDATE_PROFILE,
} from './operations';
import { matcherResumeKey } from './resumeMatcher';
import type { Profile, ProfileInput } from './types';

export const profileKey = ['profile'] as const;

/**
 * The languages a master resume can be in, by ISO 639-1 code. The API accepts the same list
 * (apps/api/src/profile/resumes.ts): add a language in both places.
 */
export const RESUME_LANGUAGES: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
  pl: 'Polish',
};

/** The logged-in user's profile (empty until they save it). */
export function useMyProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: async () => {
      const data = await graphqlClient.request<{ myProfile: Profile }>(MY_PROFILE);
      return data.myProfile;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const data = await graphqlClient.request<{ updateProfile: Profile }>(UPDATE_PROFILE, {
        input,
      });
      return data.updateProfile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      // The resume text may have changed, and with it what each job says you're missing.
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
      // ...and every job's Fit %.
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

/** The upload endpoint sits next to /graphql on the same server. */
export const RESUME_UPLOAD_URL = `${API_URL.replace(/\/graphql\/?$/, '')}/profile/resume`;

/** Sends a resume file as multipart/form-data and returns the updated profile. */
async function uploadResumeFile(url: string, file: File): Promise<Profile> {
  const body = new FormData();
  body.append('file', file);
  // No Content-Type header: the browser sets it, with the boundary between the parts.
  const res = await fetch(url, { method: 'POST', body, credentials: 'include' });
  const json = (await res.json().catch(() => null)) as (Profile & { message?: unknown }) | null;
  if (!res.ok) {
    const message = json?.message;
    throw new Error(
      typeof message === 'string' ? message : `Upload failed (${String(res.status)})`,
    );
  }
  return json as Profile;
}

/**
 * Sends a PDF or Word file as multipart/form-data. The API reads the text out of it and
 * saves that as the master resume.
 */
export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadResumeFile(RESUME_UPLOAD_URL, file),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
      // A new file makes Resume-Matcher's copy out of date.
      void queryClient.invalidateQueries({ queryKey: matcherResumeKey });
      void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

/** What changes when a resume in another language is saved or deleted. */
function refreshAfterLanguageResume(queryClient: ReturnType<typeof useQueryClient>) {
  return (profile: Profile) => {
    queryClient.setQueryData(profileKey, profile);
    // Jobs in that language are now checked against it.
    void queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
  };
}

/** Saves pasted text as your master resume in another language, e.g. "de". */
export function useSaveLanguageResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { language: string; text: string }) => {
      const data = await graphqlClient.request<{ saveLanguageResume: Profile }>(
        SAVE_LANGUAGE_RESUME,
        vars,
      );
      return data.saveLanguageResume;
    },
    onSuccess: refreshAfterLanguageResume(queryClient),
  });
}

/** Uploads a PDF or Word file as your master resume in another language. */
export function useUploadLanguageResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { language: string; file: File }) =>
      uploadResumeFile(`${RESUME_UPLOAD_URL}/${encodeURIComponent(vars.language)}`, vars.file),
    onSuccess: refreshAfterLanguageResume(queryClient),
  });
}

export function useDeleteLanguageResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: string) => {
      const data = await graphqlClient.request<{ deleteLanguageResume: Profile }>(
        DELETE_LANGUAGE_RESUME,
        { language },
      );
      return data.deleteLanguageResume;
    },
    onSuccess: refreshAfterLanguageResume(queryClient),
  });
}

/**
 * A Claude prompt that translates your master resume into `language`. Fetched when you ask for
 * it (enabled: false until refetch), since it is only needed when you copy it.
 */
export function useTranslationPrompt(language: string) {
  return useQuery({
    queryKey: [...profileKey, 'translation', language],
    queryFn: async () => {
      const data = await graphqlClient.request<{ translationPrompt: string }>(TRANSLATION_PROMPT, {
        language,
      });
      return data.translationPrompt;
    },
    enabled: false,
  });
}
