'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/app/admin/actions/auth';
import { IDLE_FORM_STATE } from '@/lib/forms';
import { loginSchema, toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import AuthLayout, { AuthFootnote, AuthForm, AuthLink } from './AuthLayout';
import { Alert, Button, Field, Input, PasswordInput } from './ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" $block disabled={pending} aria-disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export default function LoginScreen({ next, activated = false }: { next: string; activated?: boolean }) {
  const [state, formAction] = useFormState(loginAction, IDLE_FORM_STATE);
  const [email, setEmail] = useState(state.values?.email ?? '');
  const [password, setPassword] = useState('');
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // After the server answers, its verdict replaces the browser's; the password
  // is cleared so a refused one is never left sitting in the field.
  useEffect(() => {
    if (state.status === 'error') {
      setClientErrors({});
      setPassword('');
      passwordRef.current?.focus();
    }
  }, [state]);

  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      event.preventDefault();
      const fieldErrors = toFieldErrors(result.error);
      setClientErrors(fieldErrors);
      (fieldErrors.email ? emailRef : passwordRef).current?.focus();
    } else {
      setClientErrors({});
    }
  }

  return (
    <AuthLayout
      heading="Reports administration"
      description="Sign in to manage INCWORX Global, Domestic and Special reports. Access is granted by the Super Admin."
      title="Sign in"
      subtitle="Use the email address your account was created with."
    >
      {activated && state.status !== 'error' && <Alert tone="success">Your account is ready. Sign in with your email and new password.</Alert>}
      {state.status === 'error' && state.message && <Alert tone="error">{state.message}</Alert>}

      <AuthForm action={formAction} onSubmit={onSubmit} noValidate>
        <input type="hidden" name="next" value={next} />

        <Field label="Email" errors={errors.email}>
          {(a11y) => (
            <Input
              {...a11y}
              ref={emailRef}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              $invalid={a11y['aria-invalid']}
              required
            />
          )}
        </Field>

        <Field label="Password" errors={errors.password}>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              ref={passwordRef}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              $invalid={a11y['aria-invalid']}
              required
            />
          )}
        </Field>

        <SubmitButton />
      </AuthForm>

      <AuthFootnote>
        Don&apos;t have an account? <AuthLink href="/request-access">Request access</AuthLink>
      </AuthFootnote>
    </AuthLayout>
  );
}
