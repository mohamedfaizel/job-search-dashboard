import { useLogIn } from '@jobsearch/data';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import logo from '../../assets/icon.png';
import { API_URL } from '../lib/api';
import { colors } from '../lib/theme';
import { useErrorText } from '../lib/useErrorText';

/** Email and password, the same account as on the website. */
export function LoginForm() {
  const t = useTranslations('Auth');
  const tApp = useTranslations('App');
  const errorText = useErrorText();
  const logIn = useLogIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = email.trim() !== '' && password !== '' && !logIn.isPending;

  const submit = () => {
    if (!ready) return;
    logIn.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          router.replace('/');
        },
      },
    );
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text accessibilityRole="header" style={styles.heading}>
          {t('heading', { app: tApp('name') })}
        </Text>
        <Text style={styles.intro}>{t('intro')}</Text>

        <Text style={styles.label}>{t('email')}</Text>
        <TextInput
          accessibilityLabel={t('email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          style={styles.input}
        />
        <Text style={styles.label}>{t('password')}</Text>
        <TextInput
          accessibilityLabel={t('password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={submit}
          style={styles.input}
        />

        {logIn.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorText(logIn.error)}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            !ready && styles.buttonOff,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{logIn.isPending ? t('loggingIn') : t('logIn')}</Text>
        </Pressable>
        <Text style={styles.server}>{t('server', { url: API_URL })}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.black, justifyContent: 'center', padding: 16 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 20, gap: 6 },
  logo: { width: 56, height: 56, borderRadius: 12, alignSelf: 'center', marginBottom: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  intro: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.redText, fontSize: 14, marginTop: 8 },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonOff: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.black, fontSize: 16, fontWeight: '700' },
  server: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 10 },
});
