'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import styled from 'styled-components';
import { changePasswordAction } from '@/app/admin/actions/auth';
import { IDLE_FORM_STATE } from '@/lib/forms';
import { makeChangePasswordSchema, toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import PasswordChecklist from './PasswordChecklist';
import { Alert, Button, Field, PasswordInput } from './ui';

const Form = styled.form`
  display: grid;
  gap: 18px;
  max-width: 460px;
`;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Change password'}
    </Button>
  );
}

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ChangePasswordForm({ name, email }: { name: string; email: string }) {
  const [state, formAction] = useFormState(changePasswordAction, IDLE_FORM_STATE);
  const [values, setValues] = useState(EMPTY);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const schema = useMemo(() => makeChangePasswordSchema({ name, email }), [name, email]);

  useEffect(() => {
    if (state.status === 'success') setValues(EMPTY);
    if (state.status !== 'idle') setClientErrors({});
  }, [state]);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = schema.safeParse(values);
    if (!result.success) {
      event.preventDefault();
      setClientErrors(toFieldErrors(result.error));
    } else {
      setClientErrors({});
    }
  }

  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  return (
    <Form action={formAction} onSubmit={onSubmit} noValidate>
      {state.status === 'success' && state.message && <Alert tone="success">{state.message}</Alert>}
      {state.status === 'error' && state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Current password" errors={errors.currentPassword}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            name="currentPassword"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={set('currentPassword')}
            $invalid={a11y['aria-invalid']}
          />
        )}
      </Field>
      <Field
        label="New password"
        errors={errors.newPassword}
        showAllErrors
        hint={<PasswordChecklist password={values.newPassword} identity={{ name, email }} />}
      >
        {(a11y) => (
          <PasswordInput
            {...a11y}
            name="newPassword"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={set('newPassword')}
            $invalid={a11y['aria-invalid']}
          />
        )}
      </Field>
      <Field label="Confirm new password" errors={errors.confirmPassword}>
        {(a11y) => (
          <PasswordInput
            {...a11y}
            name="confirmPassword"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={set('confirmPassword')}
            $invalid={a11y['aria-invalid']}
          />
        )}
      </Field>

      <div>
        <Submit />
      </div>
    </Form>
  );
}
