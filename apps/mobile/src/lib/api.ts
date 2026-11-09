import { setApiUrl } from '@jobsearch/data';
import Constants from 'expo-constants';
import { apiUrlFrom } from './api-url';

/** The API this app talks to (see apiUrlFrom). Set once, before the first request. */
export const API_URL = apiUrlFrom(
  // Written exactly like this: Expo puts the value from apps/mobile/.env into the code here.
  process.env.EXPO_PUBLIC_API_URL as string | undefined,
  Constants.expoConfig?.hostUri,
);
setApiUrl(API_URL);
