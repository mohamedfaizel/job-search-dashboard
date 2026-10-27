import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphqlClient } from './client';
import { LOG_IN, LOG_OUT, ME, SIGN_UP } from './operations';
import type { LogInInput, SignUpInput, User } from './types';

export const meKey = ['me'] as const;

/** Who is logged in: a User, or null when nobody is. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      const data = await graphqlClient.request<{ me: User | null }>(ME);
      return data.me;
    },
    // Changes only when someone logs in or out, and those update the cache themselves.
    staleTime: Infinity,
  });
}

/** Swap in a new user: drop everything cached for the previous one first. */
function startSession(queryClient: QueryClient, user: User | null) {
  // Not queryClient.clear(): that would also drop the `me` query the shell is watching,
  // and the page would never see the change.
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] });
  queryClient.setQueryData(meKey, user);
}

export function useLogIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogInInput) => {
      const data = await graphqlClient.request<{ logIn: User }>(LOG_IN, { input });
      return data.logIn;
    },
    onSuccess: (user) => {
      startSession(queryClient, user);
    },
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const data = await graphqlClient.request<{ signUp: User }>(SIGN_UP, { input });
      return data.signUp;
    },
    onSuccess: (user) => {
      startSession(queryClient, user);
    },
  });
}

export function useLogOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => graphqlClient.request(LOG_OUT),
    onSuccess: () => {
      startSession(queryClient, null);
    },
  });
}
