'use client';

import React from 'react';
import styled from 'styled-components';
import { Reveal, RevealLines } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede, Meta, ArrowLink } from './ui';
import { ArrowRight } from './icons';
import { leadership } from '@/data/siteData';

/**
 * No names or biographies have been supplied yet, so the section presents
 * deliberate, numbered profile slots rather than invented people or stock
 * portraits. The layout is built to take real profiles without redesign.
 */

const Wrap = styled(Section)``;

const Head = styled.div`
  display: grid;
  gap: clamp(24px, 3.4vw, 56px);
  align-items: end;
  margin-bottom: clamp(38px, 5vw, 68px);

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
`;

const Slots = styled.div`
  display: grid;
  gap: 0;

  @media (min-width: 680px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(26px, 3vw, 56px);
  }
  @media (min-width: 1100px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Slot = styled.div`
  padding-top: clamp(20px, 2.4vw, 28px);
  padding-bottom: clamp(24px, 3vw, 36px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};

  .idx {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

/** Empty portrait field — a thin frame with a diagonal, never a stock face. */
const Portrait = styled.div`
  position: relative;
  margin-top: 16px;
  aspect-ratio: 4 / 5;
  border: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.022) 0 10px,
      transparent 10px 20px
    );
`;

const SlotMeta = styled.div`
  margin-top: 18px;

  .role {
    display: block;
    font-size: 15.5px;
    font-weight: 500;
    letter-spacing: -0.005em;
    color: rgba(255, 255, 255, 0.9);
  }
  .note {
    display: block;
    margin-top: 8px;
  }
`;

const Foot = styled.div`
  margin-top: clamp(30px, 4vw, 52px);
  padding-top: clamp(22px, 2.6vw, 32px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
`;

export default function LeadershipSection() {
  return (
    <Wrap id="leadership" $bg="navy">
      <Container $wide>
        <Head>
          <div>
            <Reveal>
              <SectionLabel>
                <b>09</b> {leadership.eyebrow}
              </SectionLabel>
            </Reveal>
            <Heading>
              <RevealLines lines={['Leadership.']} />
            </Heading>
          </div>

          <Reveal delay={0.12}>
            <Lede>{leadership.body}</Lede>
          </Reveal>
        </Head>

        <Slots>
          {leadership.members.map((_, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <Slot>
                <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                <Portrait aria-hidden="true" />
                <SlotMeta>
                  <span className="role">Profile to be published</span>
                  <Meta className="note">Name · Designation</Meta>
                </SlotMeta>
              </Slot>
            </Reveal>
          ))}
        </Slots>

        <Reveal>
          <Foot>
            <ArrowLink href="#contact">
              Request an introduction
              <ArrowRight size={16} />
            </ArrowLink>
          </Foot>
        </Reveal>
      </Container>
    </Wrap>
  );
}
