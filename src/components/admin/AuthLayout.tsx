'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styled from 'styled-components';

// ============================================================================
// The signed-out screens (sign in, request access, accept invitation): navy
// brand panel with the INCWORX wordmark, a thin orange divider, and a light
// form side. One layout, so all three look identical.
// ============================================================================

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
  justify-content: center;
  /* Never stretch children across the panel — a stretched <img> distorts. */
  align-items: flex-start;
  border-bottom: 2px solid ${({ theme }) => theme.colors.orange};

  /* Logo + heading + description: one group, left-aligned together. */
  .brand {
    display: grid;
    justify-items: start;
    gap: 28px;
    width: 100%;
  }

  /* The wordmark keeps its own 1396:195 proportions at every size: width is
     capped, height follows. */
  .logo {
    display: block;
    width: 100%;
    max-width: 180px;
    height: auto;
    object-fit: contain;
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
    .logo {
      max-width: 240px;
    }
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

const Card = styled.div<{ $wide?: boolean }>`
  width: 100%;
  max-width: ${({ $wide }) => ($wide ? 520 : 420)}px;
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
    line-height: 1.55;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
`;

export const AuthForm = styled.form`
  display: grid;
  gap: 18px;
`;

/** "Need an account? Request access" style line under a form. */
export const AuthFootnote = styled.p`
  font-size: 14.5px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.mutedOnLight};
  text-align: center;

  a {
    font-weight: 500;
    color: ${({ theme }) => theme.colors.navy};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  a:hover {
    color: ${({ theme }) => theme.colors.orangeOnLight};
  }
`;

export { Link as AuthLink };

interface Props {
  heading: string;
  description: string;
  /** Heading and intro of the form side. */
  title: string;
  subtitle?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}

export default function AuthLayout({ heading, description, title, subtitle, wide, children }: Props) {
  return (
    <Layout>
      <BrandPanel>
        <div className="brand">
          <Image
            className="logo"
            src="/images/incworx-logo-reversed.png"
            alt="INCWORX"
            width={1396}
            height={195}
            sizes="(min-width: 900px) 240px, 180px"
            priority
          />
          <div className="copy">
            <h1>{heading}</h1>
            <p>{description}</p>
          </div>
        </div>
      </BrandPanel>

      <FormSide>
        <Card $wide={wide}>
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          {children}
        </Card>
      </FormSide>
    </Layout>
  );
}
