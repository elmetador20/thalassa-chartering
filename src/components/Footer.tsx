'use client';

import React from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { Container, Meta } from './ui';
import { ArrowUpRight } from './icons';
import { footer, hero, about } from '@/data/siteData';

/** Footer link labels resolve to the section anchors used across the page. */
const HREFS: Record<string, string> = {
  About: '#about',
  Verticals: '#capabilities',
  Capabilities: '#capabilities',
  Model: '#model',
  Chartering: '#chartering',
  Projects: '#projects',
  Contact: '#contact',
  Intelligence: '#intelligence',
  Datamatics: '#datamatics',
  Tectonics: '#tectonics',
  Digitronics: '#digitronics',
  'Global Presence': '#global',
  Leadership: '#leadership',
  Sustainability: '#sustainability',
};

const Wrap = styled.footer`
  background: ${({ theme }) => theme.colors.navyDeep};
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
`;

const Top = styled(Container)`
  padding-block: clamp(48px, 6vw, 84px);
  display: grid;
  gap: clamp(34px, 4.5vw, 72px);

  @media (min-width: 900px) {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 2fr);
  }
`;

const Brand = styled.div`
  /* The footer mark sits a step larger than the bar's — it anchors the
     column rather than labelling a strip. */
  img {
    width: auto;
    height: clamp(30px, 3.2vw, 44px);
  }

  p {
    margin-top: 22px;
    max-width: 38ch;
    font-size: 15px;
    line-height: 1.66;
    color: ${({ theme }) => theme.colors.bodyOnDark};
  }
`;

const Offices = styled.div`
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};

  ul {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 0;
  }
  li {
    display: flex;
    align-items: center;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }
  li + li::before {
    content: '';
    width: 3px;
    height: 3px;
    margin: 0 12px;
    background: ${({ theme }) => theme.colors.orange};
    flex: none;
  }
`;

const Columns = styled.div`
  display: grid;
  gap: clamp(28px, 3vw, 44px);
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (min-width: 720px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Column = styled.nav`
  h3 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
    padding-bottom: 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }

  ul {
    margin-top: 6px;
  }

  a {
    display: inline-block;
    padding: 7px 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.76);
    transition: color 0.25s ease, transform 0.35s ${({ theme }) => theme.motion.ease};
  }
  a:hover {
    color: ${({ theme }) => theme.colors.orangeOnDark};
    transform: translateX(4px);
  }
`;

const ContactCol = styled.div`
  h3 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
    padding-bottom: 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }

  dl {
    margin: 14px 0 0;
  }
  div + div {
    margin-top: 14px;
  }
  dt {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.mutedOnDark};
  }
  dd {
    margin: 5px 0 0;
    font-size: 14.5px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.84);
    overflow-wrap: anywhere;
  }
  dd a:hover {
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

const Bottom = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
`;

const BottomInner = styled(Container)`
  padding-block: 22px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px 24px;
`;

const Legal = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;

  a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.mutedOnDark};
    transition: color 0.25s ease;
  }
  a:hover {
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
`;

const ToTop = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  transition: color 0.25s ease;

  svg {
    transition: transform 0.4s ${({ theme }) => theme.motion.ease};
  }
  &:hover {
    color: ${({ theme }) => theme.colors.orange};
  }
  &:hover svg {
    transform: translate(3px, -3px);
  }
`;

export default function Footer() {
  return (
    <Wrap>
      <Top $wide>
        <Brand>
          <Image
            src="/images/incworx-logo-reversed.png"
            alt="INCWORX"
            width={1396}
            height={195}
            sizes="340px"
          />
          <p>{about.body}</p>
          <Offices>
            <Meta>Offices</Meta>
            <ul>
              {hero.offices.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </Offices>
        </Brand>

        <Columns>
          {footer.columns.map((col) => (
            <Column key={col.heading} aria-label={col.heading}>
              <h3>{col.heading}</h3>
              <ul>
                {col.links.map((label) => (
                  <li key={label}>
                    <a href={HREFS[label] ?? '#contact'}>{label}</a>
                  </li>
                ))}
              </ul>
            </Column>
          ))}

          <ContactCol>
            <h3>Contact</h3>
            <dl>
              {footer.contact.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    {row.label === 'Email' ? (
                      <a href={`mailto:${row.value}`}>{row.value}</a>
                    ) : row.label === 'Mobile' ? (
                      <a href={`tel:${row.value.replace(/[^\d+]/g, '')}`}>{row.value}</a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </ContactCol>
        </Columns>
      </Top>

      <Bottom>
        <BottomInner $wide>
          <Meta>{footer.copyright}</Meta>

          <Legal>
            {footer.legal.map((l) => (
              <li key={l}>
                <a href="#contact">{l}</a>
              </li>
            ))}
          </Legal>

          <ToTop href="#home">
            Back to top
            <ArrowUpRight size={14} />
          </ToTop>
        </BottomInner>
      </Bottom>
    </Wrap>
  );
}
