'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { m, Reveal, RevealLines, useParallax } from '@/lib/motion';
import { Container, Section, SectionLabel, Body, Meta, Rule } from './ui';
import { DIVISION_ICONS, Node } from './CapabilityIcons';
import { about, hero } from '@/data/siteData';

const Wrap = styled(Section)`
  overflow: hidden;
`;

const Top = styled.div`
  display: grid;
  gap: clamp(36px, 5vw, 72px);
  align-items: start;

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
    gap: clamp(48px, 6vw, 110px);
  }
`;

const Heading = styled.h2`
  margin-top: clamp(26px, 3vw, 40px);
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: #fff;
`;

const Intro = styled(Body)`
  margin-top: clamp(24px, 3vw, 36px);
  max-width: 52ch;
`;

/** Full-height media column with a slow parallax drift. */
const Media = styled.figure`
  margin: 0;
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.navyMuted};

  @media (min-width: 1000px) {
    aspect-ratio: 5 / 6;
  }

  img {
    object-fit: cover;
  }

  /* Navy wash keeps photography inside the brand environment. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 34, 64, 0.62), rgba(0, 51, 102, 0.12));
    pointer-events: none;
  }
`;

const MediaInner = styled(m.div)`
  position: absolute;
  inset: -8% 0;
  will-change: transform;
`;

const MediaCaption = styled.figcaption`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  padding: 13px clamp(14px, 1.6vw, 20px);
  background: rgba(0, 34, 64, 0.74);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-top: 1px solid ${({ theme }) => theme.colors.orangeLine};

  .offices {
    color: #fff;
    letter-spacing: 0.1em;
  }
`;

/* The four capability blocks — a technical index, not a card grid. */

const Blocks = styled.div`
  margin-top: clamp(56px, 8vw, 110px);
  display: grid;
  gap: 0;

  @media (min-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(28px, 3.4vw, 56px);
  }
  @media (min-width: 1120px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Block = styled.div`
  position: relative;
  padding: clamp(24px, 2.6vw, 34px) 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};

  .mark {
    display: block;
    margin-top: 18px;
    color: ${({ theme }) => theme.colors.orange};
    transition: color 0.35s ease;
  }

  h3 {
    margin-top: 16px;
    font-size: ${({ theme }) => theme.type.h3};
    font-weight: 500;
    letter-spacing: -0.008em;
    color: #fff;
    transition: color 0.35s ease;
  }

  p {
    margin-top: 12px;
    font-size: 15px;
    line-height: 1.62;
    color: ${({ theme }) => theme.colors.bodyOnDark};
  }

  /* Orange rule that draws across the top on hover. */
  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    width: 100%;
    height: 1px;
    background: ${({ theme }) => theme.colors.orange};
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.6s ${({ theme }) => theme.motion.ease};
  }
  &:hover::before {
    transform: scaleX(1);
  }
  &:hover h3 {
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

const BlockIndex = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: ${({ theme }) => theme.colors.orangeOnDark};
`;

const Principle = styled.div`
  margin-top: clamp(56px, 8vw, 104px);
  display: grid;
  gap: clamp(22px, 3vw, 48px);
  align-items: baseline;

  @media (min-width: 900px) {
    grid-template-columns: minmax(0, 0.3fr) minmax(0, 0.7fr);
  }

  blockquote {
    margin: 0;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: clamp(22px, 2.6vw, 34px);
    font-weight: 500;
    line-height: 1.22;
    letter-spacing: -0.004em;
    color: #fff;
  }
`;

export default function AboutSection() {
  const mediaRef = useRef<HTMLDivElement>(null);
  const y = useParallax(mediaRef, 46);

  return (
    <Wrap id="about" $bg="navy">
      <Container $wide>
        <Top>
          <div>
            <Reveal>
              <SectionLabel>
                <b>01</b> {about.eyebrow}
              </SectionLabel>
            </Reveal>

            <Heading>
              <RevealLines
                lines={['Intelligence.', 'Infrastructure.', 'Technology.']}
                stagger={0.09}
              />
            </Heading>

            <Reveal delay={0.15}>
              <Intro>{about.body}</Intro>
            </Reveal>

            <Reveal delay={0.2}>
              <Principle>
                <Meta>Operating principle</Meta>
                <blockquote>{about.principle}</blockquote>
              </Principle>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Media ref={mediaRef}>
              <MediaInner style={{ y }}>
                <Image
                  src={about.image}
                  alt="Container terminal at sunrise — gantry cranes working a berth"
                  fill
                  sizes="(max-width: 1000px) 100vw, 46vw"
                  style={{ objectFit: 'cover' }}
                />
              </MediaInner>
              <MediaCaption>
                <Meta>Global network</Meta>
                <Meta className="offices">{hero.offices.join(' · ')}</Meta>
              </MediaCaption>
            </Media>
          </Reveal>
        </Top>

        <Blocks>
          {about.blocks.map((b, i) => (
            <Reveal key={b.key} delay={i * 0.07}>
              <Block>
                <BlockIndex>{String(i + 1).padStart(2, '0')}</BlockIndex>
                <span className="mark" aria-hidden="true">
                  {React.createElement(DIVISION_ICONS[b.key] ?? Node, { size: 32 })}
                </span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </Block>
            </Reveal>
          ))}
        </Blocks>

        <Rule style={{ marginTop: 'clamp(40px, 5vw, 72px)', opacity: 0.6 }} />
      </Container>
    </Wrap>
  );
}
