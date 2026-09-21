'use client';

// ============================================================================
// Shared motion primitives.
//
// Entrances are CSS transitions driven by a single `data-shown` attribute, not
// a JavaScript animation loop. That matters here: a JS-driven entrance that
// never receives a frame (page restored from a background tab, a stalled loop
// on a slow device) leaves content permanently invisible, and this site
// animates in almost everything. A CSS transition either runs or lands on its
// end state — it cannot strand content.
//
// framer-motion is kept for what it is genuinely good at: scroll-linked values
// (parallax, the hero's exit) and the menu's enter/exit transition.
// ============================================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import {
  m,
  useReducedMotion,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from 'framer-motion';

/** Expo-out — matches theme.motion.ease. */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)';

/* ------------------------------------------------------------- in view -- */

/**
 * One shared, throttled scroll watcher drives every reveal on the page.
 *
 * Not IntersectionObserver: several reveals start clipped or scaled to zero,
 * and an element hiding itself reports zero intersection — it would never
 * un-hide. A rect test against the scroll position has no such failure mode.
 *
 * Elements drop out of the registry as soon as they fire, so the work shrinks
 * to nothing as the visitor moves down the page.
 */
type Pending = { el: Element; reveal: () => void };

const pending = new Set<Pending>();
let lastRun = 0;
let timer = 0;
let listening = false;

const THROTTLE_MS = 100;

function flush() {
  lastRun = Date.now();
  const trigger = window.innerHeight * 0.88;
  pending.forEach((item) => {
    // Fires as the element rises past 88% of the viewport — and immediately for
    // anything already above it (deep link, restored scroll, fast fling).
    if (item.el.getBoundingClientRect().top < trigger) {
      pending.delete(item);
      item.reveal();
    }
  });
  if (pending.size === 0) stopWatching();
}

/**
 * Throttled on a timer rather than requestAnimationFrame. rAF only fires on
 * rendered frames, so a throttled or non-painting tab can starve it
 * indefinitely and leave every reveal stuck; scroll events and timers keep
 * arriving either way.
 */
function schedule() {
  if (Date.now() - lastRun >= THROTTLE_MS) {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    flush();
    return;
  }
  if (timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    flush();
  }, THROTTLE_MS);
}

function startWatching() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  // A tab restored from the background, or a back-navigation served from the
  // bfcache, resumes mid-page with no scroll event to follow.
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pageshow', schedule);
}

function stopWatching() {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  document.removeEventListener('visibilitychange', schedule);
  window.removeEventListener('pageshow', schedule);
  if (timer) {
    window.clearTimeout(timer);
    timer = 0;
  }
}

/** True once the element has scrolled into view. Never reverts. */
export function useInViewOnce(ref: React.RefObject<Element>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const item: Pending = { el, reveal: () => setInView(true) };
    pending.add(item);
    startWatching();
    schedule();

    return () => {
      pending.delete(item);
      if (pending.size === 0) stopWatching();
    };
  }, [ref, inView]);

  return inView;
}

/* ------------------------------------------------------------- reveals -- */

/** Fade + rise. The transition lives in CSS; only the trigger is JavaScript. */
const RevealBox = styled.div<{ $y: number; $delay: number }>`
  opacity: 0;
  transform: translate3d(0, ${({ $y }) => $y}px, 0);
  transition:
    opacity 0.8s ${EASE_CSS} ${({ $delay }) => $delay}s,
    transform 0.8s ${EASE_CSS} ${({ $delay }) => $delay}s;

  &[data-shown='true'] {
    opacity: 1;
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transform: none;
    transition: none;
  }
`;

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: React.ElementType;
  id?: string;
};

export function Reveal({ children, delay = 0, y = 26, className, as = 'div', id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref);

  return (
    <RevealBox
      ref={ref}
      as={as}
      id={id}
      className={className}
      data-shown={inView}
      $y={y}
      $delay={delay}
    >
      {children}
    </RevealBox>
  );
}

/**
 * Headline reveal: each line rises out from behind a mask.
 * `lines` keeps the break points with the caller so headlines never split
 * awkwardly on small screens.
 */
const LineMask = styled.span`
  display: block;
  overflow: hidden;
  padding-bottom: 0.06em;
`;

const LineInner = styled.span<{ $delay: number }>`
  display: block;
  transform: translate3d(0, 110%, 0);
  transition: transform 1s ${EASE_CSS} ${({ $delay }) => $delay}s;
  will-change: transform;

  [data-shown='true'] > & {
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`;

