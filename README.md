# INCWORX Intelligence Group — website

A premium institutional site for **INCWORX Intelligence Group**: market
intelligence, chartering, infrastructure and technology.

Built with **Next.js 14 (App Router)**, **TypeScript**, **styled-components** and
**framer-motion**. Deep navy (`#003366`, over a `#002240` ground) is the brand
environment; vivid orange (`#FF3F03`) is a strategic accent only.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build

npm run lint       # ESLint (src, scripts, tests)
npm run typecheck  # TypeScript, no emit
npm test           # unit + integration (starts its own throwaway Postgres)
npm run test:e2e   # builds into .next-e2e, then HTTP tests against `next start`
```

`npm run build` writes to `.next`, the same folder `npm run dev` uses — stop a
running dev server before building, or it and the build will corrupt each
other. `npm run test:e2e` builds into `.next-e2e` instead, so it is safe to run
alongside a dev server.

## Structure

```
src/
  app/
    layout.tsx           Fonts (Maersk Headline / IBM Plex Mono), metadata, providers
    page.tsx             Section order for the single-page site
  components/
    Navbar.tsx           Fixed bar + full-screen overlay menu
    Hero.tsx             Full-bleed cinematic video hero
    StatementSection.tsx Scroll-lit statement of the operating principle
    AboutSection.tsx     Who we are + the four capability blocks
    CapabilitiesSection.tsx / DivisionPanel.tsx
                         Intelligence · Datamatics · Tectonics · Digitronics
    ModelSection.tsx     The operating model as a process diagram
    CharteringSection.tsx  Full-bleed maritime band, structures, cargo, post-fixture
    ProjectsSection.tsx  Manki & Pavinakurve, editorial treatment
    AmbitionSection.tsx  2030 ambition and mission
    GlobalPresence.tsx / WorldMap.tsx
                         Dot-matrix world map with office markers and trade lanes
    SustainabilitySection.tsx, LeadershipSection.tsx, ContactSection.tsx, Footer.tsx
    RouteLines.tsx       Shipping-route motif
    CapabilityIcons.tsx  Hairline icon set + label→icon matching
    IconGrid.tsx         Full-width capability grids and term indexes
    ui.tsx               Layout + typography primitives
    icons.tsx            Minimal stroked icon set
  data/
    siteData.ts          All site copy. Single source of truth for content.
    worldMapData.ts      Generated — see below
  lib/
    theme.ts             Design tokens (colour, type scale, spacing, motion)
    global-style.ts      Reset + global rules
    motion.tsx           Reveal primitives and scroll-linked helpers
    registry.tsx         styled-components SSR registry
