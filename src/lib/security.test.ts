import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, encrypt, decrypt, checkOrigin } from './security';
describe('privacy controls', () => {
  it('hashes salted passwords and rejects wrong passwords', () => {
    const h = hashPassword('a-long-private-password');
    expect(verifyPassword('a-long-private-password', h)).toBe(true);
    expect(verifyPassword('incorrect-password', h)).toBe(false);
    expect(hashPassword('a-long-private-password')).not.toBe(h);
  });
  it('encrypts with unique nonces and authenticated ciphertext', () => {
    process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
    const a = encrypt('private note')!;
    const b = encrypt('private note')!;
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('private note');
    const parts = a.split(':');
    parts[1] = '00'.repeat(16);
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
  it('rejects foreign and absent origins', () => {
    process.env.APP_ORIGIN = 'http://localhost:3000';
    expect(() =>
      checkOrigin(
        new Request('http://localhost:3000/api', { headers: { origin: 'http://evil.test' } }),
      ),
    ).toThrow();
    expect(() => checkOrigin(new Request('http://localhost:3000/api'))).toThrow();
  });
});
