'use client';

// ============================================================================
// Editorial layout primitives. Deliberately sparse: thin rules, sharp corners,
// full-bleed sections. No rounded cards, no drop shadows, no boxed containers.
// ============================================================================

import styled, { css } from 'styled-components';

/* ---------------------------------------------------------------- layout -- */

export const Container = styled.div<{ $wide?: boolean; $text?: boolean }>`
  width: 100%;
  margin-inline: auto;
  padding-inline: ${({ theme }) => theme.layout.gutter};
  max-width: ${({ theme, $wide, $text }) =>
    $text ? theme.layout.maxWidthText : $wide ? theme.layout.maxWidthWide : theme.layout.maxWidth};
`;

type Bg = 'deep' | 'navy' | 'muted' | 'light' | 'white' | 'none';

const bgMap: Record<Bg, ReturnType<typeof css>> = {
  deep: css`
    background: ${({ theme }) => theme.colors.navyDeep};
    color: ${({ theme }) => theme.colors.textOnDark};
  `,
  navy: css`
    background: ${({ theme }) => theme.colors.navy};
    color: ${({ theme }) => theme.colors.textOnDark};
  `,
  muted: css`
    background: ${({ theme }) => theme.colors.navyMuted};
    color: ${({ theme }) => theme.colors.textOnDark};
  `,
  light: css`
    background: ${({ theme }) => theme.colors.offWhite};
    color: ${({ theme }) => theme.colors.textOnLight};
  `,
  white: css`
    background: ${({ theme }) => theme.colors.white};
    color: ${({ theme }) => theme.colors.textOnLight};
  `,
  none: css``,
};

export const Section = styled.section<{ $bg?: Bg; $pad?: 'default' | 'tight' | 'none' }>`
  position: relative;
  isolation: isolate;
  ${({ $bg = 'deep' }) => bgMap[$bg]}
  padding-block: ${({ theme, $pad = 'default' }) =>
    $pad === 'none' ? '0' : $pad === 'tight' ? theme.layout.sectionPadTight : theme.layout.sectionPad};
`;

/** 12 columns on desktop, 4 on mobile — the editorial grid. */
export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(20px, 2.4vw, 34px);

  @media (min-width: 900px) {
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }
`;

export const Col = styled.div<{ $span?: number; $start?: number; $spanSm?: number }>`
  grid-column: span ${({ $spanSm = 4 }) => $spanSm};
  min-width: 0;

  @media (min-width: 900px) {
    grid-column: ${({ $span = 12, $start }) =>
      $start ? `${$start} / span ${$span}` : `span ${$span}`};
  }
`;

/* ------------------------------------------------------------ typography -- */

/**
 * Section marker: "01 — Who we are".
 *
 * Set in the body face at a readable size rather than micro-mono: uppercase,
 * medium weight, accent-coloured — the way established consultancies title
 * their sections.
 */
export const SectionLabel = styled.p<{ $onDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: ${({ theme }) => theme.type.label};
  font-weight: 500;
  letter-spacing: 0.06em;
  line-height: 1.2;
  text-transform: uppercase;
  color: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.orangeOnDark : theme.colors.orangeOnLight};

  b {
    font-weight: 500;
    color: ${({ theme, $onDark = true }) =>
      $onDark ? theme.colors.steel : theme.colors.mutedOnLight};
    font-variant-numeric: tabular-nums;
  }

  &::after {
    content: '';
    flex: 1;
    max-width: 96px;
    height: 1px;
    background: ${({ theme, $onDark = true }) =>
      $onDark ? theme.colors.lineOnDark : theme.colors.lineOnLight};
  }
`;

/**
 * Sub-section title inside a panel — same voice as SectionLabel, one step down.
 */
export const SubLabel = styled.h4<{ $onDark?: boolean }>`
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: clamp(13px, 0.3vw + 12px, 15px);
  font-weight: 500;
  letter-spacing: 0.06em;
  line-height: 1.2;
  text-transform: uppercase;
  color: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.orangeOnDark : theme.colors.orangeOnLight};
`;

/** Large editorial headline. */
export const Display = styled.h2<{ $size?: 'display' | 'h1' | 'h2' | 'h3' }>`
  font-size: ${({ theme, $size = 'h2' }) => theme.type[$size]};
  font-weight: 500;
  line-height: ${({ $size = 'h2' }) => ($size === 'h3' ? 1.16 : 1.03)};
  letter-spacing: ${({ $size = 'h2' }) => ($size === 'h3' ? '-0.015em' : '-0.028em')};

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.orange};
  }
`;

export const Lede = styled.p<{ $onDark?: boolean }>`
  font-size: ${({ theme }) => theme.type.bodyLg};
  line-height: 1.55;
  color: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.bodyOnDark : theme.colors.bodyOnLight};
`;

export const Body = styled.p<{ $onDark?: boolean }>`
  font-size: ${({ theme }) => theme.type.body};
  line-height: 1.68;
  color: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.bodyOnDark : theme.colors.bodyOnLight};
`;

/** Mono micro-label used for coordinates, flows and data captions. */
export const Meta = styled.span<{ $onDark?: boolean }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.type.small};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.mutedOnDark : theme.colors.mutedOnLight};
`;

export const Rule = styled.hr<{ $onDark?: boolean }>`
  border: 0;
  height: 1px;
  margin: 0;
  background: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.lineOnDark : theme.colors.lineOnLight};
