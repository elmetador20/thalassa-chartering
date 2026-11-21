'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { acceptInvitationAction, inspectInvitationAction } from '@/app/admin/actions/access';
import { formatDateTime } from '@/lib/admin-format';
import { IDLE_FORM_STATE } from '@/lib/forms';
import { makeAcceptInvitationSchema, ROLE_LABELS } from '@/lib/validation/access';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import AuthLayout, { AuthFootnote, AuthForm, AuthLink } from './AuthLayout';
import PasswordChecklist from './PasswordChecklist';
import { Alert, Button, Field, Input, Muted, PasswordInput } from './ui';

// The invitation link is /accept-invitation#token=… — the token lives in the
// URL fragment, which browsers never send to the server (so it never reaches
// access logs). This page reads it, removes it from the address bar, asks the
// server what the invitation is for, and posts it with the chosen password.

type Info = { name: string; email: string; role: string; expiresAt: string };
type Phase = { kind: 'loading' } | { kind: 'invalid'; message: string } | { kind: 'ready'; info: Info };

function readToken(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  const token = new URLSearchParams(hash).get('token');
  // Keep the token out of the address bar, history and any screenshot.
  if (hash) window.history.replaceState(null, '', window.location.pathname);
  return token;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" $block disabled={pending} aria-disabled={pending}>
      {pending ? 'Creating your account…' : 'Create account'}
    </Button>
  );
}

const layout = {
  heading: 'Set up your account',
  description: 'Your access to INCWORX Reports administration has been approved. Choose a password to finish setting up your account.',
};

export default function AcceptInvitationScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [state, formAction] = useFormState(acceptInvitationAction, IDLE_FORM_STATE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const started = useRef(false);

  useEffect(() => {
    // Once only: the fragment is cleared after the first read (and React's
    // development mode runs effects twice).
    if (started.current) return;
    started.current = true;
    const t = readToken();
    if (!t) {
      setPhase({ kind: 'invalid', message: 'This page needs the invitation link from the Super Admin. Open the full link you were sent.' });
      return;
    }
    setToken(t);
    inspectInvitationAction(t)
      .then((r) => setPhase(r.ok ? { kind: 'ready', info: r } : { kind: 'invalid', message: r.message }))
      .catch(() => setPhase({ kind: 'invalid', message: 'The invitation could not be checked. Please try again.' }));
  }, []);

  useEffect(() => {
    if (state.status === 'error') {
      setPassword('');
      setConfirmPassword('');
      setClientErrors({});
    }
  }, [state]);

  if (phase.kind === 'loading') {
    return (
      <AuthLayout {...layout} title="Checking your invitation…">
        <Muted role="status">One moment.</Muted>
      </AuthLayout>
    );
  }

  if (phase.kind === 'invalid' || (state.status === 'error' && !state.fieldErrors && state.message)) {
    const message = phase.kind === 'invalid' ? phase.message : state.message!;
    return (
      <AuthLayout {...layout} title="Invitation unavailable">
        <Alert tone="error">{message}</Alert>
        <AuthFootnote>
          <AuthLink href="/admin/login">Go to sign in</AuthLink>
        </AuthFootnote>
      </AuthLayout>
    );
  }

  const { info } = phase;
  const identity = { name: info.name, email: info.email };
  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = makeAcceptInvitationSchema(identity).safeParse({ password, confirmPassword });
    if (!result.success) {
      event.preventDefault();
      setClientErrors(toFieldErrors(result.error));
    } else {
      setClientErrors({});
    }
  }

  return (
    <AuthLayout {...layout} title="Choose your password" subtitle={`This link expires ${formatDateTime(info.expiresAt)} and can be used once.`}>
      <AuthForm action={formAction} onSubmit={onSubmit} noValidate>
        <input type="hidden" name="token" value={token ?? ''} />
        <Field label="Name">{(a11y) => <Input {...a11y} value={info.name} readOnly disabled />}</Field>
        <Field label="Email" hint={`You will sign in with this address. Role: ${ROLE_LABELS[info.role] ?? info.role}.`}>
          {(a11y) => <Input {...a11y} name="username" autoComplete="username" value={info.email} readOnly />}
        </Field>
        <Field label="New password" errors={errors.password} showAllErrors hint={<PasswordChecklist password={password} identity={identity} />}>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              $invalid={a11y['aria-invalid']}
              required
            />
          )}
        </Field>
        <Field label="Confirm password" errors={errors.confirmPassword}>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              $invalid={a11y['aria-invalid']}
              required
            />
          )}
        </Field>
        <Submit />
      </AuthForm>
    </AuthLayout>
  );
}
