import { describe, expect, it } from 'vitest';
import {
  createAdminSchema,
  emailSchema,
  loginSchema,
  makeChangePasswordSchema,
  passwordRuleProblems,
  toFieldErrors,
} from '@/lib/validation/auth';
import { createAdminServerSchema, passwordStrengthProblem } from '@/lib/server/auth/password-strength';

const SPEC_EXAMPLES = ['Nex!2026#SecureAdmin', 'IncWorx@Reports#82', 'Admin$Panel2026!Safe'];
const IDENTITY = { name: 'Ravi Kumar', email: 'ravi.kumar@incworx.in' };

const firstError = (schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, value: unknown) => {
  const r = schema.safeParse(value) as { success: boolean; error?: { issues: { message: string }[] } };
  return r.success ? null : r.error!.issues[0].message;
};

describe('email', () => {
  it('is required', () => {
    expect(firstError(emailSchema, '')).toBe('Email is required.');
    expect(firstError(emailSchema, '    ')).toBe('Email is required.');
    expect(firstError(emailSchema, undefined)).toBe('Email is required.');
  });

  it.each(['not-an-email', 'ravi@', '@incworx.in', 'a@@incworx.in', 'ravi kumar@incworx.in', 'ravi@incworx..in'])(
    'rejects malformed %s',
    (value) => {
      expect(firstError(emailSchema, value)).toBe('Enter a valid email address.');
    },
  );

  it('trims and lower-cases before storage and comparison', () => {
    expect(emailSchema.parse('  Ravi.Kumar@INCWORX.in  ')).toBe('ravi.kumar@incworx.in');
  });

  it('enforces a maximum length', () => {
    const long = `${'a'.repeat(250)}@incworx.in`;
    expect(firstError(emailSchema, long)).toMatch(/254 characters or fewer/);
  });
});

describe('password policy — structural rules (browser and server)', () => {
  it.each(['inc134', 'acbc24', 'password123', 'admin123', '12345678'])('rejects the weak example %s', (pw) => {
    expect(passwordRuleProblems(pw).length).toBeGreaterThan(0);
  });

  it('rejects passwords under 12 characters', () => {
    expect(passwordRuleProblems('Ab1!xyzQwp')).toContain('Use at least 12 characters.');
  });

  it('rejects passwords over 128 characters', () => {
    expect(passwordRuleProblems(`Aa1!${'x7Kq'.repeat(40)}`)).toContain('Use 128 characters or fewer.');
  });

  it.each([
    ['nex!2026#secureadmin', 'Include at least one uppercase letter.'],
    ['NEX!2026#SECUREADMIN', 'Include at least one lowercase letter.'],
    ['Nex!Secure#Admin!Ok', 'Include at least one number.'],
    ['Nex2026SecureAdmin', 'Include at least one special character, such as ! @ # $ or %.'],
  ])('%s → %s', (pw, message) => {
    expect(passwordRuleProblems(pw)).toContain(message);
  });

  it('rejects repeated characters', () => {
    expect(passwordRuleProblems('Aaaaaaaa1!aa')).toContain("Don't repeat the same character 4 or more times in a row.");
  });

  it('rejects a password built from one short repeated pattern', () => {
    expect(passwordRuleProblems('Ab1!Ab1!Ab1!')).toContain("Don't build the password from one short repeated pattern.");
  });

  it.each(['Abcdefgh1234!', 'Zyxw!Secure98', 'Pass#Qwerty77', 'Secure!9876Ok'])('rejects the sequence in %s', (pw) => {
    expect(passwordRuleProblems(pw)).toContain("Avoid sequences such as 'abcd', '1234' or 'qwer'.");
  });

  it.each(SPEC_EXAMPLES)('accepts the strong example %s', (pw) => {
    expect(passwordRuleProblems(pw)).toEqual([]);
  });
});