export function RevealLines({
  lines,
  delay = 0,
  stagger = 0.1,
  className,
}: {
  lines: React.ReactNode[];
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInViewOnce(ref);

  return (
    <span ref={ref} className={className} style={{ display: 'block' }}>
      {lines.map((line, i) => (
        <LineMask key={i} data-shown={inView}>
          <LineInner $delay={delay + i * stagger}>{line}</LineInner>
        </LineMask>
      ))}
    </span>
  );
}

/**
 * Image reveal: the frame wipes open from the bottom while the picture inside
 * settles back from a slight scale — the standard editorial photo entrance.
 * The observed node stays unclipped so it can always be seen coming.
 */
const MediaClip = styled.div<{ $delay: number }>`
  position: relative;
  overflow: hidden;
  clip-path: inset(0 0 100% 0);
  transition: clip-path 1.15s ${EASE_CSS} ${({ $delay }) => $delay}s;

  [data-shown='true'] > & {
    clip-path: inset(0 0 0% 0);
  }

  @media (prefers-reduced-motion: reduce) {
    clip-path: none;
    transition: none;
  }
`;

const MediaScale = styled.div<{ $delay: number }>`
  height: 100%;
  transform: scale(1.16);
  transition: transform 1.5s ${EASE_CSS} ${({ $delay }) => $delay}s;

  [data-shown='true'] & {
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`;

export function RevealMedia({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref);

  return (
    <div ref={ref} className={className} data-shown={inView}>
      <MediaClip $delay={delay}>
        <MediaScale $delay={delay}>{children}</MediaScale>
      </MediaClip>
    </div>
  );
}

/** A thin rule that draws itself when scrolled into view. */
const LineTrack = styled.span<{ $vertical: boolean }>`
  display: block;
  ${({ $vertical }) =>
    $vertical
      ? css`
          width: 1px;
          height: 100%;
        `
      : css`
          height: 1px;
          width: 100%;
        `}
`;

const LineFill = styled.span<{ $vertical: boolean; $delay: number; $color?: string }>`
  display: block;
  width: 100%;
  height: 100%;
  background: ${({ $color }) => $color ?? 'currentColor'};
  transform-origin: ${({ $vertical }) => ($vertical ? 'top' : 'left')};
  transform: ${({ $vertical }) => ($vertical ? 'scaleY(0)' : 'scaleX(0)')};
  transition: transform 1.1s ${EASE_CSS} ${({ $delay }) => $delay}s;

  [data-shown='true'] > & {
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`;

export function DrawLine({
  className,
  delay = 0,
  color,
  vertical = false,
}: {
  className?: string;
  delay?: number;
  color?: string;
  vertical?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInViewOnce(ref);

  return (
    <LineTrack
      ref={ref}
      className={className}
      aria-hidden="true"
      data-shown={inView}
      $vertical={vertical}
    >
      <LineFill $vertical={vertical} $delay={delay} $color={color} />
    </LineTrack>
  );
}

/** useLayoutEffect on the client, useEffect on the server (no SSR warning). */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Count-up for figures.
 *
 * Renders the real figure on the server and drops to zero before the first
 * client paint, so search engines and no-JS visitors see "12,500", never "0".
 * The roll itself is driven off the wall clock rather than a frame count, so
 * dropped frames shorten it instead of stalling the number.
 */
export function Counter({
  to,
  duration = 1.6,
  decimals = 0,
}: {
  to: number;
  duration?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInViewOnce(ref);
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);

  useIsomorphicLayoutEffect(() => {
    if (!inView) setValue(0);
    // Only on mount: after that the roll owns the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const ms = duration * 1000;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3); // cubic-out
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // If frames never arrive, land on the real figure anyway.
    const safety = window.setTimeout(() => setValue(to), ms + 600);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
  }, [inView, to, duration, reduce]);

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return <span ref={ref}>{formatted}</span>;
}

/* ------------------------------------------------------- scroll-linked -- */

/**
 * Scroll-linked parallax for a target element.
 * Returns a spring-smoothed MotionValue in px — always pass it to a `style`
 * prop on an `m.*` element so it never triggers React re-renders.
 */
export function useParallax(
  ref: React.RefObject<HTMLElement>,
  distance = 80,
  offset: [string, string] = ['start end', 'end start']
): MotionValue<number> {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as never });
  const raw = useTransform(
    scrollYProgress,
    [0, 1],
    [reduce ? 0 : -distance, reduce ? 0 : distance]
  );
  return useSpring(raw, { stiffness: 90, damping: 24, mass: 0.4 });
}

export { m, useReducedMotion, useScroll, useTransform, useSpring };
