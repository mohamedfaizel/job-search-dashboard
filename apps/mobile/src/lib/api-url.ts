/** The API's port on your computer (`pnpm dev` starts it there). */
const API_PORT = 3000;

/**
 * Where the phone finds the API.
 *
 * 1. EXPO_PUBLIC_API_URL in apps/mobile/.env, when you set one (for a server on the internet).
 * 2. Otherwise your computer's address on the Wi-Fi, taken from the Expo dev server the phone
 *    loaded the app from ("192.168.1.20:8081" → http://192.168.1.20:3000/graphql). On a phone,
 *    "localhost" is the phone itself.
 * 3. localhost, for the web preview and the Android/iOS simulators on the same computer.
 */
export function apiUrlFrom(envUrl: string | undefined, hostUri: string | undefined): string {
  if (envUrl) return envUrl;
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${API_PORT}/graphql`;
}
