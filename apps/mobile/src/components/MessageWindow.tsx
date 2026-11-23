import type { ChatMessage, MessageTopic } from '@jobsearch/data';
import { useMarkMyMessagesRead, useMyMessages, useSendMessage } from '@jobsearch/data';
import { router } from 'expo-router';
import type { ComponentRef } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocale, useTranslations } from 'use-intl';
import { MAKER } from '../lib/maker';
import { colors } from '../lib/theme';
import { useErrorText } from '../lib/useErrorText';

export const TOPICS: readonly MessageTopic[] = ['QUESTION', 'SUGGESTION', 'BROKEN'];
/** The server takes up to 2,000 characters, like the website's box. */
const MAX_BODY = 2000;

/** "22 Nov, 21:40", in the app's language. */
export function sentAt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Back to where you came from, or to the job list when the window was opened from an alert. */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** One line: yours on the right in black, an answer on the left in white. */
function Bubble({ message }: { message: ChatMessage }) {
  const t = useTranslations('Messages');
  const locale = useLocale();
  const mine = !message.fromAdmin;
  const what = message.fromAdmin
    ? t('answeredBy', { name: message.authorName || MAKER.name })
    : message.topic
      ? t(`topics.${message.topic}`)
      : null;
  return (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <Text selectable style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {message.body}
      </Text>
      <Text style={styles.meta}>
        {what ? `${what} · ` : ''}
        {sentAt(message.createdAt, locale)}
      </Text>
    </View>
  );
}

/**
 * The "Message Mohamed Faizel" window, full screen like the website's on a phone: the photo, a
 * hello, your conversation (asked again every 30 seconds), a topic and a box to write in.
 * Answers you can see are marked read, which also clears their 🔔.
 */
export function MessageWindow() {
  const t = useTranslations('Messages');
  const errorText = useErrorText();
  const { data, isPending, isError, error } = useMyMessages();
  const send = useSendMessage();
  const { mutate: markRead } = useMarkMyMessagesRead();
  const [topic, setTopic] = useState<MessageTopic>('QUESTION');
  const [body, setBody] = useState('');
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const unread = data?.unread ?? 0;
  const text = body.trim();
  const ready = text !== '' && !send.isPending;

  useEffect(() => {
    if (unread > 0) markRead();
  }, [unread, markRead]);

  const submit = () => {
    if (!ready) return;
    send.mutate(
      { topic, body: text },
      {
        onSuccess: () => {
          setBody('');
        },
      },
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.page}>
      <View style={styles.header}>
        <Image source={MAKER.face} style={styles.face} accessibilityIgnoresInvertColors />
        <View style={styles.headText}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {t('title', { name: MAKER.name })}
          </Text>
          <Text style={styles.sub}>{t('sub')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          hitSlop={8}
          onPress={close}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroller}
          style={styles.flex}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.bubble, styles.theirs, styles.hello]}>{t('hello')}</Text>
          {isPending && (
            <ActivityIndicator color={colors.black} accessibilityLabel={t('loading')} />
          )}
          {isError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorText(error)}
            </Text>
          )}
          {data?.items.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.form}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('topic')}
            style={styles.topics}
          >
            {TOPICS.map((value) => {
              const on = topic === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    setTopic(value);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{t(`topics.${value}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.write}>
            <TextInput
              accessibilityLabel={t('label')}
              value={body}
              onChangeText={setBody}
              placeholder={t('placeholder')}
              placeholderTextColor={colors.muted}
              maxLength={MAX_BODY}
              multiline
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              disabled={!ready}
              onPress={submit}
              style={[styles.send, !ready && styles.sendOff]}
            >
              <Text style={styles.sendText}>{send.isPending ? t('sending') : t('send')}</Text>
            </Pressable>
          </View>
          {send.isError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {errorText(send.error)}
            </Text>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.black,
    borderBottomWidth: 3,
    borderBottomColor: colors.gold,
  },
  face: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.gold },
  headText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: colors.white },
  sub: { fontSize: 13, color: '#D4D4D4' },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  closePressed: { backgroundColor: '#262626' },
  closeText: { fontSize: 26, lineHeight: 28, color: '#D4D4D4' },
  list: { padding: 16, gap: 12, backgroundColor: colors.page, flexGrow: 1 },
  row: { gap: 4 },
  left: { alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 15,
    lineHeight: 21,
    overflow: 'hidden',
  },
  mine: { backgroundColor: colors.black, color: colors.white, borderBottomRightRadius: 4 },
  theirs: {
    backgroundColor: colors.white,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 4,
  },
  hello: { maxWidth: '100%', alignSelf: 'stretch' },
  // Slate 600, as on the website: grey enough to read on the light grey page.
  meta: { fontSize: 12, color: '#475569' },
  error: { fontSize: 13, color: colors.redText },
  form: {
    gap: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.black },
  write: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  send: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
  },
  sendOff: { opacity: 0.5 },
  sendText: { fontSize: 15, fontWeight: '700', color: colors.black },
});
