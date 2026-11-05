'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import styled, { css, keyframes } from 'styled-components';
import { m, EASE_CSS, useScroll, useTransform } from '@/lib/motion';
import { Container, Button } from './ui';
import { ArrowRight, Close, Menu } from './icons';
import { nav, hero, contact } from '@/data/siteData';
import { useSiteLinks } from '@/lib/site-links';

/* ------------------------------------------------------------------ bar -- */

const Bar = styled.header<{ $solid: boolean }>`
  position: fixed;
  inset: 0 0 auto;
  z-index: ${({ theme }) => theme.z.nav};
  transition:
    background 0.45s ${({ theme }) => theme.motion.ease},
    border-color 0.45s ease,
    backdrop-filter 0.45s ease;
  border-bottom: 1px solid transparent;

  /* Only while transparent: a soft scrim so the wordmark and links stay
     legible over bright footage (sunsets, open sky). */
  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: calc(var(--nav-h) + 26px);
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(0, 34, 64, 0.62) 0%,
      rgba(0, 34, 64, 0.28) 55%,
      rgba(0, 34, 64, 0) 100%
    );
    opacity: ${({ $solid }) => ($solid ? 0 : 1)};
    transition: opacity 0.45s ease;
  }

  ${({ $solid, theme }) =>
    $solid &&
    css`
      background: rgba(0, 34, 64, 0.86);
      backdrop-filter: blur(14px) saturate(140%);
      -webkit-backdrop-filter: blur(14px) saturate(140%);
      border-bottom-color: ${theme.colors.lineOnDark};
    `}
`;

const Inner = styled(Container)`
  position: relative;
  z-index: 1;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(16px, 3vw, 44px);
`;

const Brand = styled.a`
  display: flex;
  align-items: center;
  flex: none;

  /* The wordmark is 6.9:1, so height drives everything. Roughly 45% of the
     bar height reads as confident without crowding the navigation. */
  img {
    width: auto;
    height: clamp(24px, 2.5vw, 34px);
    object-fit: contain;
  }
`;

const Links = styled.nav`
  display: none;

  @media (min-width: 1060px) {
    display: flex;
    align-items: center;
    gap: clamp(20px, 2.3vw, 38px);
    margin-left: auto;
  }
`;

const NavLink = styled.a<{ $active: boolean }>`
  position: relative;
  padding: 6px 0;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.005em;
  white-space: nowrap;
  color: ${({ $active, theme }) => ($active ? theme.colors.white : 'rgba(255,255,255,0.72)')};
  transition: color 0.25s ease;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: ${({ theme }) => theme.colors.orange};
    transform: scaleX(${({ $active }) => ($active ? 1 : 0)});
    transform-origin: left;
    transition: transform 0.4s ${({ theme }) => theme.motion.ease};
  }

  &:hover {
    color: #fff;
  }
  &:hover::after {
    transform: scaleX(1);
  }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.4vw, 18px);
  flex: none;
  margin-left: auto;

  @media (min-width: 1060px) {
    margin-left: 0;
  }
`;

const CtaButton = styled(Button)`
  min-height: 42px;
  padding: 0 20px;
  font-size: 13.5px;

  @media (max-width: 700px) {
    display: none;
  }
`;

const MenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  padding: 0 14px 0 16px;
  border: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  border-radius: ${({ theme }) => theme.layout.radius};
  color: #fff;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transition: border-color 0.25s ease, background 0.25s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.45);
    background: rgba(255, 255, 255, 0.06);
  }

  span {
    @media (max-width: 520px) {
      display: none;
    }
  }
`;

/** Reading-progress hairline pinned to the bottom edge of the bar. */
const Progress = styled(m.div)`
  position: absolute;
  left: 0;
  bottom: -1px;
  height: 2px;
  width: 100%;
  transform-origin: left;
  background: ${({ theme }) => theme.colors.orange};
`;

/* -------------------------------------------------------------- overlay -- */

const wipeIn = keyframes`
  from { clip-path: inset(0 0 100% 0); }
  to   { clip-path: inset(0 0 0% 0); }
`;

const wipeOut = keyframes`
  from { clip-path: inset(0 0 0% 0); }
  to   { clip-path: inset(0 0 100% 0); }
`;

const itemIn = keyframes`
  from { opacity: 0; transform: translate3d(0, 22px, 0); }
  to   { opacity: 1; transform: none; }
`;

const Overlay = styled.div<{ $closing: boolean }>`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.z.menu};
  background: ${({ theme }) => theme.colors.navyDeep};
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  animation: ${({ $closing }) => ($closing ? wipeOut : wipeIn)} 0.55s ${EASE_CSS} both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const OverlayTop = styled(Container)`
  height: var(--nav-h);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;

  img {
    width: auto;
    height: clamp(24px, 2.5vw, 34px);
  }
`;

const OverlayBody = styled(Container)`
  flex: 1;
  display: grid;
  gap: clamp(36px, 5vw, 64px);
  align-content: center;
  padding-block: clamp(32px, 6vw, 72px);

  @media (min-width: 900px) {
    grid-template-columns: 1.35fr 1fr;
    align-items: start;
    align-content: center;
  }
`;

const MenuGroup = styled.div`
  & + & {
    margin-top: clamp(28px, 3vw, 44px);
  }

  h3 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.orangeOnDark};
    margin-bottom: 18px;
    padding-bottom: 12px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }
`;

