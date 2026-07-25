import { describe, expect, it } from 'vitest';
import { signUpSchema, usernameSchema } from '../src/index';

describe('validation', () => {
  it('normalizes a valid username', () => {
    expect(usernameSchema.parse('human_creator')).toBe('human_creator');
  });

  it('normalizes uppercase username input before validation', () => {
    expect(usernameSchema.parse('Robertd44')).toBe('robertd44');
  });

  it('returns a specific username-format error', () => {
    const result = usernameSchema.safeParse('robert-d44');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Username must use lowercase letters, numbers, and underscores.',
      );
    }
  });

  it('returns a specific weak-password error', () => {
    const result = signUpSchema.safeParse({
      email: 'a@example.com',
      password: 'short',
      displayName: 'A B',
      username: 'artist_1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        'Password must be at least 10 characters.',
      );
    }
  });
});
