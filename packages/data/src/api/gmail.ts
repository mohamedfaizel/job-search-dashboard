import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import { queryKeys } from './hooks';
import {
  APPROVE_MAIL_SUGGESTION,
  DISCONNECT_GMAIL,
  DISMISS_MAIL_SUGGESTION,
  GMAIL_STATUS,
  MAIL_SUGGESTIONS,
  SYNC_GMAIL,
} from './operations';
import type { GmailStatus, GmailSyncResult, MailSuggestion } from './types';

export const gmailStatusKey = ['gmail', 'status'] as const;
export const mailSuggestionsKey = ['gmail', 'suggestions'] as const;

/** Where "Connect Gmail" sends the browser: this API, then Google, then back to My profile. */
export const GMAIL_CONNECT_URL = `${API_URL.replace(/\/graphql\/?$/, '')}/gmail/connect`;

/** Your connected Gmail accounts, and whether the server has Google set up at all. */
export function useGmailStatus() {
  return useQuery({
    queryKey: gmailStatusKey,
    queryFn: async () =>
      (await graphqlClient.request<{ gmailStatus: GmailStatus }>(GMAIL_STATUS)).gmailStatus,
  });
}

/** Tracker changes that employer emails point to, waiting for your yes or no. */
export function useMailSuggestions() {
  return useQuery({
    queryKey: mailSuggestionsKey,
    queryFn: async () =>
      (await graphqlClient.request<{ mailSuggestions: MailSuggestion[] }>(MAIL_SUGGESTIONS))
        .mailSuggestions,
  });
}

/** Reads the last two weeks of mail now. */
export function useSyncGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await graphqlClient.request<{ syncGmail: GmailSyncResult }>(SYNC_GMAIL)).syncGmail,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gmailStatusKey }),
        queryClient.invalidateQueries({ queryKey: mailSuggestionsKey }),
      ]);
    },
  });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(DISCONNECT_GMAIL, { id });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gmailStatusKey }),
        queryClient.invalidateQueries({ queryKey: mailSuggestionsKey }),
      ]);
    },
  });
}

/** "Yes": the job moves to the suggested status, so the tracker refreshes too. */
export function useApproveMailSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(APPROVE_MAIL_SUGGESTION, { id });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mailSuggestionsKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
      ]);
    },
  });
}

export function useDismissMailSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await graphqlClient.request(DISMISS_MAIL_SUGGESTION, { id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mailSuggestionsKey }),
  });
}
