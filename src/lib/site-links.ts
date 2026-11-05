'use client';

import { usePathname } from 'next/navigation';

// The homepage is one long page of sections linked by anchors ("#about").
// Those anchors only exist on "/", so on any other page they must point back
// to the homepage ("/#about"). Route links ("/reports") pass through.

export function resolveSiteHref(href: string, onHome: boolean): string {
  if (!href.startsWith('#') || onHome) return href;
  return href === '#home' ? '/' : `/${href}`;
}

export function useSiteLinks() {
  const pathname = usePathname() ?? '/';
  const onHome = pathname === '/';
  return { pathname, onHome, href: (h: string) => resolveSiteHref(h, onHome) };
}
