import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Google gives us a "refresh token" that can read your mail until you revoke it, so it is never
 * stored as plain text. AES-256-GCM scrambles it with a key from the server's own config; the
 * stored text is `iv.tag.data` (all base64), and any change to it makes decrypting fail.
 */
export function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(`gmail-token:${secret}`).digest();
}

/** Nest's ConfigService, or anything that reads settings by name. */
interface ConfigReader {
  get(name: string): unknown;
}

const setting = (config: ConfigReader, name: string) => {
  const value = config.get(name);
  return typeof value === 'string' ? value : '';
};

/** The key for stored Google tokens: GMAIL_TOKEN_KEY, else the login secret. */
export function tokenKey(config: ConfigReader): Buffer {
  return keyFrom(tokenSecret(config));
}

/** The secret behind {@link tokenKey}; it also signs the sign-in "state". */
export function tokenSecret(config: ConfigReader): string {
  return (
    setting(config, 'GMAIL_TOKEN_KEY') ||
    setting(config, 'JWT_SECRET') ||
    'dev-only-secret-change-me'
  );
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
}

/** Throws when the text was changed or the key is different (for example a new JWT_SECRET). */
export function decryptToken(stored: string, key: Buffer): string {
  const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !tag || !data) throw new Error('Malformed token');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
