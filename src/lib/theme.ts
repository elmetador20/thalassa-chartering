// ============================================================================
// INCWORX design tokens.
// Deep navy is the brand environment; orange is a strategic accent only.
// Everything visual in the site resolves back to this file.
//
// Navy ramp note: the original ramp sat at ~1.5% relative luminance, which
// reads as flat black on high-contrast laptop panels (Mac especially, where
// true blacks leave nothing for it to separate from). Every navy was lifted
// to roughly double its luminance at the SAME hue (210deg) and saturation, so
// the colour is unchanged — only its lightness. The dim foregrounds that sit
// on these surfaces (steel, mutedOnDark) were raised in step to hold 4.5:1.
// ============================================================================

export const theme = {
  colors: {
    // --- Navy family (dominant) ---
    navy: '#003366',        // primary brand environment
    navyDeep: '#002240',    // deepest background — hero, footer, cinematic bands
    navyMuted: '#0B2844',   // secondary dark surface
    navyLift: '#0F3A64',    // raised dark surface / hover fill

    // --- Accent (strategic, never decorative) ---
    orange: '#FF3F03',
    orangeHover: '#FF5A24',
    // Same accent, darkened just enough to clear 4.5:1 as text on off-white.
    orangeOnLight: '#C92E00',
    // ...and the mirror of that for dark surfaces. The pure accent only clears
    // 4.5:1 on backgrounds below 1.73% luminance, which the lifted navy ramp
    // deliberately exceeds, so small orange TEXT on navy uses this instead.
    // Hue (14.3deg) and saturation (100%) are identical to the brand accent —
    // only lightness moves. Icons, rules, fills, borders and display type above
    // 24px stay on `orange`: they only need 3:1 and clear it everywhere.
    orangeOnDark: '#FF7144',
    orangeSoft: 'rgba(255, 63, 3, 0.10)',
    orangeLine: 'rgba(255, 63, 3, 0.42)',

    // --- Neutrals ---
    white: '#FFFFFF',
    offWhite: '#F5F7F8',
    steel: '#9DB0C0',       // subtle blue-grey — technical labels, meta

    // --- Text ---
    textOnLight: '#003366',
    bodyOnLight: '#41576B',
    mutedOnLight: '#52677A',
    textOnDark: '#FFFFFF',
    bodyOnDark: 'rgba(255, 255, 255, 0.70)',
    mutedOnDark: 'rgba(255, 255, 255, 0.58)',

    // --- Lines (thin technical rules, never heavy borders) ---
    lineOnDark: 'rgba(255, 255, 255, 0.14)',
    lineOnDarkSoft: 'rgba(255, 255, 255, 0.08)',
    lineOnLight: 'rgba(0, 51, 102, 0.14)',
    lineOnLightSoft: 'rgba(0, 51, 102, 0.08)',

    // --- Status (admin UI, light surfaces) ---
    // Each text colour clears 4.5:1 on its own tint and on white.
    success: '#17663A',
    successSoft: '#E7F4EC',
    warning: '#7A4B00',
    warningSoft: '#FFF3D6',
    danger: '#A61B1B',
    dangerSoft: '#FCEBEB',
    neutral: '#52677A',
    neutralSoft: '#EEF2F5',
    infoSoft: '#E6EEF6',
  },

  fonts: {
    // Loaded via next/font in layout.tsx, exposed as CSS custom properties.
    // `display` and `body` intentionally resolve to the same family.
    display: 'var(--font-sans), "Helvetica Neue", Arial, sans-serif',
    body: 'var(--font-sans), "Helvetica Neue", Arial, sans-serif',
    mono: "var(--font-mono), ui-monospace, 'SFMono-Regular', monospace",
  },

  // Restrained by design: large type is light, small type is medium.
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
  },

  // Fluid type scale, modelled on the reference site's restraint: headings
  // grow with the viewport but stop well short of poster sizes, and the whole
  // scale is set light. Floors are chosen so nothing overflows at 320px.
  type: {
    display: 'clamp(36px, 4.4vw + 14px, 74px)',
    h1: 'clamp(32px, 3.5vw + 13px, 60px)',
    h2: 'clamp(28px, 2.4vw + 13px, 46px)',
    h3: 'clamp(20px, 1.1vw + 13px, 27px)',
    h4: 'clamp(17px, 0.5vw + 14px, 20px)',
    body: 'clamp(16px, 0.35vw + 14.6px, 18px)',
    bodyLg: 'clamp(17px, 0.7vw + 15px, 21px)',
    small: 'clamp(13px, 0.3vw + 12px, 14.5px)',
    // Section labels: sized to be read, not squinted at.
    label: 'clamp(13px, 0.35vw + 11.8px, 16px)',
    // Editorial figures (project values, ambition figure).
    figure: 'clamp(40px, 5vw + 16px, 92px)',
    index: 'clamp(13px, 1vw, 15px)',
  },

  layout: {
    maxWidth: '1440px',
    maxWidthWide: '1600px',
    maxWidthText: '760px',
    gutter: 'clamp(20px, 4.6vw, 72px)',
    sectionPad: 'clamp(68px, 8vw, 140px)',
    sectionPadTight: 'clamp(52px, 6vw, 96px)',
    radius: '2px',
    navHeight: '76px',
  },

  motion: {
    // Expo-out: fast start, long settle — the "cinematic" feel.
    ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fast: '0.22s',
    base: '0.5s',
    slow: '0.9s',
  },

  z: {
    nav: 900,
    menu: 950,
    cursor: 1000,
  },
} as const;

export type AppTheme = typeof theme;
