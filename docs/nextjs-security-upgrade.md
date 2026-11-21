# Next.js security and upgrade recommendation

**Status:** for review before production deployment. Nothing has been
upgraded. Stage 4.1 deliberately keeps `next@14.2.35`, as instructed.

**Date of review:** 6 November 2026.

## Summary

`npm audit --omit=dev` reports **25 advisories** against `next@14.2.35`:
3 critical, 9 high, 11 moderate and 2 low. The advisory pages list **no 14.x patch** for any of them, and
Next.js 14 no longer receives security releases. The fixes are in **15.5.28**
(lowest 15.x release that fixes every advisory reviewed) or **16.4.1+**
(`npm audit` proposes 16.4.5).

**Recommendation:** before the site goes to production, plan a dedicated
upgrade stage to **Next.js 15.5.x (≥ 15.5.28)**. It is the smallest jump that
clears the advisories, and React 18 → 19 is the main breaking change it brings.
Moving to 16.x can follow as a separate step.

`postcss` (high) and `styled-components` (moderate, via postcss) are also
flagged. `styled-components` has a non-major fix (6.6.0), and `postcss` is
fixed by the Next.js upgrade.

## Advisories reviewed in detail (critical and high)

Read from the GitHub advisory pages on 6 November 2026. "Applies" assumes the
expected deployment: App Router, Server Actions, default `images` config, no
rewrites, no custom server, Linux host (Vercel or a Node host behind a proxy).

| Advisory | Severity | What | Applies here? | Fixed in |
| --- | --- | --- | --- | --- |
| GHSA-2464-fhr4-w9xw | Critical | RCE in Image Optimization (upstream library) on glibc Linux | **Likely** — the site uses `next/image` | 15.5.28 / 16.4.1; workaround: `sharp` ≥ 0.35.5 |
| GHSA-2xp9-vwfh-vxw4 | Critical | RCE in Image Optimization when AVIF files are optimised | Unlikely today — no AVIF files in `public/` | 15.5.24 / 16.3.3 |
| GHSA-p293-qw3h-jr36 | Critical | RCE on **Windows-hosted** servers | No (Linux hosting); **yes** if ever self-hosted on Windows | 15.5.24 / 16.3.3 |
| GHSA-p3m5-59mp-jv5r | High | DoS in App Router via Server Actions | **Yes** — admin uses Server Actions | 15.5.28 / 16.4.1 |
| GHSA-m99w-x7hq-7vfj | High | DoS in App Router via Server Actions | **Yes** | 15.5.21 / 16.2.11 |
| GHSA-8h8q-6873-q5fj | High | DoS via crafted request to a Server Function endpoint | Likely | 15.5.16 / 16.2.5 |
| GHSA-q4gf-8mx6-v5v3 | High | DoS via crafted request to a Server Function endpoint | Likely | 15.5.15 / 16.2.3 |
| GHSA-89xv-2m56-2m9x | High | SSRF in Server Actions when the Host header is not pinned | No on Vercel / `next start` ≥ 14.2 behind a proxy that pins Host | 15.5.21 / 16.2.11 |
| GHSA-p9j2-gv94-2wf4 | High | SSRF in rewrites with request-controlled hostnames | No — no rewrites | 15.5.21 / 16.2.11 |

The other advisories (moderate and low) cover image-cache growth, cache
poisoning, `beforeInteractive` / CSP-nonce XSS, Pages-Router i18n middleware
bypass, WebSocket SSRF and Edge payload size. Most need features this site does
not use. Run `npm audit --omit=dev` for the current list.

## Interim mitigations (if production must start before the upgrade)

These reduce exposure, but they are no substitute for upgrading:

1. **Host on Linux, never Windows** (GHSA-p293).
2. **Image optimisation:** either set `images: { unoptimized: true }` in
   `next.config.mjs`, which disables the optimiser endpoint (the site's images
   are already compressed assets), or make sure the runtime uses `sharp` ≥ 0.35.5
   (GHSA-2464). Never add AVIF sources or `dangerouslyAllowSVG`.
3. **Pin the Host header** at the proxy / platform (Vercel does this) — GHSA-89xv.
4. Put the site behind a WAF / rate limiting (e.g. Vercel Firewall or
   Cloudflare) to blunt the request-based DoS issues.

## What the upgrade stage involves

- `next` 14.2.35 → 15.5.x, `react` / `react-dom` 18.3.1 → 19.x,
  `eslint-config-next` to match. Check `styled-components` 6 and `framer-motion`
  / `motion` against React 19.
- Next 15 breaking changes that touch this code:
  - `params`, `searchParams`, `cookies()` and `headers()` become **async**:
    pages, layouts, `generateMetadata`, route handlers and `guards.ts` need
    `await`. There is a codemod: `npx @next/codemod@latest next-async-request-api`.
  - `fetch` and GET route handlers are no longer cached by default. This app
    already marks its data routes `force-dynamic`, so no change is expected.
  - `experimental.serverComponentsExternalPackages` →
    `serverExternalPackages`.
  - `useFormState` → `useActionState` (React 19).
- Re-run the full suite (`npm run lint`, `typecheck`, `test`, `test:e2e`) and
  the visual checks. The e2e suite covers the security-relevant behaviour:
  middleware, cookies, CSRF, headers, report visibility.
- The CVE-2025-29927 note in `middleware.ts` (requires ≥ 14.2.25) stays
  accurate. Middleware remains a convenience redirect, not the security
  boundary.
