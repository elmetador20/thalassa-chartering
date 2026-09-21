'use client';

import React, { useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { m, EASE_CSS, useScroll, useTransform, useReducedMotion, RevealLines } from '@/lib/motion';
import { Container, Button, Meta } from './ui';
import { ArrowRight } from './icons';
import HeroBackdrop from './HeroBackdrop';
import { hero } from '@/data/siteData';

/**
 * The hero's entrance is pure CSS. It is the one thing on the page that must
 * never fail to appear, and a keyframe animation always resolves to its end
 * state — unlike a JS-driven animation that can be starved of frames.
 */
const enterUp = keyframes`
  from { opacity: 0; transform: translate3d(0, 20px, 0); }
  to   { opacity: 1; transform: none; }
`;

const enterFade = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const enters = (animation: ReturnType<typeof keyframes>, delay: number, duration = 0.9) => css`
  animation: ${animation} ${duration}s ${EASE_CSS} ${delay}s both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/* ----------------------------------------------------------------- shell -- */

const Wrap = styled.section`
  position: relative;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.navyDeep};

  /* Fallback for browsers without svh support. */
  @supports not (height: 100svh) {
    min-height: 100vh;
  }
`;

/** The media layer scales slowly as the hero leaves — a slow cinematic push. */
const MediaLayer = styled(m.div)`
  position: absolute;
  inset: 0;
  z-index: -3;
  will-change: transform;
`;

/**
 * Two stacked gradients: a horizontal one that anchors the type column, and a
 * vertical one that grounds the base of the frame. Navy, never black.
 */
const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(
      100deg,
      rgba(0, 34, 64, 0.94) 0%,
      rgba(0, 34, 64, 0.86) 28%,
      rgba(0, 51, 102, 0.56) 58%,
      rgba(0, 51, 102, 0.26) 100%
    ),
    linear-gradient(to top, rgba(0, 34, 64, 0.92) 0%, rgba(0, 34, 64, 0) 46%);

  @media (max-width: 900px) {
    background:
      linear-gradient(
        to top,
        rgba(0, 34, 64, 0.96) 12%,
        rgba(0, 34, 64, 0.72) 48%,
        rgba(0, 51, 102, 0.38) 100%
      );
  }
`;

/** Deepens as the hero scrolls away so the next section arrives out of black-navy. */
const ExitScrim = styled(m.div)`
  position: absolute;
  inset: 0;
  z-index: -1;
  background: ${({ theme }) => theme.colors.navyDeep};
  pointer-events: none;
`;

/* ------------------------------------------------------------------ top -- */

const TopStrip = styled(Container)`
  position: relative;
  z-index: 1;
  padding-top: calc(var(--nav-h) + clamp(16px, 3.2vh, 44px));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
`;

const EyebrowStrip = styled.ul`
  ${enters(enterUp, 0.15)}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 0;

  li {
    display: flex;
    align-items: center;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: clamp(9px, 0.85vw, 11.5px);
    font-weight: 500;
    letter-spacing: 0.17em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.76);
    white-space: nowrap;
  }

  li + li::before {
    content: '';
    width: 4px;
    height: 4px;
    margin: 0 clamp(7px, 1.1vw, 16px);
    background: ${({ theme }) => theme.colors.orange};
    flex: none;
  }
`;

/** Small global indicator, top right. Desktop only. */
const GlobalTag = styled.div`
  ${enters(enterFade, 0.5, 1)}
  display: none;

  @media (min-width: 1100px) {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
    padding-left: 22px;
    border-left: 1px solid ${({ theme }) => theme.colors.lineOnDark};

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${({ theme }) => theme.colors.orange};
      box-shadow: 0 0 0 4px rgba(255, 63, 3, 0.18);
    }
  }
`;

/* ----------------------------------------------------------------- body -- */

const Middle = styled(m.div)`
  flex: 1;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  padding-block: clamp(22px, 4.6vh, 88px);
  will-change: transform, opacity;
`;

const Content = styled(Container)`
  max-width: ${({ theme }) => theme.layout.maxWidth};
`;

const Title = styled.h1`
  max-width: 17ch;
  font-size: ${({ theme }) => theme.type.display};
  font-weight: 300;
  line-height: 1.015;
  letter-spacing: -0.016em;
  color: #fff;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.orange};
  }

  @media (min-width: 1500px) {
    max-width: 19ch;
  }
`;

const Body = styled.p`
  ${enters(enterUp, 0.72)}
  margin-top: clamp(18px, 2.6vh, 34px);
  max-width: 54ch;
  font-size: ${({ theme }) => theme.type.bodyLg};
  line-height: 1.55;

  /* Short phones: the paragraph gives up a little size so the CTAs stay up. */
  @media (max-width: 520px) {
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.5;
  }
  color: rgba(255, 255, 255, 0.78);
`;