```

### Content

All copy lives in `src/data/siteData.ts`. Components render it — they never
hard-code company facts. Figures (`$794 Million`, `$529 Million`, `$1.32
Billion`, `USD 1 billion`) are stored as a number plus its unit alongside the
approved sentence they came from, so the animated counters can never drift
from the source text. The counters format with `en-US` grouping to match the
dollar figures.

### Typography

One family carries the whole site: **Maersk Headline** (Kontrapunkt, v4.000),
the client's licensed corporate face, self-hosted via `next/font/local`.

The supplied TTFs live in `media-src/fonts/` as the build source. What the site
actually serves is the WOFF2 conversion in `src/fonts/` — **71 KB → 28 KB per
face, 61% smaller** — which is what `src/app/layout.tsx` loads. Regenerate with
the snippet in `media-src/fonts/README.txt` if a TTF is ever replaced.

**It ships as two static faces only: Regular (400) and Bold (700).** There is no
Light and no Medium, and `global-style.ts` sets `font-synthesis-weight: none`, so
a `font-weight: 300` heading has no face to resolve to unless one is declared for
it. `layout.tsx` therefore declares explicit `@font-face` weight *ranges*:

| Declared range | File | Covers |
| --- | --- | --- |
| `300 500` | MaerskHeadline-Regular.woff2 | the display 300s, body 400, labels 500 |
| `600 700` | MaerskHeadline-Bold.woff2 | available for emphasis; unused today |

Two consequences worth knowing:

- The scale below still *declares* 300 for large headings, but with no Light in
  the family they render as Regular — visually a little heavier than the scale
  was originally drawn for. The 300s are kept rather than rewritten to 400 so
  that a Light weight, if ever licensed, is picked up with no code change.
- Nothing on the site uses 600+, so the browser fetches only the Regular file.
  Bold is declared so emphasis needs no code change, and costs nothing unused.

Glyph coverage was checked against every character the site renders. The family
has **no rupee sign (U+20B9)** and **no arrow (U+2192)**. Neither bites: the site
carries no rupee figures, and every arrow renders inside `FlowLine`, which is set
in IBM Plex Mono — verified to cover it. Reintroducing a rupee figure would fall
back to another font, so use the dollar figures in `siteData.ts`.

The system is deliberately light:

| Role | Weight | Size |
| --- | --- | --- |
| Display / h1 / h2 | 300 | up to 74px (hero), 60px / 46px |
| h3 | 300 | up to 27px |
| h4 / h5 / labels | 500 | 15–20px |
| Body | 400 | 16–18px |

Letter-spacing is an optical correction only (−0.005em to −0.018em on the
largest sizes, zero elsewhere) — no tracking as decoration. Nothing is bold.

IBM Plex Mono is reserved for genuinely technical annotations: map coordinates,
process flows, the chartering read-out and section numerals. Never for section
titles or body copy.

### Colour

All colour resolves to `src/lib/theme.ts`. The navy ramp sat at roughly 1.5%
relative luminance, which reads as flat black on high-contrast laptop panels —
Mac especially, where a true black backdrop leaves the navy nothing to separate
from. Every navy was lifted to about double its luminance at the **same hue
(210°) and saturation**, so the colour itself is unchanged; only its lightness
moved.

| Token | Before | After | Luminance |
| --- | --- | --- | --- |
| `navyDeep` | `#001426` | `#002240` | 0.64% → 1.51% |
| `navyMuted` | `#071A2D` | `#0B2844` | 0.97% → 2.01% |
| `navy` | `#002244` | `#003366` | 1.56% → 3.33% |
| `navyLift` | `#0A2743` | `#0F3A64` | 1.92% → 4.05% |

Lifting the surfaces costs contrast, so the foregrounds that sit on them were
raised in step: `steel` `#8FA3B5` → `#9DB0C0` and `mutedOnDark` alpha 0.48 →
0.58, both to hold 4.5:1 on the brightest navy.

The accent needed the same treatment. `#FF3F03` only clears 4.5:1 on backgrounds
below **1.73%** luminance, which the lifted ramp deliberately exceeds — so the
palette now carries a variant at each end:

- `orange` `#FF3F03` — the brand accent. Icons, rules, fills, borders and
  display type above 24px, all of which need only 3:1 and clear it everywhere.
- `orangeOnDark` `#FF7144` — small orange **text** on navy.
- `orangeOnLight` `#C92E00` — small orange **text** on off-white.

Both variants hold the brand hue (14.3°) and saturation (100%) exactly; only
lightness differs. Every rendered text node on the page was measured against its
computed background after the change: 451 checked, zero below its WCAG AA
threshold.

### Icons

`CapabilityIcons.tsx` holds 32 hairline marks on a 26×26 grid — 1.2px even
stroke, round caps, single colour, no fills. `iconFor(label)` keyword-matches a
capability to its mark, so `siteData.ts` stays free of presentation concerns and
new content picks up a sensible icon automatically. The four divisions have
fixed marks (compass, chart, crane, chip) used consistently wherever they
appear.

`IconGrid.tsx` lays capability indexes out across the **full container width** —
three columns for title + description, four for label-only term lists. This
replaced a nested two-column grid that left half the page empty whenever two
blocks had very different lengths.

### Logo

