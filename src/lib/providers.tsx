'use client';

import React from 'react';
import { ThemeProvider } from 'styled-components';
import { LazyMotion, domAnimation } from 'framer-motion';
import { theme } from './theme';
import { GlobalStyle } from './global-style';

// Theme + global styles + the lazily-loaded framer-motion feature bundle.
// `domAnimation` covers everything the site uses (transforms, opacity, layout-
// free animation) at roughly half the size of the full feature set.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </ThemeProvider>
  );
}
