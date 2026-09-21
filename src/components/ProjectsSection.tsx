'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { m, Reveal, RevealLines, RevealMedia, Counter, useParallax } from '@/lib/motion';
import { Container, Section, SectionLabel, Body, Meta, TermList, ArrowLink } from './ui';
import { ArrowRight } from './icons';
import { projects } from '@/data/siteData';

/**
 * Projects read as an editorial feature, not a portfolio grid: one project per
 * viewport, oversized investment figures, full-width photography.
 */

const Wrap = styled(Section)`
  padding-bottom: 0;
`;

const Head = styled(Container)`
  display: grid;
  gap: clamp(28px, 4vw, 64px);
  align-items: end;
  padding-bottom: clamp(48px, 7vw, 96px);

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
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

/** Combined portfolio figure — the section's headline number. */
const Portfolio = styled.div`
  text-align: left;

  @media (min-width: 1000px) {
    text-align: right;
  }

  .fig {
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: clamp(40px, 6vw, 88px);
    font-weight: 300;
    line-height: 0.96;
    letter-spacing: -0.018em;
    color: ${({ theme }) => theme.colors.orange};
    font-variant-numeric: tabular-nums;
  }
  .lbl {
    display: block;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  }
`;

const Item = styled.article`
  position: relative;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  padding-block: clamp(52px, 8vw, 110px);
`;

const Layout = styled.div`
  display: grid;
  gap: clamp(30px, 4vw, 64px);
  align-items: center;

  @media (min-width: 1020px) {
    grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
    gap: clamp(44px, 5vw, 88px);
  }
`;

const Index = styled.div`
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: clamp(16px, 2vw, 24px);

  .no {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: clamp(12px, 1.1vw, 15px);
    font-weight: 500;
    letter-spacing: 0.18em;
    color: ${({ theme }) => theme.colors.orangeOnDark};
  }
  .cat {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
  }
`;

const Title = styled.h3`
  font-size: clamp(30px, 4.6vw, 62px);
  font-weight: 300;
  line-height: 0.99;
  letter-spacing: -0.016em;
  color: #fff;
  max-width: 12ch;
`;

const Figure = styled.div`
  margin-top: clamp(26px, 3vw, 40px);
  padding-top: clamp(20px, 2.4vw, 30px);
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};

  .val {
    display: block;
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: ${({ theme }) => theme.type.figure};
    font-weight: 300;
    line-height: 0.92;
    letter-spacing: -0.008em;
    color: #fff;
    font-variant-numeric: tabular-nums;

    i {
      font-style: normal;
      color: ${({ theme }) => theme.colors.orange};
    }
  }
  .lbl {
    display: block;
    margin-top: 14px;
  }
`;

const Facts = styled.dl`
  margin: clamp(26px, 3vw, 38px) 0 0;
  display: grid;
  gap: 0;

  @media (min-width: 560px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(20px, 2.4vw, 40px);
  }

  div {
    padding: 13px 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDarkSoft};
  }
  dt {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.17em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
  }
  dd {
    margin: 7px 0 0;
    font-size: 15.5px;
    line-height: 1.45;
    color: #fff;
  }
`;

const MediaFrame = styled.div`
  position: relative;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.navyMuted};

  @media (min-width: 1020px) {
    aspect-ratio: 16 / 12;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 34, 64, 0.5), rgba(0, 51, 102, 0.06) 60%);
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

const MediaTag = styled.div`
  position: absolute;
  z-index: 2;
  left: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  background: rgba(0, 34, 64, 0.76);
  border-left: 2px solid ${({ theme }) => theme.colors.orange};
`;

const Foot = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};
  background: ${({ theme }) => theme.colors.navy};
`;

const FootInner = styled(Container)`
  padding-block: clamp(46px, 6vw, 88px);
  display: grid;
  gap: clamp(28px, 4vw, 60px);

  @media (min-width: 960px) {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }

  h3 {
    font-size: ${({ theme }) => theme.type.h3};
    font-weight: 500;
    letter-spacing: -0.004em;
    color: #fff;
    max-width: 16ch;
  }
`;

export default function ProjectsSection() {
  return (
    <Wrap id="projects" $bg="deep">
      <Head $wide>
        <div>
          <Reveal>
            <SectionLabel>
              <b>05</b> {projects.eyebrow}
            </SectionLabel>
          </Reveal>
          <Heading>
            <RevealLines lines={['Manki &', 'Pavinakurve.']} stagger={0.1} />
          </Heading>
        </div>

        <Reveal delay={0.12}>
          <Portfolio>
            <span className="fig">
              $<Counter to={projects.figureValue} decimals={projects.figureDecimals} />{' '}
              {projects.figureUnit}
            </span>
            <Meta className="lbl">{projects.figureLabel}</Meta>
          </Portfolio>
        </Reveal>
      </Head>

      {projects.items.map((p, i) => (
        <ProjectItem key={p.id} project={p} flip={i % 2 === 1} />
      ))}

      <Foot>
        <FootInner $wide>
          <Reveal>
            <h3>{projects.closing}</h3>
            <div style={{ marginTop: 26 }}>
              <ArrowLink href="#contact">
                Discuss a project
                <ArrowRight size={16} />
              </ArrowLink>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              <Meta style={{ display: 'block', marginBottom: 18 }}>
                {projects.experienceHeading}
              </Meta>
              <TermList $cols={2}>
                {projects.experience.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </TermList>
            </div>
          </Reveal>
        </FootInner>
      </Foot>
    </Wrap>
  );
}

function ProjectItem({
  project,
  flip,
}: {
  project: (typeof projects.items)[number];
  flip: boolean;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const y = useParallax(mediaRef, 38);

  return (
    <Item id={project.id}>
      <Container $wide>
        <Layout>
          <div style={{ order: flip ? 2 : 1 }}>
            <Index>
              <span className="no">{project.no}</span>
              <span className="cat">{project.category}</span>
            </Index>

            <Title>
              <RevealLines lines={project.titleLines} stagger={0.08} />
            </Title>

            <Reveal delay={0.1}>
              <Figure>
                <span className="val">
                  <i>$</i>
                  <Counter to={project.value} /> {project.valueUnit}
                </span>
                <Meta className="lbl">{project.valueLabel}</Meta>
              </Figure>

              <Body style={{ marginTop: 'clamp(24px, 3vw, 34px)', maxWidth: '46ch' }}>
                {project.description}
              </Body>

              <Facts>
                <div>
                  <dt>Location</dt>
                  <dd>{project.location}</dd>
                </div>
                <div>
                  <dt>Asset</dt>
                  <dd>{project.asset}</dd>
                </div>
                <div>
                  <dt>Developer</dt>
                  <dd>{project.developer}</dd>
                </div>
                <div>
                  <dt>Basis</dt>
                  <dd>{project.basis}</dd>
                </div>
              </Facts>
            </Reveal>
          </div>

          <div style={{ order: flip ? 1 : 2 }}>
            <RevealMedia>
              <MediaFrame ref={mediaRef}>
                <MediaInner style={{ y }}>
                  <Image
                    src={project.image}
                    alt={project.alt}
                    fill
                    sizes="(max-width: 1020px) 100vw, 56vw"
                    style={{ objectFit: 'cover' }}
                  />
                </MediaInner>
                <MediaTag>
                  <Meta style={{ color: '#fff' }}>
                    {project.no} · {project.location}
                  </Meta>
                </MediaTag>
              </MediaFrame>
            </RevealMedia>
          </div>
        </Layout>
      </Container>
    </Item>
  );
}