`public/images/incworx-logo-reversed.png` is the **reversed** lockup — navy
recoloured to white, orange kept — generated from the full-colour master and
**trimmed to the artwork**. Both matter: the full-colour version is navy-on-
light and disappears against the navy bar, and an untrimmed export puts the
wordmark inside transparent padding, so a CSS height sizes the canvas rather
than the mark.

If the logo is replaced, trim and recolour it the same way, and update the
`width`/`height` props in `Navbar.tsx` and `Footer.tsx` to the new pixel size —
Next uses them to reserve layout space.

### Design system

`src/lib/theme.ts` holds every token: the navy family, the orange accent (plus
`orangeOnLight`, a darkened variant used for orange *text* on light sections so
it clears WCAG AA), the fluid type scale, spacing, line colours and motion
easings. Nothing in the components uses a raw colour or a magic font size.

### Motion

Entrances are **CSS transitions** driven by a `data-shown` attribute that one
shared, timer-throttled scroll watcher sets (`src/lib/motion.tsx`). This is
deliberate: a JavaScript-driven entrance that never receives a frame leaves
content permanently invisible, and nearly everything on this page animates in.
framer-motion is used only for scroll-linked values — parallax and the hero's
exit — where a stall simply means no parallax.

All motion is disabled under `prefers-reduced-motion: reduce`.

### World map

`src/data/worldMapData.ts` is generated, not hand-written:

```bash
node scripts/gen-world.mjs
```

It projects Natural Earth 110m land data (public domain, via the `world-atlas`
dev dependency) into a fixed viewBox and emits the landmass as a single SVG path
of zero-length segments — thousands of dots in one DOM node — plus the office
coordinates pre-projected into the same space. There is no runtime map library
and no third-party tile requests.

### Hero media

`HeroBackdrop.tsx` renders the hero background from one of two sources, chosen
by `heroMedia.source` in `siteData.ts`:

- **`'video'` (current)** — two purpose-built encodes cut from the master in
  `media-src/hero-master.mp4` (2944 x 1104). Masters live outside `public/`
  because everything in `public/` is deployed.

  | | Encode | Size |
  | --- | --- | --- |
  | Desktop | `hero.mp4` 1920 x 720 | ~1.0 MB |
  | Phones | `hero-sm.mp4` 662 x 1104 | ~485 KB |

  The phone encode is a **portrait crop**, not a downscale. The master is 2.67:1;
  a portrait phone showing it full-bleed displays roughly 17% of the frame
  width, so a downscaled wide encode spends ~83% of its bitrate on pixels that
  are cropped away and then upscales what is left by around 9x. Cropping to 3:5
  first puts the bits on screen and drops the upscale to ~1.5x (about 2.3x on a
  3x-density phone).

  h264 only: VP9 encoded consistently *larger* than h264 for this footage, so
  webm earned nothing. Audio is stripped — the hero is always muted. The poster
  is a CSS layer rather than `<video poster>` so it can be art-directed to match
  (`hero-poster.jpg` wide, `hero-poster-sm.jpg` portrait).

  Regenerate after replacing the master:

  ```bash
  SRC=media-src/hero-master.mp4
  CROP="crop=662:1104:1141:0"
  ffmpeg -y -i $SRC -an -vf "scale=1920:-2:flags=lanczos" -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart public/assets/hero.mp4
  ffmpeg -y -i $SRC -an -vf "$CROP" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart public/assets/hero-sm.mp4
  ffmpeg -y -ss 1.8 -i $SRC -frames:v 1 -vf "scale=1920:-2:flags=lanczos" -q:v 5 public/assets/hero-poster.jpg
  ffmpeg -y -ss 1.8 -i $SRC -frames:v 1 -vf "$CROP" -q:v 5 public/assets/hero-poster-sm.jpg
  ```

