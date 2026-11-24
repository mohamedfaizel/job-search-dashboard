import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, graphqlClient } from './client';
import { queryKeys } from './hooks';
import { jobInsightsPrefix } from './insights';
import {
  APPROVE_MAIL_SUGGESTION,
  DISCONNECT_GMAIL,
  DISCONNECT_GOOGLE_CALENDAR,
  DISMISS_MAIL_SUGGESTION,
  GMAIL_STATUS,
  GOOGLE_CALENDAR,
  MAIL_SUGGESTIONS,
  SYNC_GMAIL,
} from './operations';
import type { GmailStatus, GmailSyncResult, GoogleCalendarStatus, MailSuggestion } from './types';

export const gmailStatusKey = ['gmail', 'status'] as const;
export const mailSuggestionsKey = ['gmail', 'suggestions'] as const;

/** Where "Connect Gmail" sends the browser: this API, then Google, then back to Settings. */
export const GMAIL_CONNECT_URL = `${API_URL.replace(/\/graphql\/?$/, '')}/gmail/connect`;
/** Where "Connect Google Calendar" sends the browser: the same Google sign-in, for calendar events. */
export const CALENDAR_CONNECT_URL = `${GMAIL_CONNECT_URL.replace(/\/connect$/, '')}/calendar/connect`;
export const googleCalendarKey = ['gmail', 'calendar'] as const;

/** Your Google Calendar for interviews: connected or not, and the last problem. */
export function useGoogleCalendar() {
  return useQuery({
    queryKey: googleCalendarKey,
    queryFn: async () =>
      (await graphqlClient.request<{ googleCalendar: GoogleCalendarStatus }>(GOOGLE_CALENDAR))
        .googleCalendar,
  });
}

/** Forgets the calendar. Events already made stay in Google. */
export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await graphqlClient.request(DISCONNECT_GOOGLE_CALENDAR);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: googleCalendarKey });
      await queryClient.invalidateQueries({ queryKey: jobInsightsPrefix });
    },
  });
}

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
