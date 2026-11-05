'use client';

import React from 'react';
import { createGlobalStyle } from 'styled-components';

// The public site is dark navy; the admin area is a light working surface.
// Injected after the site's global style, so these rules win while any admin
// page is mounted, and vanish with it.
const AdminGlobalStyle = createGlobalStyle`
  :root { color-scheme: light; }

  body {
    background: ${({ theme }) => theme.colors.offWhite};
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminGlobalStyle />
      {children}
    </>
  );
}