- **`'pin'`** — the client-supplied Pinterest embed, cropped to full bleed.
  Measured rather than assumed: the pin card is capped at 600px wide, the
  picture is 598 x 335 at the top of it, a "Save" badge sits at (507, 13) and an
  author footer follows below. The iframe is therefore pinned to 600px, clipped
  to the picture, badge-masked and scaled to cover.

  Not in use: that particular pin resolves to a 563 x 317 Shutterstock-
  watermarked comp, so it renders soft and watermarked at hero size. Switching
  back is a one-word change, but it needs a licensed, higher-resolution pin to
  be worth doing.

## Database

PostgreSQL on the project's existing **Supabase** instance, through **Prisma
7.10.1** (CLI, client and `@prisma/adapter-pg` pinned together — `prisma@latest`
currently points at an 8.0 release candidate, so do not "upgrade" via the
update notice).

| Path | What |
| --- | --- |
| `prisma/schema.prisma` | Data model |
| `prisma/migrations/` | Migration history — committed, applied in order |
| `prisma.config.ts` | CLI config: env loading, migration connection, schema pinning |
| `src/lib/server/db.ts` | The app's client (pooled connection, `server-only`) |
| `src/lib/server/reports/` | Report queries, date-only helpers, R2 key minting |
| `src/generated/prisma/` | Generated client — git-ignored, rebuilt by `postinstall` |

### The `incworx` schema

Every table lives in a dedicated Postgres schema, `incworx`, not Supabase's
`public`:

- Supabase exposes `public` through its REST API using the anon key, which is
  public by design. `incworx` is not exposed, and the migration revokes the API
  roles' access to it outright.
- Prisma only inspects or resets schemas it manages, so no Prisma command can
  touch existing data in `public`.
- Prisma's migration history table also lives in `incworx`. `prisma.config.ts`
  pins this automatically; without it, `migrate deploy` stops with **P3005** on
  any Supabase project that already has tables in `public`.

### Model

`admin_users` 1 ── * `reports`, via `reports.created_by_id`. Deleting an admin
who has reports is refused (RESTRICT); deactivate them with `is_active` instead.

`report_date` is a `DATE`, independent of upload time, so historical reports can
carry any past date. It crosses every boundary as a `'YYYY-MM-DD'` string and is
only ever converted by `parseDateOnly` / `formatDateOnly`. Building a date in
local time shifts it by the machine's offset (a day early in India).

R2 objects are stored as **keys**, never URLs. Keys come from
`newReportFileKey()` — `reports/<uuid>.pdf`, independent of title, date and file
name — and are unique in the database.

Lists order by `report_date`, then `created_at`, then `id`. Report date alone is
not unique, and paginating over a non-unique order repeats or skips rows.

Integrity rules the schema language cannot express are CHECK constraints in the
migration: lower-case admin e-mail, URL-safe slugs, keys confined to `reports/`
with no traversal, positive file size, and `published_at` required when
published.

### Commands

```bash
npm run db:validate   # check the schema (no database needed)
npm run db:status     # what has / hasn't been applied
npm run db:deploy     # apply pending migrations — the only command for Supabase
npm run db:studio     # browse the data
```

`npm run db:deploy` never resets anything: it only applies pending migrations,
each recorded once. **Do not run `prisma migrate reset`, `prisma db push
--force-reset` or `--accept-data-loss` against Supabase.** Use `npm run
db:migrate` (`migrate dev`) only against a disposable development database: if
it detects drift it offers to reset, which deletes data.

## Admin authentication

Everything under `/admin` is for INCWORX staff. There is **no public sign-up**:
one Super Admin is created by a seed script, and every other account is created
by that Super Admin and must be approved before it can sign in.

### Roles

Permissions, not roles, are what the code checks — the whole table lives in
`src/lib/auth/permissions.ts`, and every rule is enforced on the server.

| Permission | Super Admin | Admin |
| --- | :---: | :---: |
| Dashboard, own account, password change | ✓ | ✓ |
| View, upload, edit, replace PDF, publish, archive reports | ✓ | ✓ |
| **Delete** reports | ✓ | — |
| View, create, approve / reject, activate / deactivate administrators | ✓ | — |
| See everyone's activity (Admins see their own) | ✓ | — |

