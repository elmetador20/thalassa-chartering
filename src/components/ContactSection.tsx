'use client';

import React from 'react';
import styled from 'styled-components';
import { Reveal, RevealLines } from '@/lib/motion';
import { Container, Section, SectionLabel, Lede, Body, Button, TechGrid } from './ui';
import { ArrowRight, Mail, MapPin, Phone, Globe } from './icons';
import { contact, contactCta } from '@/data/siteData';

const Wrap = styled(Section)`
  overflow: hidden;
  padding-bottom: 0;
`;

/* ---------------------------------------------------------- closing band -- */

const Closing = styled.div`
  padding-bottom: clamp(56px, 8vw, 110px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDark};
`;

const Statement = styled.p`
  margin-top: clamp(24px, 3vw, 40px);
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(26px, 3.6vw, 48px);
  font-weight: 300;
  line-height: 1.1;
  letter-spacing: -0.014em;
  color: #fff;
  max-width: 21ch;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.orange};
  }
`;

/* -------------------------------------------------------------- contact -- */

const Main = styled.div`
  padding-block: clamp(56px, 8vw, 116px);
  display: grid;
  gap: clamp(34px, 5vw, 80px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
`;

const Heading = styled.h2`
  margin-top: clamp(20px, 2.6vw, 34px);
  font-size: ${({ theme }) => theme.type.display};
  font-weight: 300;
  line-height: 0.98;
  letter-spacing: -0.018em;
  color: #fff;

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.orange};
  }
`;

const Actions = styled.div`
  margin-top: clamp(30px, 4vw, 44px);
  display: flex;
  flex-wrap: wrap;
  gap: 14px;

  @media (max-width: 520px) {
    a {
      flex: 1 1 100%;
    }
  }
`;

const Info = styled.dl`
  margin: 0;
  display: grid;
  gap: 0;
  align-content: start;

  @media (min-width: 1000px) {
    padding-top: clamp(18px, 2.4vw, 34px);
  }
`;

const Row = styled.div`
  padding: clamp(18px, 2.2vw, 26px) 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDark};

  &:first-child {
    border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  }

  dt {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
  }

  dt .ico {
    display: inline-flex;
    color: ${({ theme }) => theme.colors.orange};
  }

  dd {
    margin: 10px 0 0;
    padding-left: 30px;
    font-size: clamp(16px, 1.5vw, 19px);
    font-weight: 500;
    line-height: 1.45;
    letter-spacing: -0.004em;
    color: #fff;
    overflow-wrap: anywhere;
  }

  dd a {
    position: relative;
    display: inline-block;
    transition: color 0.25s ease;
  }
  dd a::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -3px;
    width: 100%;
    height: 1px;
    background: ${({ theme }) => theme.colors.orange};
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.4s ${({ theme }) => theme.motion.ease};
  }
  dd a:hover {
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
  dd a:hover::after {
    transform: scaleX(1);
  }
`;

const ICONS = [Mail, Phone, MapPin, Globe];

/** Email and phone become actionable links; the rest stay as plain text. */
function InfoValue({ label, value }: { label: string; value: string }) {
  if (label === 'Email') return <a href={`mailto:${value}`}>{value}</a>;
  if (label === 'Mobile') return <a href={`tel:${value.replace(/[^\d+]/g, '')}`}>{value}</a>;
  if (label === 'Website')
    return (
      <a href={`https://${value}`} target="_blank" rel="noopener noreferrer">
        {value}
      </a>
    );
  return <>{value}</>;
}

export default function ContactSection() {
  return (
    <Wrap id="contact" $bg="deep">
      <TechGrid $opacity={0.5} />
      <Container $wide>
        <Closing>
          <Reveal>
            <SectionLabel>
              <b>10</b> {contact.eyebrow}
            </SectionLabel>
          </Reveal>
          <Statement>
            <RevealLines
              lines={[
                <>Intelligence that moves markets<em>.</em></>,
                <>Execution that moves business<em>.</em></>,
              ]}
              stagger={0.1}
            />
          </Statement>
          <Reveal delay={0.15}>
            <Body style={{ marginTop: 22, maxWidth: '54ch' }}>{contactCta.body}</Body>
          </Reveal>
        </Closing>

        <Main>
          <div>
            <Heading>
              <RevealLines lines={[<>Let&rsquo;s talk<em>.</em></>]} />
            </Heading>
            <Reveal delay={0.12}>
              <Lede style={{ marginTop: 24, maxWidth: '42ch' }}>{contact.body}</Lede>
              <Actions>
                <Button as="a" href={`mailto:${contact.info[0].value}`} $variant="primary">
                  {contactCta.primaryCta.label}
                  <ArrowRight size={17} />
                </Button>
                <Button as="a" href="#capabilities" $variant="onDark">
                  {contactCta.secondaryCta.label}
                </Button>
              </Actions>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Info>
              {contact.info.map((row, i) => {
                const Icon = ICONS[i] ?? Mail;
                return (
                  <Row key={row.label}>
                    <dt>
                      <span className="ico" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      {row.label}
                    </dt>
                    <dd>
                      <InfoValue label={row.label} value={row.value} />
                    </dd>
                  </Row>
                );
              })}
            </Info>
          </Reveal>
        </Main>
      </Container>
    </Wrap>
  );
}