const Actions = styled.div`
  ${enters(enterUp, 0.86)}
  margin-top: clamp(22px, 3.4vh, 44px);
  display: flex;
  flex-wrap: wrap;
  gap: 14px;

  @media (max-width: 520px) {
    gap: 10px;

    a {
      flex: 1 1 100%;
      min-height: 48px;
    }
  }
`;

/* --------------------------------------------------------------- bottom -- */

const BottomBar = styled.div`
  ${enters(enterFade, 1, 1)}
  position: relative;
  z-index: 1;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
`;

const BottomInner = styled(Container)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 64px;
  padding-block: 14px;

  @media (max-width: 560px) {
    min-height: 52px;
    padding-block: 10px;
  }
`;

const ScrollCue = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 14px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.72);
  transition: color 0.3s ease;

  .full {
    @media (max-width: 560px) {
      display: none;
    }
  }
  .short {
    display: none;
    @media (max-width: 560px) {
      display: inline;
    }
  }

  b {
    font-weight: 500;
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }

  /* Animated track: an orange pulse travelling down a hairline. */
  .track {
    position: relative;
    display: block;
    width: 1px;
    height: 34px;
    background: ${({ theme }) => theme.colors.lineOnDark};
    overflow: hidden;
  }
  .track::after {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 14px;
    background: ${({ theme }) => theme.colors.orange};
    animation: heroScrollCue 2.4s ${({ theme }) => theme.motion.easeInOut} infinite;
  }

  &:hover {
    color: #fff;
  }

  @keyframes heroScrollCue {
    0% {
      transform: translateY(-100%);
    }
    60%,
    100% {
      transform: translateY(340%);
    }
  }

  @media (max-width: 560px) {
    .track {
      height: 26px;
    }
  }
`;

const Offices = styled.ul`
  display: none;

  @media (min-width: 760px) {
    display: flex;
    align-items: center;
    gap: clamp(14px, 1.8vw, 28px);

    li {
      font-family: ${({ theme }) => theme.fonts.mono};
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.6);
    }
  }
`;

const OfficesMobile = styled.span`
  display: none;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  text-align: right;

  /* Small tablets only: phones show the scroll cue on its own. */
  @media (min-width: 560px) and (max-width: 759px) {
    display: block;
  }
`;

/* ------------------------------------------------------------ component -- */

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Scroll-linked exit: media pushes in, copy lifts and fades, navy deepens.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.16]);
  const mediaY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '6%']);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.72], [1, reduce ? 1 : 0]);
  const exitOpacity = useTransform(scrollYProgress, [0.2, 1], [0, reduce ? 0 : 0.72]);

  return (
    <Wrap id="home" ref={ref}>
      <MediaLayer style={{ scale: mediaScale, y: mediaY }}>
        <HeroBackdrop />
      </MediaLayer>
      <Scrim />
      <ExitScrim style={{ opacity: exitOpacity }} />

      <TopStrip $wide>
        <EyebrowStrip>
          {hero.eyebrowItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </EyebrowStrip>

        {/* <GlobalTag>
          <span className="dot" aria-hidden="true" />
          <Meta>Five offices · Global coverage</Meta>
        </GlobalTag> */}
      </TopStrip>

      <Middle style={{ y: copyY, opacity: copyOpacity }}>
        <Content $wide>
          <Title>
            <RevealLines
              delay={0.25}
              stagger={0.12}
              lines={[
                <>
                  Intelligence that moves markets<em>.</em>
                </>,
                <>
                  Execution that moves business<em>.</em>
                </>,
              ]}
            />
          </Title>

          <Body>{hero.body}</Body>

          <Actions>
            <Button as="a" href={hero.primaryCta.href} $variant="primary">
              {hero.primaryCta.label}
              <ArrowRight size={17} />
            </Button>
            <Button as="a" href={hero.secondaryCta.href} $variant="onDark">
              {hero.secondaryCta.label}
            </Button>
          </Actions>
        </Content>
      </Middle>

      <BottomBar>
        <BottomInner $wide>
          <ScrollCue href="#statement">
            <b>01</b>
            <span className="track" aria-hidden="true" />
            <span className="full">{hero.scrollLabel}</span>
            <span className="short">Scroll</span>
          </ScrollCue>

          <Offices aria-label="Office locations">
            {hero.offices.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </Offices>
          <OfficesMobile>{hero.trust}</OfficesMobile>
        </BottomInner>
      </BottomBar>
    </Wrap>
  );
}
