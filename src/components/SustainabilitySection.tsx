'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { m, Reveal, RevealLines, RevealMedia, useParallax } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede } from './ui';
import { iconFor } from './CapabilityIcons';
import { sustainability } from '@/data/siteData';

/**
 * Deliberately calm: brand palette only, no eco iconography, one large
 * photograph and three short statements.
 */

const Wrap = styled(Section)`
  overflow: hidden;
`;

const Head = styled.div`
  display: grid;
  gap: clamp(24px, 3.4vw, 56px);
  align-items: end;
  margin-bottom: clamp(38px, 5vw, 68px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  }
`;

const Heading = styled.h2`
  margin-top: clamp(22px, 2.6vw, 36px);
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: ${({ theme }) => theme.colors.navy};
  max-width: 14ch;
`;

/** Image runs to the right edge of the viewport on wide screens. */
const MediaBleed = styled.div`
  position: relative;
  margin-left: calc(-1 * ${({ theme }) => theme.layout.gutter});
  margin-right: calc(-1 * ${({ theme }) => theme.layout.gutter});

  @media (min-width: 1200px) {
    margin-left: 0;
    margin-right: calc(50% - 50vw);
  }
`;

const MediaFrame = styled.div`
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.navyMuted};

  @media (min-width: 900px) {
    aspect-ratio: 21 / 8;
  }

  img {
    object-fit: cover;
  }
`;

const MediaInner = styled(m.div)`
  position: absolute;
  inset: -8% 0;
  will-change: transform;
`;

const Areas = styled.div`
  margin-top: clamp(44px, 6vw, 80px);
  display: grid;
  gap: 0;

  @media (min-width: 820px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    column-gap: clamp(28px, 3.4vw, 64px);
  }
`;

const Area = styled.div`
  position: relative;
  padding: clamp(22px, 2.6vw, 32px) 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};

  .idx {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }

  .mark {
    display: block;
    margin-top: 16px;
    color: ${({ theme }) => theme.colors.orangeOnLight};
  }
  h3 {
    margin-top: 14px;
    font-size: ${({ theme }) => theme.type.h3};
    font-weight: 500;
    letter-spacing: -0.004em;
    color: ${({ theme }) => theme.colors.navy};
  }
  p {
    margin-top: 12px;
    font-size: 15.5px;
    line-height: 1.62;
    color: ${({ theme }) => theme.colors.bodyOnLight};
    max-width: 34ch;
  }
`;

export default function SustainabilitySection() {
  const mediaRef = useRef<HTMLDivElement>(null);
  const y = useParallax(mediaRef, 40);

  return (
    <Wrap id="sustainability" $bg="light">
      <Container $wide>
        <Head>
          <div>
            <Reveal>
              <SectionLabel $onDark={false}>
                <b>08</b> {sustainability.eyebrow}
              </SectionLabel>
            </Reveal>
            <Heading>
              <RevealLines
                lines={['Moving toward a more', 'responsible future.']}
                stagger={0.1}
              />
            </Heading>
          </div>

          <Reveal delay={0.12}>
            <Lede $onDark={false}>{sustainability.body}</Lede>
          </Reveal>
        </Head>

        <MediaBleed>
          <RevealMedia>
            <MediaFrame ref={mediaRef}>
              <MediaInner style={{ y }}>
                <Image
                  src={sustainability.image}
                  alt="A vessel under way on open ocean at sunset"
                  fill
                  sizes="100vw"
                  style={{ objectFit: 'cover' }}
                />
              </MediaInner>
            </MediaFrame>
          </RevealMedia>
        </MediaBleed>

        <Areas>
          {sustainability.areas.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.08}>
              <Area>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="mark" aria-hidden="true">
                  {React.createElement(iconFor(a.title), { size: 32 })}
                </span>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </Area>
            </Reveal>
          ))}
        </Areas>
      </Container>
    </Wrap>
  );
}
