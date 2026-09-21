'use client';

import React from 'react';
import styled from 'styled-components';
import { Reveal, RevealLines, DrawLine } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede, FlowLine } from './ui';
import { DIVISION_ICONS, Node } from './CapabilityIcons';
import { model } from '@/data/siteData';

/**
 * The operating model as a technical process diagram: four numbered stages on a
 * single drawn axis. Horizontal on desktop, vertical on mobile.
 */

const Wrap = styled(Section)`
  overflow: hidden;
`;

const Head = styled.div`
  display: grid;
  gap: clamp(24px, 3vw, 48px);
  align-items: end;
  margin-bottom: clamp(48px, 7vw, 92px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }
`;

const Heading = styled.h2`
  margin-top: clamp(22px, 2.6vw, 34px);
  font-size: ${({ theme }) => theme.type.h2};
  font-weight: 300;
  line-height: 1.04;
  letter-spacing: -0.014em;
  color: ${({ theme }) => theme.colors.navy};
  max-width: 14ch;
`;

const Chain = styled.div`
  padding: 18px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  margin-bottom: clamp(36px, 5vw, 64px);
`;

const Track = styled.div`
  position: relative;
  display: grid;
  gap: 0;

  @media (min-width: 900px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(20px, 2.4vw, 44px);
  }
`;

/** The drawn axis the stages hang from. */
const Axis = styled.div`
  position: absolute;
  left: 0;
  top: 5px;
  width: 100%;
  display: none;
  color: ${({ theme }) => theme.colors.lineOnLight};

  @media (min-width: 900px) {
    display: block;
  }
`;

const Step = styled.div`
  position: relative;
  padding-top: clamp(22px, 2.4vw, 34px);
  padding-bottom: clamp(26px, 2.6vw, 12px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};

  @media (min-width: 900px) {
    border-top: 0;
  }

  /* Node on the axis. */
  &::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    width: 9px;
    height: 9px;
    background: ${({ theme }) => theme.colors.orange};
    display: none;
  }
  @media (min-width: 900px) {
    &::before {
      display: block;
    }
  }

  .no {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11.5px;
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
    margin-top: 12px;
    font-size: ${({ theme }) => theme.type.h3};
    font-weight: 500;
    letter-spacing: -0.004em;
    color: ${({ theme }) => theme.colors.navy};
  }

  .q {
    margin-top: 10px;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.45;
    color: ${({ theme }) => theme.colors.navy};
  }

  p.body {
    margin-top: 10px;
    font-size: 15px;
    line-height: 1.62;
    color: ${({ theme }) => theme.colors.bodyOnLight};
  }
`;

const Closing = styled.p`
  margin-top: clamp(44px, 6vw, 80px);
  padding-top: clamp(24px, 3vw, 36px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(20px, 2.6vw, 34px);
  font-weight: 500;
  line-height: 1.22;
  letter-spacing: -0.004em;
  color: ${({ theme }) => theme.colors.navy};
  max-width: 24ch;
`;

function Flowchart({ value }: { value: string }) {
  const parts = value.split('→').map((p) => p.trim());
  return (
    <FlowLine $onDark={false}>
      {parts.map((p, i) => (
        <React.Fragment key={p + i}>
          {i > 0 && (
            <span className="sep" aria-hidden="true">
              →
            </span>
          )}
          <span>{p}</span>
        </React.Fragment>
      ))}
    </FlowLine>
  );
}

export default function ModelSection() {
  return (
    <Wrap id="model" $bg="light">
      <Container $wide>
        <Head>
          <div>
            <Reveal>
              <SectionLabel $onDark={false}>
                <b>03</b> {model.eyebrow}
              </SectionLabel>
            </Reveal>
            <Heading>
              <RevealLines lines={['From intelligence', 'to execution.']} stagger={0.1} />
            </Heading>
          </div>
          <Reveal delay={0.12}>
            <Lede $onDark={false}>{model.intro}</Lede>
          </Reveal>
        </Head>

        <Reveal>
          <Chain>
            <Flowchart value={model.flow} />
          </Chain>
        </Reveal>

        <Track>
          <Axis aria-hidden="true">
            <DrawLine delay={0.1} />
          </Axis>

          {model.items.map((it, i) => (
            <Reveal key={it.no} delay={i * 0.1}>
              <Step>
                <span className="no">{it.no}</span>
                <span className="mark" aria-hidden="true">
                  {React.createElement(DIVISION_ICONS[it.title.toLowerCase()] ?? Node, { size: 32 })}
                </span>
                <h3>{it.title}</h3>
                <p className="q">{it.q}</p>
                <p className="body">{it.text}</p>
              </Step>
            </Reveal>
          ))}
        </Track>

        <Reveal>
          <Closing>{model.closing}</Closing>
        </Reveal>
      </Container>
    </Wrap>
  );
}
