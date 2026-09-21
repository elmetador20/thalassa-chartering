'use client';

import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    color-scheme: dark;
    --nav-h: 76px;
  }

  @media (max-width: 700px) {
    :root { --nav-h: 64px; }
  }

  html {
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
  }

  html, body {
    padding: 0;
    margin: 0;
    /* Hard guarantee against horizontal overflow on every breakpoint. */
    max-width: 100%;
    overflow-x: hidden;
  }

  body {
    font-family: ${({ theme }) => theme.fonts.body};
    background: ${({ theme }) => theme.colors.navyDeep};
    color: ${({ theme }) => theme.colors.textOnDark};
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-synthesis-weight: none;
  }

  /* Anchored sections clear the fixed navigation. */
  [id] { scroll-margin-top: calc(var(--nav-h) + 8px); }

  /* Large headings are light; small ones step up to medium. Nothing is bold. */
  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 300;
    line-height: 1.1;
    letter-spacing: -0.012em;
    text-wrap: balance;
  }

  h4, h5, h6 {
    font-weight: 500;
    letter-spacing: 0;
  }

  p { margin: 0; text-wrap: pretty; }
  ul, ol { margin: 0; padding: 0; list-style: none; }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  img, video, svg, iframe { display: block; max-width: 100%; }
  img, video { height: auto; }

  ::selection {
    background: ${({ theme }) => theme.colors.orange};
    color: #fff;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.orange};
    outline-offset: 3px;
    border-radius: 1px;
  }

  /* Comfortable touch targets on coarse pointers. */
  @media (pointer: coarse) {
    a, button { min-height: 44px; }
    a:not([class]) { min-height: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
