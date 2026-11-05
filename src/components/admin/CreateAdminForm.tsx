'use client';

import React, { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import styled from 'styled-components';
import { createAdminAction } from '@/app/admin/actions/users';
import { IDLE_FORM_STATE } from '@/lib/forms';
import { createAdminSchema, toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import PasswordChecklist from './PasswordChecklist';
import { Alert, Button, Field, Input, Muted, PasswordInput } from './ui';

const Form = styled.form`
  display: grid;
  gap: 18px;
`;

const Row = styled.div`
  display: grid;
  gap: 18px;
  @media (min-width: 640px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
`;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create administrator'}
    </Button>
  );
}

const EMPTY = { name: '', email: '', password: '', confirmPassword: '' };

export default function CreateAdminForm() {
  const [state, formAction] = useFormState(createAdminAction, IDLE_FORM_STATE);
  const [values, setValues] = useState(EMPTY);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (state.status === 'success') setValues(EMPTY);
    if (state.status !== 'idle') setClientErrors({});
  }, [state]);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = createAdminSchema.safeParse(values);
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
      <Muted>
        New accounts are created with the Admin role, start <strong>pending</strong> and cannot sign in until you
        approve them.
      </Muted>

      {state.status === 'success' && state.message && <Alert tone="success">{state.message}</Alert>}
      {state.status === 'error' && state.message && <Alert tone="error">{state.message}</Alert>}

      <Row>
        <Field label="Full name" errors={errors.name}>
          {(a11y) => (
            <Input {...a11y} name="name" autoComplete="off" value={values.name} onChange={set('name')} $invalid={a11y['aria-invalid']} />
          )}
        </Field>
        <Field label="Email" errors={errors.email}>
          {(a11y) => (
            <Input
              {...a11y}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={values.email}
              onChange={set('email')}
              $invalid={a11y['aria-invalid']}
            />
          )}
        </Field>
      </Row>

      <Row>
        <Field
          label="Password"
          errors={errors.password}
          showAllErrors
          hint={<PasswordChecklist password={values.password} identity={{ name: values.name, email: values.email }} />}
        >
          {(a11y) => (
            <PasswordInput
              {...a11y}
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={set('password')}
              $invalid={a11y['aria-invalid']}
            />
          )}
        </Field>
        <Field label="Confirm password" errors={errors.confirmPassword}>
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
      </Row>

      <div>
        <Submit />
      </div>
    </Form>
  );
}
