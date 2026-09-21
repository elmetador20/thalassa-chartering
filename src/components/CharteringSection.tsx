'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { m, Reveal, RevealLines, useScroll, useTransform, useReducedMotion } from '@/lib/motion';
import { Container, SectionLabel, Body, Meta, TermList, ArrowLink } from './ui';
import RouteLines from './RouteLines';
import { ArrowRight } from './icons';
import { chartering } from '@/data/siteData';

/* ------------------------------------------------------------ full bleed -- */

const Wrap = styled.section`
  position: relative;
  background: ${({ theme }) => theme.colors.navy};
  isolation: isolate;
`;

const Band = styled.div`
  position: relative;
  min-height: clamp(460px, 76svh, 760px);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  isolation: isolate;
`;

const BandMedia = styled(m.div)`
  position: absolute;
  inset: -8% 0;
  z-index: -2;
  will-change: transform;

  img {
    object-fit: cover;
  }
`;

const BandScrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(to top, rgba(0, 34, 64, 0.96) 6%, rgba(0, 34, 64, 0.6) 46%, rgba(0, 51, 102, 0.3) 100%),
    linear-gradient(90deg, rgba(0, 34, 64, 0.74) 0%, rgba(0, 34, 64, 0) 62%);
`;

const Routes = styled(RouteLines)`
  z-index: -1;
  opacity: 0.72;
`;

const BandInner = styled(Container)`
  position: relative;
  z-index: 1;
  padding-block: clamp(44px, 7vw, 86px);
`;

const Heading = styled.h2`
  margin-top: clamp(20px, 2.6vw, 34px);
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: #fff;
  max-width: 15ch;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.orange};
  }
`;

const BandBody = styled(Body)`
  margin-top: clamp(18px, 2.2vw, 26px);
  max-width: 48ch;
  color: rgba(255, 255, 255, 0.82);
`;

/* Technical read-out strip across the base of the image band. */
const Readout = styled.div`
  position: relative;
  z-index: 1;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  background: rgba(0, 34, 64, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
`;

const ReadoutInner = styled(Container)`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (min-width: 860px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Cell = styled.div`
  padding: clamp(16px, 2vw, 24px) clamp(14px, 2vw, 28px) clamp(16px, 2vw, 24px) 0;
  border-left: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  padding-left: clamp(14px, 2vw, 26px);

  &:first-child {
    border-left: 0;
    padding-left: 0;
  }
  @media (max-width: 859px) {
    &:nth-child(3) {
      border-left: 0;
      padding-left: 0;
    }
    &:nth-child(-n + 2) {
      border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
    }
  }

  .k {
    display: block;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
  }
  .v {
    display: block;
    margin-top: 8px;
    font-size: clamp(15px, 1.5vw, 19px);
    font-weight: 500;
    letter-spacing: -0.005em;
    color: #fff;
  }
  .v b {
    color: ${({ theme }) => theme.colors.orangeOnDark};
    font-weight: 500;
  }
`;

/* ------------------------------------------------------------- listings -- */

const Lists = styled(Container)`
  padding-block: clamp(56px, 8vw, 116px);
  display: grid;
  gap: clamp(32px, 4vw, 64px);

  @media (min-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const ListBlock = styled.div`
  h3 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.orangeOnDark};
    margin-bottom: 18px;
  }
`;

const Coverage = styled(Container)`
  padding-bottom: clamp(56px, 8vw, 110px);

  .inner {
    padding-top: clamp(26px, 3vw, 40px);
    border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  }

  h3 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
    margin-bottom: 20px;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 0;
  }
  li {
    display: flex;
    align-items: center;
    font-size: clamp(15px, 1.7vw, 21px);
    font-weight: 500;
    letter-spacing: -0.005em;
    color: #fff;
  }
  li + li::before {
    content: '';
    width: 4px;
    height: 4px;
    margin: 0 clamp(12px, 1.6vw, 22px);
    background: ${({ theme }) => theme.colors.orange};
    flex: none;
  }
`;

/* --------------------------------------------------------------- voyage -- */

const Voyage = styled.div`
  background: ${({ theme }) => theme.colors.navyDeep};
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
`;

const VoyageInner = styled(Container)`
  padding-block: clamp(56px, 8vw, 116px);
  display: grid;
  gap: clamp(30px, 4vw, 68px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  }
