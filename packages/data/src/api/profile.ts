import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import { MY_PROFILE, UPDATE_PROFILE } from './operations';
import type { Profile, ProfileInput } from './types';

export const profileKey = ['profile'] as const;

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
    },
  });
}

/** The upload endpoint sits next to /graphql on the same server. */
export const RESUME_UPLOAD_URL = `${API_URL.replace(/\/graphql\/?$/, '')}/profile/resume`;

/**
 * Sends a PDF or Word file as multipart/form-data. The API reads the text out of it and
 * saves that as the master resume.
 */
export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      // No Content-Type header: the browser sets it, with the boundary between the parts.
      const res = await fetch(RESUME_UPLOAD_URL, { method: 'POST', body, credentials: 'include' });
      const json = (await res.json().catch(() => null)) as (Profile & { message?: unknown }) | null;
      if (!res.ok) {
        const message = json?.message;
        throw new Error(
          typeof message === 'string' ? message : `Upload failed (${String(res.status)})`,
        );
      }
      return json as Profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey, profile);
    },
  });
}