The admin-management workflow can only ever create the **Admin** role. A Super
Admin cannot be created, promoted to, approved, rejected or deactivated from
the UI.

### Account lifecycle

| From | Action (Super Admin) | To | Can sign in |
| --- | --- | --- | :---: |
| — | create | PENDING, inactive | — |
| PENDING or REJECTED | approve | APPROVED, active | ✓ |
| PENDING or APPROVED | reject (optional reason) | REJECTED, inactive | — |
| APPROVED, active | deactivate | APPROVED, inactive | — |
| APPROVED, inactive | activate | APPROVED, active | ✓ |

Rejecting or deactivating an account ends every session it has, immediately.
Nobody can act on their own account.

### How it is secured

| Concern | How |
| --- | --- |
| Passwords | Argon2id, 64 MiB / 3 passes / 1 lane (~170 ms), NFKC-normalised. Hashes are omitted from every query unless the sign-in code asks for them. |
| Password policy | 12–128 chars; upper, lower, number, special; no sequences (`abcd`, `1234`, `qwer`), no repeats, no name or e-mail. **Plus, server-side only:** a zxcvbn-ts strength estimate with a 40,000-entry common-password list and English names/words — score 4 required. The same Zod schemas validate in the browser (instant feedback) and on the server (enforcement); the dictionaries never ship to the browser. |
| Sign-in | Validates shape only, so accounts made under an older policy still sign in. Wrong password and unknown e-mail get the same message and the same timing. Pending / rejected / inactive messages are shown only **after** the password is proven. |
| Sessions | Random 256-bit token in an `HttpOnly`, `Secure`, `SameSite=Strict`, `__Host-` cookie; only its SHA-256 is stored. 12 h absolute, 2 h idle. Every request re-reads the session **and** the account. Password change ends every session and rotates the current one. |
| Brute force | Postgres-backed rate limits, checked before any hashing: 5 failures / 15 min per account, 20 / 15 min per IP, 5 / 15 min for current-password checks. Keys are stored hashed. |
| CSRF | Next.js rejects server-action POSTs from another origin; the session cookie is `SameSite=Strict`. |
| Authorization | `middleware.ts` is only a fast redirect for missing cookies. The boundary is `src/lib/server/auth/guards.ts`, called by every protected page and every server action; services re-check the permission themselves. |
| Database rules | Enforced by Postgres, so they hold even for Prisma Studio or raw SQL: only approved accounts can be active; an Admin's approval records its approver; the approver must be a Super Admin and never the account itself; **the last active Super Admin can't be deactivated, demoted or deleted**; the audit log is append-only. |
| Audit | `audit_logs`: admin created / approved / rejected / activated / deactivated, sign-in success and failure, sign-out, password change (report events are ready for the reports stage). Actor, target, time, IP, user agent and non-sensitive metadata — a writer-side filter drops anything that looks like a secret. |
| Responses | `/admin` is `noindex`, can't be framed, and sends `Referrer-Policy: same-origin`. |

Password reset by e-mail is **not** implemented: there is no e-mail delivery
service in this project. An admin who loses their password is deactivated by
the Super Admin and a new account created.

### First-time setup

1. Add `DATABASE_URL` and `DIRECT_URL` to `.env` (see `.env.example`).
2. `npm run db:deploy` — applies both migrations.
3. `npm run db:seed` — creates the Super Admin. You are asked for name, e-mail
   and password (hidden). It does nothing if a Super Admin already exists, and
   never changes an existing account.
4. Sign in at `/admin/login`, open **Administrators**, add an admin, approve it.

### Tests

`npm test` starts a real, throwaway PostgreSQL (`embedded-postgres`), shaped
like the Supabase project (API roles, existing data in `public`), applies the
migrations with the real `prisma migrate deploy`, and runs unit and
integration tests. `npm run test:e2e` additionally builds the app and runs HTTP
tests against `next start`: redirects, cookie flags, CSRF, the no-JS sign-in
form, response headers, and a scan of the browser bundle for secrets.
