import { Stack } from 'expo-router';
import { MessageWindow } from '../components/MessageWindow';

/** "Message Mohamed Faizel", opened from the footer line or a reply in the 🔔. */
export default function MessagesScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MessageWindow />
    </>
  );
}
