'use client';

import React from 'react';
import styled from 'styled-components';
import { Reveal, RevealLines, Counter, DrawLine } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede, Body, Meta, FlowLine, TechGrid } from './ui';
import { ambition } from '@/data/siteData';

const Wrap = styled(Section)`
  overflow: hidden;
`;

const Top = styled.div`
  display: grid;
  gap: clamp(32px, 4.5vw, 72px);
  align-items: end;

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
`;

const Heading = styled.h2`
  margin-top: clamp(22px, 2.6vw, 36px);
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 300;
  line-height: 1.02;
  letter-spacing: -0.005em;
  color: #fff;
  max-width: 12ch;
`;

/** The ambition figure, set at display scale. */
const FigureBlock = styled.div`
  .val {
    display: block;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: clamp(46px, 8vw, 122px);
    font-weight: 300;
    line-height: 0.9;
    letter-spacing: -0.008em;
    color: #fff;
    font-variant-numeric: tabular-nums;

    i {
      font-style: normal;
      color: ${({ theme }) => theme.colors.orange};
    }
    small {
      display: block;
      margin-top: 0.14em;
      font-size: 0.36em;
      font-weight: 500;
      letter-spacing: -0.008em;
      color: rgba(255, 255, 255, 0.86);
    }
  }
  .lbl {
    display: block;
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  }
`;

const Lead = styled(Lede)`
  margin-top: clamp(34px, 4.5vw, 60px);
  max-width: 62ch;
`;

const AimsWrap = styled.div`
  margin-top: clamp(50px, 7vw, 96px);
`;

const AimsHead = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: clamp(24px, 3vw, 36px);

  h3 {
    flex: none;
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
  .line {
    flex: 1;
    color: ${({ theme }) => theme.colors.lineOnDark};
  }
`;

const Aims = styled.ol`
  display: grid;
  gap: 0;

  @media (min-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(28px, 3.4vw, 64px);
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: clamp(14px, 1.7vw, 20px) 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.86);
  }

  li span {
    flex: none;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

/* -------------------------------------------------------------- mission -- */

const Mission = styled.div`
  margin-top: clamp(56px, 8vw, 110px);
  padding-top: clamp(36px, 4.5vw, 64px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  display: grid;
  gap: clamp(28px, 4vw, 64px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  }

  h3 {
    margin-top: 18px;
    font-size: ${({ theme }) => theme.type.h3};
    font-weight: 500;
    line-height: 1.16;
    letter-spacing: -0.004em;
    color: #fff;
    max-width: 18ch;
  }
`;

/** The mission formula, set as a technical equation. */
const Formula = styled.div`
  padding: clamp(18px, 2.2vw, 26px);
  border: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  background: rgba(255, 255, 255, 0.02);

  ul {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 0;
  }
  li {
    display: flex;
    align-items: center;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: clamp(10.5px, 1vw, 12.5px);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.82);
  }
  li + li::before {
    content: '+';
    margin: 0 clamp(8px, 1vw, 14px);
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

const MissionFlow = styled.div`
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
`;

export default function AmbitionSection() {
  const { mission } = ambition;
  const flowParts = mission.flow.split('→').map((s) => s.trim());

  return (
    <Wrap id="ambition" $bg="navy">
      <TechGrid $opacity={0.5} />
      <Container $wide>
        <Top>
          <div>
            <Reveal>
              <SectionLabel>
                <b>06</b> {ambition.eyebrow}
              </SectionLabel>
            </Reveal>
            <Heading>
              <RevealLines lines={['2030 business', 'ambition.']} stagger={0.1} />
            </Heading>
          </div>

          <Reveal delay={0.12}>
            <FigureBlock>
              <span className="val">
                <i>USD</i> <Counter to={ambition.figureValue} />
                <small>{ambition.figureUnit}</small>
              </span>
              <Meta className="lbl">{ambition.figureLabel}</Meta>
            </FigureBlock>
          </Reveal>
        </Top>

        <Reveal delay={0.08}>
          <Lead>{ambition.lede}</Lead>
        </Reveal>

        <AimsWrap>
          <Reveal>
            <AimsHead>
              <h3>{ambition.aimsHeading}</h3>
              <span className="line">
                <DrawLine />
              </span>
            </AimsHead>
          </Reveal>

          <Aims>
            {ambition.aims.map((aim, i) => (
              <Reveal key={aim} as="li" y={18} delay={(i % 2) * 0.06}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {aim}
              </Reveal>
            ))}
          </Aims>
        </AimsWrap>

        <Mission>
          <div>
            <Reveal>
              <Meta>{mission.eyebrow}</Meta>
              <h3>{mission.heading}</h3>
              <Body style={{ marginTop: 18, maxWidth: '38ch' }}>{mission.body}</Body>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Formula>
              <ul>
                {mission.formula.split('+').map((part) => (
                  <li key={part}>{part.trim()}</li>
                ))}
              </ul>
              <MissionFlow>
                <FlowLine>
                  {flowParts.map((p, i) => (
                    <React.Fragment key={p}>
                      {i > 0 && (
                        <span className="sep" aria-hidden="true">
                          →
                        </span>
                      )}
                      <span>{p}</span>
                    </React.Fragment>
                  ))}
                </FlowLine>
              </MissionFlow>
            </Formula>
          </Reveal>
        </Mission>
      </Container>
    </Wrap>
  );
}