`;

const VoyageHeading = styled.h3`
  font-size: ${({ theme }) => theme.type.h2};
  font-weight: 300;
  line-height: 1.04;
  letter-spacing: -0.014em;
  color: #fff;
  max-width: 13ch;
`;

/** Stepped rail: FIXTURE → VOYAGE → PORT CALL → … */
const Rail = styled.ol`
  margin-top: clamp(28px, 3.4vw, 44px);
  display: grid;
  gap: 0;
  counter-reset: step;

  li {
    position: relative;
    padding: 12px 0 12px 30px;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: clamp(11px, 1.05vw, 13px);
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.86);
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }
  li:first-child {
    border-top: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }

  /* Connector line + node. */
  li::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: ${({ theme }) => theme.colors.lineOnDark};
  }
  li::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    width: 7px;
    height: 7px;
    background: ${({ theme }) => theme.colors.orange};
  }
  li:first-child::before {
    top: 50%;
  }
  li:last-child::before {
    bottom: 50%;
  }
`;

export default function CharteringSection() {
  const bandRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: bandRef,
    offset: ['start end', 'end start'],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-5%', '5%']);

  const voyageSteps = chartering.voyage.flow.split('→').map((s) => s.trim());

  return (
    <Wrap id="chartering">
      <Band ref={bandRef}>
        <BandMedia style={{ y: mediaY }}>
          <Image
            src="/images/service-shipping.jpg"
            alt="Container vessel under way in open water, seen from the air"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </BandMedia>
        <BandScrim />
        <Routes />

        <BandInner $wide>
          <Reveal>
            <SectionLabel>
              <b>04</b> {chartering.eyebrow}
            </SectionLabel>
          </Reveal>
          <Heading>
            <RevealLines lines={['Connecting cargo', <>with capacity<em>.</em></>]} stagger={0.1} />
          </Heading>
          <Reveal delay={0.15}>
            <BandBody>{chartering.body}</BandBody>
          </Reveal>
        </BandInner>
      </Band>

      <Readout>
        <ReadoutInner $wide>
          <Cell>
            <span className="k">Charter structures</span>
            <span className="v">
              <b>{chartering.structures.length}</b> formats
            </span>
          </Cell>
          <Cell>
            <span className="k">Cargo segments</span>
            <span className="v">
              <b>{chartering.cargo.length}</b> segments
            </span>
          </Cell>
          <Cell>
            <span className="k">Market</span>
            <span className="v">Dry bulk</span>
          </Cell>
          <Cell>
            <span className="k">Geographic coverage</span>
            <span className="v">
              <b>{chartering.coverage.split('•').length}</b> regions
            </span>
          </Cell>
        </ReadoutInner>
      </Readout>

      <Lists $wide>
        <Reveal>
          <ListBlock>
            <h3>{chartering.structuresHeading}</h3>
            <TermList $cols={1}>
              {chartering.structures.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </TermList>
          </ListBlock>
        </Reveal>

        <Reveal delay={0.1}>
          <ListBlock>
            <h3>{chartering.cargoHeading}</h3>
            <TermList $cols={1}>
              {chartering.cargo.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </TermList>
          </ListBlock>
        </Reveal>
      </Lists>

      <Coverage $wide>
        <Reveal>
          <div className="inner">
            <h3>{chartering.coverageHeading}</h3>
            <ul>
              {chartering.coverage.split('•').map((c) => (
                <li key={c}>{c.trim()}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Coverage>

      <Voyage>
        <VoyageInner $wide>
          <div>
            <Reveal>
              <Meta>Post-fixture</Meta>
            </Reveal>
            <VoyageHeading>
              <RevealLines lines={['From fixture', 'to discharge.']} stagger={0.1} />
            </VoyageHeading>
            <Reveal delay={0.12}>
              <Body style={{ marginTop: 20, maxWidth: '44ch' }}>{chartering.voyage.body}</Body>
              <div style={{ marginTop: 30 }}>
                <ArrowLink href="#contact">
                  Talk to our chartering desk
                  <ArrowRight size={16} />
                </ArrowLink>
              </div>
            </Reveal>

            <Reveal delay={0.16}>
              <Rail>
                {voyageSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </Rail>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <ListBlock>
              <h3>Operational capabilities</h3>
              <TermList $cols={2}>
                {chartering.voyage.capabilities.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </TermList>
            </ListBlock>
          </Reveal>
        </VoyageInner>
      </Voyage>
    </Wrap>
  );
}
