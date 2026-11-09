import { Stack } from 'expo-router';
import { LoginForm } from '../components/LoginForm';

export default function LoginScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginForm />
    </>
  );
}
