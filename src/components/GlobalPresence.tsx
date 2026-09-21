'use client';

import React from 'react';
import styled from 'styled-components';
import dynamic from 'next/dynamic';
import { Reveal, RevealLines } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede, Meta } from './ui';
import { globalPresence as gp, hero } from '@/data/siteData';

// The map carries ~32 KB of baked geographic data. Splitting it out keeps it
// off the critical path; the placeholder reserves the exact box so nothing
// shifts when it arrives.
const WorldMap = dynamic(() => import('./WorldMap'), {
  ssr: false,
  loading: () => <MapPlaceholder aria-hidden="true" />,
});

const Wrap = styled(Section)`
  overflow: hidden;
`;

const Head = styled.div`
  display: grid;
  gap: clamp(24px, 3.4vw, 56px);
  align-items: end;
  margin-bottom: clamp(36px, 5vw, 64px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  }
`;

const Heading = styled.h2`
  margin-top: clamp(22px, 2.6vw, 36px);
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: #fff;
  max-width: 13ch;
`;

/** Matches the map's aspect ratio at each breakpoint so there is no layout shift. */
const MapPlaceholder = styled.div`
  width: 100%;
  aspect-ratio: 540 / 305;

  @media (min-width: 900px) {
    aspect-ratio: 1002 / 440;
  }
`;

const MapShell = styled.div`
  position: relative;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  padding-block: clamp(20px, 3vw, 40px);

`;

const Offices = styled.div`
  margin-top: clamp(32px, 4vw, 56px);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (min-width: 860px) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
`;

const Office = styled.div`
  padding: clamp(18px, 2.2vw, 26px) 0;
  padding-right: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  position: relative;

  .idx {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.18em;
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
  .name {
    display: block;
    margin-top: 10px;
    font-size: clamp(17px, 1.8vw, 22px);
    font-weight: 500;
    letter-spacing: -0.006em;
    color: #fff;
  }
`;

export default function GlobalPresence() {
  return (
    <Wrap id="global" $bg="deep">
      <Container $wide>
        <Head>
          <div>
            <Reveal>
              <SectionLabel>
                <b>07</b> {gp.eyebrow}
              </SectionLabel>
            </Reveal>
            <Heading>
              <RevealLines lines={['Connected to', 'global markets.']} stagger={0.1} />
            </Heading>
          </div>

          <Reveal delay={0.12}>
            <Lede>{gp.body}</Lede>
          </Reveal>
        </Head>

        <Reveal>
          <MapShell>
            <WorldMap />
          </MapShell>
        </Reveal>

        <Offices>
          {hero.offices.map((name, i) => (
            <Reveal key={name} delay={i * 0.06} y={18}>
              <Office>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="name">{name}</span>
              </Office>
            </Reveal>
          ))}
        </Offices>

        <Reveal delay={0.1}>
          <Meta style={{ display: 'block', marginTop: 'clamp(24px, 3vw, 36px)' }}>
            {gp.networkLabel}
          </Meta>
        </Reveal>
      </Container>
    </Wrap>
  );
}
