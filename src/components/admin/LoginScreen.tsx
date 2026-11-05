'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useFormState, useFormStatus } from 'react-dom';
import styled from 'styled-components';
import { loginAction } from '@/app/admin/actions/auth';
import { IDLE_FORM_STATE } from '@/lib/forms';
import { loginSchema, toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import { Alert, Button, Field, Input, PasswordInput } from './ui';

const Layout = styled.div`
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  /* Phones: a slim brand band, then the form takes the rest of the screen. */
  grid-template-rows: auto minmax(0, 1fr);

  @media (min-width: 900px) {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
    grid-template-rows: none;
  }
`;

const BrandPanel = styled.aside`
  background: ${({ theme }) => theme.colors.navyDeep};
  color: #fff;
  padding: 28px clamp(20px, 5vw, 64px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 32px;
  border-bottom: 2px solid ${({ theme }) => theme.colors.orange};

  img {
    height: 26px;
    width: auto;
  }

  h1 {
    font-size: clamp(28px, 2.4vw + 14px, 44px);
    font-weight: 400;
    line-height: 1.12;
    letter-spacing: -0.012em;
    max-width: 14ch;
  }

  p {
    font-size: 15px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.bodyOnDark};
    max-width: 38ch;
  }

  .copy {
    display: none;
  }

  @media (min-width: 900px) {
    border-bottom: 0;
    border-right: 2px solid ${({ theme }) => theme.colors.orange};
    padding-block: 48px;
    .copy {
      display: grid;
      gap: 16px;
    }
  }
`;

const FormSide = styled.main`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(32px, 6vw, 72px) clamp(20px, 5vw, 48px);

  @media (min-width: 900px) {
    align-items: center;
  }
`;

const Card = styled.div`
  width: 100%;
  max-width: 420px;
  display: grid;
  gap: 22px;

  h2 {
    font-size: 26px;
    font-weight: 400;
    color: ${({ theme }) => theme.colors.textOnLight};
  }

  .sub {
    margin-top: 6px;
    font-size: 14.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
`;

const Form = styled.form`
  display: grid;
  gap: 18px;
`;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" $block disabled={pending} aria-disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export default function LoginScreen({ next }: { next: string }) {
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
    <Layout>
      <BrandPanel>
        <Image src="/images/incworx-logo-reversed.png" alt="INCWORX" width={1396} height={195} sizes="180px" priority />
        <div className="copy">
          <h1>Reports administration</h1>
          <p>Sign in to manage INCWORX Global, Domestic and Special reports. Access is granted by the Super Admin.</p>
        </div>
      </BrandPanel>

      <FormSide>
        <Card>
          <div>
            <h2>Sign in</h2>
            <p className="sub">Use the email address your account was created with.</p>
          </div>

          {state.status === 'error' && state.message && <Alert tone="error">{state.message}</Alert>}

          <Form action={formAction} onSubmit={onSubmit} noValidate>
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
          </Form>
        </Card>
      </FormSide>
    </Layout>
  );
}
