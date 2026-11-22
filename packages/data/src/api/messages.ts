import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { notificationsKey } from './notifications';
import {
  ADMIN_CONVERSATION,
  ADMIN_CONVERSATIONS,
  MARK_MY_MESSAGES_READ,
  MY_MESSAGES,
  REPLY_MESSAGE,
  SEND_MESSAGE,
} from './operations';
import type { AdminConversation, ChatMessage, MessageTopic, MyMessages } from './types';

export const myMessagesKey = ['messages', 'mine'] as const;
export const adminConversationsKey = ['admin', 'conversations'] as const;
export const adminConversationKey = (userId: number) => ['admin', 'conversation', userId] as const;

/** How often an open message window asks for new answers. */
export const MESSAGES_POLL_MS = 30_000;

/** Your conversation with the makers, asked again while the window is open. */
export function useMyMessages(enabled = true) {
  return useQuery({
    queryKey: myMessagesKey,
    queryFn: async () =>
      (await graphqlClient.request<{ myMessages: MyMessages }>(MY_MESSAGES)).myMessages,
    enabled,
    refetchInterval: enabled ? MESSAGES_POLL_MS : false,
  });
}

/** Sends a message; it shows in the window at once. */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { topic: MessageTopic; body: string }) =>
      (await graphqlClient.request<{ sendMessage: ChatMessage }>(SEND_MESSAGE, { input }))
        .sendMessage,
    onSuccess: (sent) => {
      queryClient.setQueryData<MyMessages>(myMessagesKey, (mine) =>
        mine ? { ...mine, items: [...mine.items, sent] } : { items: [sent], unread: 0 },
      );
    },
  });
}

/** Marks the answers you saw read. */
export function useMarkMyMessagesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await graphqlClient.request<{ markMyMessagesRead: number }>(MARK_MY_MESSAGES_READ))
        .markMyMessagesRead,
    onSuccess: async () => {
      queryClient.setQueryData<MyMessages>(myMessagesKey, (mine) =>
        mine ? { ...mine, unread: 0 } : mine,
      );
      await queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });
}

/** Every conversation, unanswered first. Admins only. */
export function useAdminConversations(enabled = true) {
  return useQuery({
    queryKey: adminConversationsKey,
    queryFn: async () =>
      (
        await graphqlClient.request<{ adminConversations: AdminConversation[] }>(
          ADMIN_CONVERSATIONS,
        )
      ).adminConversations,
    enabled,
    refetchInterval: enabled ? MESSAGES_POLL_MS : false,
  });
}

/** One user's conversation. Opening it marks it read for every admin. */
export function useAdminConversation(userId: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: adminConversationKey(userId ?? 0),
    queryFn: async () => {
      const { adminConversation } = await graphqlClient.request<{
        adminConversation: ChatMessage[];
      }>(ADMIN_CONVERSATION, { userId });
      queryClient.setQueryData<AdminConversation[]>(adminConversationsKey, (list) =>
        list?.map((c) => (c.userId === userId ? { ...c, unread: 0 } : c)),
      );
      return adminConversation;
    },
    enabled: userId !== null,
    refetchInterval: userId === null ? false : MESSAGES_POLL_MS,
  });
}

/** An admin answers a user. */
export function useReplyMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: number; body: string }) =>
      (await graphqlClient.request<{ replyMessage: ChatMessage }>(REPLY_MESSAGE, { input }))
        .replyMessage,
    onSuccess: async (reply, { userId }) => {
      queryClient.setQueryData<ChatMessage[]>(adminConversationKey(userId), (list) =>
        list ? [...list, reply] : [reply],
      );
      await queryClient.invalidateQueries({ queryKey: adminConversationsKey });
    },
  });
}