`;

/* --------------------------------------------------------------- actions -- */

type ButtonVariant = 'primary' | 'onDark' | 'onLight' | 'solidLight';

const buttonVariants: Record<ButtonVariant, ReturnType<typeof css>> = {
  /* Deep navy on the brand orange: keeps the mandated accent while clearing
     WCAG AA, which white-on-orange (3.5:1) does not. */
  primary: css`
    background: ${({ theme }) => theme.colors.orange};
    color: ${({ theme }) => theme.colors.navy};
    border-color: ${({ theme }) => theme.colors.orange};
    &:hover {
      background: ${({ theme }) => theme.colors.orangeHover};
      border-color: ${({ theme }) => theme.colors.orangeHover};
    }
  `,
  onDark: css`
    background: transparent;
    color: #fff;
    border-color: ${({ theme }) => theme.colors.lineOnDark};
    &:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.06);
    }
  `,
  onLight: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.navy};
    border-color: ${({ theme }) => theme.colors.lineOnLight};
    &:hover {
      border-color: ${({ theme }) => theme.colors.navy};
      background: rgba(0, 51, 102, 0.04);
    }
  `,
  solidLight: css`
    background: #fff;
    color: ${({ theme }) => theme.colors.navy};
    border-color: #fff;
    &:hover {
      background: ${({ theme }) => theme.colors.offWhite};
    }
  `,
};

export const Button = styled.button<{ $variant?: ButtonVariant; $block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  min-height: 52px;
  padding: 0 28px;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.layout.radius};
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.005em;
  white-space: nowrap;
  transition:
    background ${({ theme }) => theme.motion.fast} ease,
    border-color ${({ theme }) => theme.motion.fast} ease,
    color ${({ theme }) => theme.motion.fast} ease;
  ${({ $variant = 'primary' }) => buttonVariants[$variant]}

  svg {
    flex-shrink: 0;
    transition: transform 0.35s ${({ theme }) => theme.motion.ease};
  }
  &:hover svg {
    transform: translateX(5px);
  }

  @media (max-width: 420px) {
    padding: 0 22px;
    font-size: 14.5px;
  }
`;

/** Text link with an orange underline that wipes in, plus a moving arrow. */
export const ArrowLink = styled.a<{ $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 11px;
  position: relative;
  padding-bottom: 7px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.005em;
  color: ${({ theme, $onDark = true }) => ($onDark ? '#fff' : theme.colors.navy)};

  &::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: ${({ theme, $onDark = true }) =>
      $onDark ? theme.colors.lineOnDark : theme.colors.lineOnLight};
  }
  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: ${({ theme }) => theme.colors.orange};
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.45s ${({ theme }) => theme.motion.ease};
  }

  svg {
    transition: transform 0.4s ${({ theme }) => theme.motion.ease};
  }
  &:hover::after {
    transform: scaleX(1);
  }
  &:hover svg {
    transform: translateX(6px);
  }
`;

/* ----------------------------------------------------------- decoration -- */

/** Faint engineering-drawing grid used behind dark sections. */
export const TechGrid = styled.div<{ $opacity?: number }>`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: ${({ $opacity = 1 }) => $opacity};
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: clamp(60px, 8vw, 116px) clamp(60px, 8vw, 116px);
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 20%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 20%, transparent 78%);
`;

/** Stacked list of technical terms — replaces icon-and-card grids. */
export const TermList = styled.ul<{ $cols?: number; $onDark?: boolean }>`
  display: grid;
  grid-template-columns: 1fr;
  border-top: 1px solid
    ${({ theme, $onDark = true }) =>
      $onDark ? theme.colors.lineOnDarkSoft : theme.colors.lineOnLightSoft};

  @media (min-width: 640px) {
    grid-template-columns: repeat(${({ $cols = 2 }) => Math.min($cols, 2)}, minmax(0, 1fr));
    column-gap: clamp(24px, 3vw, 48px);
  }
  @media (min-width: 1100px) {
    grid-template-columns: repeat(${({ $cols = 2 }) => $cols}, minmax(0, 1fr));
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 14px 0;
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.45;
    color: ${({ theme, $onDark = true }) =>
      $onDark ? theme.colors.bodyOnDark : theme.colors.bodyOnLight};
    border-bottom: 1px solid
      ${({ theme, $onDark = true }) =>
        $onDark ? theme.colors.lineOnDarkSoft : theme.colors.lineOnLightSoft};
  }

  li::before {
    content: '';
    flex: none;
    width: 5px;
    height: 5px;
    transform: translateY(-3px);
    background: ${({ theme }) => theme.colors.orange};
  }
`;

/** Horizontal process flow: FIXTURE → VOYAGE → PORT CALL … */
export const FlowLine = styled.p<{ $onDark?: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: clamp(10.5px, 1vw, 13px);
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${({ theme, $onDark = true }) =>
    $onDark ? theme.colors.bodyOnDark : theme.colors.bodyOnLight};

  span.sep {
    color: ${({ theme, $onDark = true }) =>
      $onDark ? theme.colors.orangeOnDark : theme.colors.orangeOnLight};
  }
`;
