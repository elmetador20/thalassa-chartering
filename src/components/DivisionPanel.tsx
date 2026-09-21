'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import styled, { css } from 'styled-components';
import { m, Reveal, RevealLines, RevealMedia, useParallax } from '@/lib/motion';
import { Container, Meta, TermList, FlowLine, ArrowLink, Body, SubLabel } from './ui';
import { IconGrid, IconList } from './IconGrid';
import { DIVISION_ICONS, Node } from './CapabilityIcons';
import { ArrowRight } from './icons';

export type DivisionDetail = {
  heading: string;
  /** Plain terms render as a dense index; title/text pairs render as a definition list. */
  terms?: string[];
  entries?: { title: string; text: string }[];
  columns?: number;
};

export type DivisionData = {
  id: string;
  no: string;
  name: string;
  heading: string;
  body: string;
  listHeading: string;
  list: string[];
  listColumns?: number;
  flow?: string;
  flowLabel?: string;
  closing?: string;
  image: string;
  alt: string;
  details?: DivisionDetail[];
};

/* ---------------------------------------------------------------- shell -- */

const Panel = styled.article<{ $flip: boolean }>`
  position: relative;
  padding-block: clamp(48px, 6.2vw, 96px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};

  &:first-of-type {
    border-top: 0;
  }

  ${({ $flip }) =>
    $flip &&
    css`
      .media-col {
        order: -1;
      }
    `}

  @media (max-width: 999px) {
    .media-col {
      order: 0;
    }
  }
`;

const Layout = styled.div`
  display: grid;
  gap: clamp(32px, 4.5vw, 72px);
  align-items: start;

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: clamp(44px, 5.5vw, 96px);
  }
`;

/** Giant index number + division name — the panel's identity block. */
const Identity = styled.div`
  display: flex;
  align-items: baseline;
  gap: clamp(14px, 2vw, 26px);

  .no {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: clamp(12px, 1.1vw, 15px);
    font-weight: 500;
    letter-spacing: 0.16em;
    color: ${({ theme }) => theme.colors.steel};
    padding-top: 0.75em;
    flex: none;
  }

  .mark {
    flex: none;
    display: inline-flex;
    align-self: center;
    color: ${({ theme }) => theme.colors.orange};
  }

  h3 {
    font-size: clamp(30px, 3.4vw + 12px, 58px);
    font-weight: 300;
    line-height: 1.02;
    letter-spacing: -0.014em;
    color: #fff;
  }
`;

const Sub = styled.p`
  margin-top: clamp(18px, 2.2vw, 28px);
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.type.h3};
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.008em;
  color: rgba(255, 255, 255, 0.9);
  max-width: 24ch;
`;

const Text = styled(Body)`
  margin-top: clamp(16px, 2vw, 24px);
  max-width: 52ch;
`;

const ListBlock = styled.div`
  margin-top: clamp(26px, 3vw, 40px);

  h4 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
    margin-bottom: 14px;
  }
`;

const Flow = styled.div`
  margin-top: clamp(26px, 3vw, 38px);
  padding-top: 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};

  h4 {
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: clamp(13px, 0.3vw + 12px, 15px);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
    margin-bottom: 14px;
  }
`;

const MediaFrame = styled.div`
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.navyMuted};

  @media (min-width: 1000px) {
    aspect-ratio: 4 / 4.4;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(200deg, rgba(0, 51, 102, 0.1), rgba(0, 34, 64, 0.66));
    pointer-events: none;
  }
`;

const MediaInner = styled(m.div)`
  position: absolute;
  inset: -7% 0;
  will-change: transform;

  img {
    object-fit: cover;
  }
`;

/** Thin corner ticks — an engineering-drawing detail over the photograph. */
const Ticks = styled.span`
  position: absolute;
  inset: 14px;
  z-index: 2;
  pointer-events: none;

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(255, 255, 255, 0.5);
  }
  &::before {
    top: 0;
    left: 0;
    border-right: 0;
    border-bottom: 0;
  }
  &::after {
    bottom: 0;
    right: 0;
    border-left: 0;
    border-top: 0;
  }
`;