const BigLink = styled.a<{ $index: number }>`
  animation: ${itemIn} 0.6s ${EASE_CSS} ${({ $index }) => 0.18 + $index * 0.045}s both;
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: clamp(7px, 0.9vw, 11px) 0;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(25px, 4.4vw, 46px);
  font-weight: 300;
  letter-spacing: -0.004em;
  line-height: 1.1;
  color: rgba(255, 255, 255, 0.92);
  transition: color 0.3s ease, transform 0.5s ${({ theme }) => theme.motion.ease};

  i {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    font-style: normal;
    letter-spacing: 0.1em;
    color: ${({ theme }) => theme.colors.mutedOnDark};
    transition: color 0.3s ease;
  }

  &:hover,
  &:focus-visible {
    color: ${({ theme }) => theme.colors.orangeOnDark};
    transform: translateX(10px);
  }
  &:hover i {
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const OverlayAside = styled.div`
  animation: ${itemIn} 0.7s ${EASE_CSS} 0.34s both;
  display: grid;
  gap: 26px;
  align-content: start;
  padding-top: 6px;

  @media (min-width: 900px) {
    padding-left: clamp(24px, 3vw, 56px);
    border-left: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const AsideBlock = styled.div`
  h4 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
    margin-bottom: 10px;
  }
  p,
  a.val {
    font-size: 15px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.82);
    display: block;
  }
  a.val:hover {
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

/* ----------------------------------------------------------- component -- */

const NAV_IDS = nav.links.map((l) => l.href.replace('#', ''));

// Every top-level section is observed, not just the linked ones, so the
// indicator clears when the visitor is in a section the bar doesn't list.
const WATCHED_IDS = [
  'home',
  'statement',
  'about',
  'capabilities',
  'model',
  'chartering',
  'projects',
  'ambition',
  'global',
  'sustainability',
  'leadership',
  'contact',
];

export default function Navbar() {
  const { pathname, onHome, href } = useSiteLinks();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  // The overlay stays mounted through its CSS wipe-out before unmounting.
  const [closing, setClosing] = useState(false);
  const [active, setActive] = useState<string>('');
  const { scrollYProgress } = useScroll();
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  /* Solidify the bar once the hero is behind it. */
  useEffect(() => {
    // Solidify early on short viewports so content never scrolls under a
    // transparent bar for long.
    const onScroll = () =>
      setSolid(window.scrollY > Math.min(window.innerHeight * 0.16, 90));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Highlight the section currently occupying the middle of the viewport. */
  useEffect(() => {
    const els = WATCHED_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const { id } = e.target;
          setActive(NAV_IDS.includes(id) ? id : '');
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Lock background scroll and wire Escape while the overlay is open. */
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 450);
  }, []);

  const openMenu = useCallback(() => {
    setClosing(false);
    setOpen(true);
  }, []);

  return (
    <>
      <Bar $solid={solid || open || !onHome}>
        <Inner $wide>
          <Brand href={href('#home')} aria-label="INCWORX — home">
            <Image
              src="/images/incworx-logo-reversed.png"
              alt="INCWORX"
              width={1396}
              height={195}
              priority
              sizes="260px"
            />
          </Brand>

          <Links aria-label="Primary">
            {nav.links.map((l) => (
              <NavLink
                key={l.href}
                href={href(l.href)}
                $active={l.href.startsWith('/') ? pathname.startsWith(l.href) : onHome && active === l.href.replace('#', '')}
                aria-current={l.href.startsWith('/') && pathname.startsWith(l.href) ? 'page' : undefined}
              >
                {l.label}
              </NavLink>
            ))}
          </Links>

          <Actions>
            <CtaButton as="a" href={href(nav.cta.href)} $variant="primary">
              {nav.cta.label}
              <ArrowRight size={16} />
            </CtaButton>
            <MenuButton
              type="button"
              onClick={openMenu}
              aria-expanded={open}
              aria-label="Open menu"
            >
              <span>Menu</span>
              <Menu size={18} />
            </MenuButton>
          </Actions>
        </Inner>

        <Progress style={{ scaleX: progressScale }} aria-hidden="true" />
      </Bar>

      {open && (
        <Overlay role="dialog" aria-modal="true" aria-label="Site menu" $closing={closing}>
            <OverlayTop $wide>
              <Image
                src="/images/incworx-logo-reversed.png"
                alt="INCWORX"
                width={1396}
                height={195}
                sizes="260px"
              />
              <MenuButton type="button" onClick={close} aria-label="Close menu">
                <span>Close</span>
                <Close size={18} />
              </MenuButton>
            </OverlayTop>

            <OverlayBody $wide>
              <div>
                {nav.menuGroups.map((group, gi) => (
                  <MenuGroup key={group.heading}>
                    <h3>{group.heading}</h3>
                    {group.links.map((l, i) => (
                      <BigLink
                        key={l.href}
                        href={href(l.href)}
                        onClick={close}
                        $index={gi * group.links.length + i}
                      >
                        <i>{String(i + 1).padStart(2, '0')}</i>
                        {l.label}
                      </BigLink>
                    ))}
                  </MenuGroup>
                ))}
              </div>

              <OverlayAside>
                  <AsideBlock>
                    <h4>Global network</h4>
                    <p>{hero.trust}</p>
                  </AsideBlock>
                  <AsideBlock>
                    <h4>Enquiries</h4>
                    <a className="val" href={`mailto:${contact.info[0].value}`}>
                      {contact.info[0].value}
                    </a>
                    <a className="val" href={`tel:${contact.info[1].value.replace(/\s/g, '')}`}>
                      {contact.info[1].value}
                    </a>
                  </AsideBlock>
                  <AsideBlock>
                    <h4>Head office</h4>
                    <p>{contact.info[2].value}</p>
                  </AsideBlock>
                <Button as="a" href={href(nav.cta.href)} onClick={close} $variant="primary">
                  Start a conversation
                  <ArrowRight size={16} />
                </Button>
              </OverlayAside>
            </OverlayBody>
        </Overlay>
      )}
    </>
  );
}