describe('create-admin schema', () => {
  const valid = { name: 'Ravi Kumar', email: 'ravi.kumar@incworx.in', password: 'IncWorx@Reports#82', confirmPassword: 'IncWorx@Reports#82' };

  it('accepts valid input', () => {
    expect(createAdminSchema.safeParse(valid).success).toBe(true);
  });

  it('reports a password confirmation mismatch on the confirm field', () => {
    const r = createAdminSchema.safeParse({ ...valid, confirmPassword: 'IncWorx@Reports#83' });
    expect(r.success).toBe(false);
    expect(toFieldErrors(r.error!).confirmPassword).toEqual(['Passwords do not match.']);
  });

  it.each([
    ['their name', 'RaviKumar@2026!x'],
    ['their name with separators', 'Ravi.Kumar#2026x!'],
    ['their e-mail local part', 'Nex!ravi.kumar#9'],
  ])('rejects a password containing %s', (_, password) => {
    const r = createAdminSchema.safeParse({ ...valid, password, confirmPassword: password });
    expect(toFieldErrors(r.error!).password).toContain("Don't include your name or email address.");
  });

  it('reports every field problem at once, each on its own field', () => {
    const r = createAdminSchema.safeParse({ name: '', email: 'nope', password: 'short', confirmPassword: 'other' });
    const errors = toFieldErrors(r.error!);
    expect(errors.name?.[0]).toBe('Name is required.');
    expect(errors.email?.[0]).toBe('Enter a valid email address.');
    expect(errors.password).toContain('Use at least 12 characters.');
    expect(errors.confirmPassword).toEqual(['Passwords do not match.']);
  });
});

describe('password strength — server-only dictionary check', () => {
  it.each(['Password123!', 'P@ssw0rd2026!', 'Welcome@2026', 'Summer2026!!', 'Michael#2026!', 'Iloveyou@2026'])(
    'rejects %s, which passes every character rule but is predictable',
    async (pw) => {
      expect(passwordRuleProblems(pw)).toEqual([]); // the character rules alone would let it through
      expect(await passwordStrengthProblem(pw, IDENTITY)).toMatch(/^This password is too easy to guess/);
    },
  );

  it.each([...SPEC_EXAMPLES, 'tV9#qLm2$wXp', 'Harbour-Lantern-91-Quay!'])('accepts %s', async (pw) => {
    expect(await passwordStrengthProblem(pw, IDENTITY)).toBeNull();
  });

  it('server schema = shared rules + strength, on the password field', async () => {
    const r = await createAdminServerSchema.safeParseAsync({
      name: 'Ravi Kumar',
      email: 'ravi.kumar@incworx.in',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(r.success).toBe(false);
    expect(toFieldErrors(r.error!).password?.[0]).toMatch(/too easy to guess/);
  });
});

describe('login schema — shape only', () => {
  it('lets an older, weaker password through to verification', () => {
    expect(loginSchema.safeParse({ email: 'ravi@incworx.in', password: 'old-pass' }).success).toBe(true);
  });

  it('still requires a valid email and a password', () => {
    const errors = toFieldErrors(loginSchema.safeParse({ email: 'nope', password: '' }).error!);
    expect(errors.email?.[0]).toBe('Enter a valid email address.');
    expect(errors.password?.[0]).toBe('Password is required.');
  });

  it('bounds password length so the hasher cannot be made to grind', () => {
    expect(loginSchema.safeParse({ email: 'ravi@incworx.in', password: 'x'.repeat(257) }).success).toBe(false);
  });
});

describe('change-password schema', () => {
  const schema = makeChangePasswordSchema(IDENTITY);

  it('requires the new password to differ from the current one', () => {
    const r = schema.safeParse({ currentPassword: 'IncWorx@Reports#82', newPassword: 'IncWorx@Reports#82', confirmPassword: 'IncWorx@Reports#82' });
    expect(toFieldErrors(r.error!).newPassword).toContain('Choose a password different from your current one.');
  });

  it('reports a confirmation mismatch', () => {
    const r = schema.safeParse({ currentPassword: 'old', newPassword: 'IncWorx@Reports#82', confirmPassword: 'IncWorx@Reports#28' });
    expect(toFieldErrors(r.error!).confirmPassword).toEqual(['Passwords do not match.']);
  });

  it('uses the same rules as admin creation', () => {
    const r = schema.safeParse({ currentPassword: 'old', newPassword: 'password123', confirmPassword: 'password123' });
    expect(toFieldErrors(r.error!).newPassword).toEqual(expect.arrayContaining(passwordRuleProblems('password123')));
  });
});
