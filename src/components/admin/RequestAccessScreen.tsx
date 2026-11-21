'use client';

import React, { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import styled from 'styled-components';
import { requestAccessAction } from '@/app/admin/actions/access';
import { IDLE_FORM_STATE } from '@/lib/forms';
import { accessRequestSchema, REASON_MAX_LENGTH } from '@/lib/validation/access';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import AuthLayout, { AuthFootnote, AuthForm, AuthLink } from './AuthLayout';
import { Alert, Button, Field, Input, Textarea } from './ui';

// Public Request Access form. Works without JavaScript (a plain form post to
// the server action); with JavaScript it validates as you go. Nothing about
// existing accounts or requests is ever revealed — every accepted submission
// gets the same confirmation.

const Trap = styled.div`
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;

type Values = { fullName: string; email: string; department: string; designation: string; reason: string };
const EMPTY: Values = { fullName: '', email: '', department: '', designation: '', reason: '' };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" $block disabled={pending} aria-disabled={pending}>
      {pending ? 'Submitting…' : 'Submit request'}
    </Button>
  );
}

export default function RequestAccessScreen() {
  const [state, formAction] = useFormState(requestAccessAction, IDLE_FORM_STATE);
  const [values, setValues] = useState<Values>({ ...EMPTY, ...(state.values as Partial<Values> | undefined) });
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };
  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = accessRequestSchema.safeParse(values);
    if (!result.success) {
      event.preventDefault();
      setClientErrors(toFieldErrors(result.error));
    } else {
      setClientErrors({});
    }
  }

  const layout = {
    heading: 'Request access',
    description: 'Access to INCWORX Reports administration is granted by the Super Admin. Tell us who you are and why you need access.',
  };

  if (state.status === 'success') {
    return (
      <AuthLayout {...layout} title="Request received">
        <Alert tone="success">{state.message}</Alert>
        <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>
          If your request is approved, you will receive a secure link to set up your account and choose your own password. The link is valid
          for 24 hours.
        </p>
        <AuthFootnote>
          <AuthLink href="/admin/login">Back to sign in</AuthLink>
        </AuthFootnote>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...layout} title="Request access" subtitle="All fields are required. No password is needed at this stage." wide>
      {state.status === 'error' && state.message && <Alert tone="error">{state.message}</Alert>}

      <AuthForm action={formAction} onSubmit={onSubmit} noValidate>
        <Field label="Full name" errors={errors.fullName}>
          {(a11y) => (
            <Input {...a11y} name="fullName" autoComplete="name" maxLength={NAME_MAX_LENGTH} value={values.fullName} onChange={set('fullName')} $invalid={a11y['aria-invalid']} required />
          )}
        </Field>
        <Field label="Work email" errors={errors.email}>
          {(a11y) => (
            <Input
              {...a11y}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={EMAIL_MAX_LENGTH}
              value={values.email}
              onChange={set('email')}
              $invalid={a11y['aria-invalid']}
              required
            />
          )}
        </Field>
        <Field label="Company / department" errors={errors.department}>
          {(a11y) => (
            <Input {...a11y} name="department" autoComplete="organization" maxLength={160} value={values.department} onChange={set('department')} $invalid={a11y['aria-invalid']} required />
          )}
        </Field>
        <Field label="Designation" errors={errors.designation}>
          {(a11y) => (
            <Input {...a11y} name="designation" autoComplete="organization-title" maxLength={120} value={values.designation} onChange={set('designation')} $invalid={a11y['aria-invalid']} required />
          )}
        </Field>
        <Field label="Reason for access" hint="Which reports you will work with and why." errors={errors.reason}>
          {(a11y) => (
            <Textarea {...a11y} name="reason" rows={4} maxLength={REASON_MAX_LENGTH} value={values.reason} onChange={set('reason')} $invalid={a11y['aria-invalid']} required />
          )}
        </Field>

        {/* Honeypot — hidden from people and screen readers; bots fill it in. */}
        <Trap aria-hidden="true">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </Trap>

        <Submit />
      </AuthForm>

      <AuthFootnote>
        Already have an account? <AuthLink href="/admin/login">Sign in</AuthLink>
      </AuthFootnote>
    </AuthLayout>
  );
}