const MediaTag = styled.div`
  position: absolute;
  z-index: 2;
  left: 14px;
  bottom: 14px;
  padding: 9px 14px;
  background: rgba(0, 34, 64, 0.74);
  border-left: 2px solid ${({ theme }) => theme.colors.orange};
`;

/* --------------------------------------------------------------- detail -- */

/**
 * Capability appendix. Each block spans the full container and lays its items
 * out across the whole width — the previous nested two-column grid left large
 * empty areas whenever two blocks had very different lengths.
 */
const Details = styled.div`
  margin-top: clamp(40px, 5vw, 76px);
  display: grid;
  gap: clamp(36px, 4.4vw, 68px);
`;

const DetailBlock = styled.div`
  min-width: 0;

  ${SubLabel} {
    display: block;
    margin-bottom: clamp(18px, 2vw, 26px);
    padding-bottom: 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }
`;

const Closing = styled.p`
  margin-top: clamp(26px, 3vw, 40px);
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(17px, 1.6vw, 22px);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.005em;
  color: #fff;
  padding-left: 18px;
  border-left: 2px solid ${({ theme }) => theme.colors.orange};
`;

const Actions = styled.div`
  margin-top: clamp(26px, 3vw, 38px);
`;

/* ----------------------------------------------------------- component -- */

/** Renders "A → B → C" flows with the arrows tinted orange. */
function Flowchart({ value }: { value: string }) {
  const parts = value.split('→').map((p) => p.trim());
  return (
    <FlowLine>
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

export default function DivisionPanel({
  data,
  flip = false,
}: {
  data: DivisionData;
  flip?: boolean;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const y = useParallax(mediaRef, 40);
  const DivisionMark = DIVISION_ICONS[data.id] ?? Node;

  return (
    <Panel id={data.id} $flip={flip}>
      <Container $wide>
        <Layout>
          <div>
            <Identity>
              <span className="no">{data.no}</span>
              <span className="mark" aria-hidden="true">
                <DivisionMark size={34} />
              </span>
              <h3>
                <RevealLines lines={[data.name]} />
              </h3>
            </Identity>

            <Reveal delay={0.08}>
              <Sub>{data.heading}</Sub>
              <Text>{data.body}</Text>

              <ListBlock>
                <h4>{data.listHeading}</h4>
                <TermList $cols={data.listColumns ?? 2}>
                  {data.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </TermList>
              </ListBlock>

              {data.flow && (
                <Flow>
                  <h4>{data.flowLabel ?? 'Process'}</h4>
                  <Flowchart value={data.flow} />
                </Flow>
              )}

              <Actions>
                <ArrowLink href="#contact">
                  Discuss {data.name.toLowerCase()}
                  <ArrowRight size={16} />
                </ArrowLink>
              </Actions>
            </Reveal>
          </div>

          <div className="media-col">
            <RevealMedia>
              <MediaFrame ref={mediaRef}>
                <MediaInner style={{ y }}>
                  <Image
                    src={data.image}
                    alt={data.alt}
                    fill
                    sizes="(max-width: 1000px) 100vw, 48vw"
                    style={{ objectFit: 'cover' }}
                  />
                </MediaInner>
                <Ticks aria-hidden="true" />
                <MediaTag>
                  <Meta style={{ color: '#fff' }}>
                    {data.no} · {data.name}
                  </Meta>
                </MediaTag>
              </MediaFrame>
            </RevealMedia>
          </div>
        </Layout>

        {data.details && data.details.length > 0 && (
          <Details>
            {data.details.map((d) => (
              <DetailBlock key={d.heading}>
                <Reveal y={18}>
                  <SubLabel as="h4">{d.heading}</SubLabel>
                </Reveal>
                {d.entries ? (
                  <IconGrid items={d.entries} headingLevel="h5" />
                ) : (
                  <IconList items={d.terms ?? []} />
                )}
              </DetailBlock>
            ))}
          </Details>
        )}

        {data.closing && (
          <Reveal>
            <Closing>{data.closing}</Closing>
          </Reveal>
        )}
      </Container>
    </Panel>
  );
}
