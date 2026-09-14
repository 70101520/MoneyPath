import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'node:crypto';
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return (
    salt +
    ':' +
    scryptSync(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 }).toString('hex')
  );
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const actual = scryptSync(password, salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function key() {
  if (!/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY ?? ''))
    throw new Error('ENCRYPTION_KEY must be 32 random bytes encoded as hex');
  return Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
}
export function encrypt(value: string | null | undefined) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(
    ':',
  );
}
export function decrypt(value: string | null) {
  if (!value) return null;
  const [iv, tag, data] = value.split(':');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'hex')), cipher.final()]).toString('utf8');
}
export function checkOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  if (!configured || request.headers.get('origin') !== new URL(configured).origin)
    throw new Error('Invalid request origin');
}
