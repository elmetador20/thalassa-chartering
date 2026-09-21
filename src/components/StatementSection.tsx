'use client';

import React, { useRef } from 'react';
import styled from 'styled-components';
import { m, useScroll, useTransform, useReducedMotion, Reveal } from '@/lib/motion';
import { Container, Section, Meta, TechGrid } from './ui';
import { statement } from '@/data/siteData';

/**
 * The cinematic hand-off from the hero: four lines of the company's core
 * principle, each brightening as it passes the middle of the viewport.
 * Nothing else on screen.
 */

const Wrap = styled(Section)`
  padding-block: clamp(96px, 18vh, 220px);
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: clamp(38px, 6vw, 72px);

  .bar {
    width: clamp(28px, 4vw, 56px);
    height: 1px;
    background: ${({ theme }) => theme.colors.orange};
    flex: none;
  }
`;

const Lines = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: clamp(30px, 5.4vw, 74px);
  font-weight: 300;
  line-height: 1.08;
  letter-spacing: -0.014em;
  max-width: 20ch;

  span.line {
    display: block;
  }
`;

const Support = styled.div`
  margin-top: clamp(40px, 6vw, 80px);
  max-width: 58ch;
  margin-left: auto;
  padding-top: 26px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnDark};

  p {
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.7;
    color: ${({ theme }) => theme.colors.bodyOnDark};
  }
`;

/** One line of the statement, lit by scroll position. */
function Line({
  text,
  index,
  total,
  progress,
}: {
  text: string;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
}) {
  const reduce = useReducedMotion();
  // Each line owns a slice of the scroll range and brightens across it.
  const start = 0.06 + (index / total) * 0.6;
  const end = start + 0.26;
  const opacity = useTransform(progress, [start, end], [0.16, 1]);
  const x = useTransform(progress, [start, end], [reduce ? 0 : -18, 0]);

  return (
    <m.span
      className="line"
      style={reduce ? undefined : { opacity, x }}
      aria-hidden={false}
    >
      {text}
    </m.span>
  );
}

export default function StatementSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  return (
    <Wrap id="statement" ref={ref} $bg="deep">
      <TechGrid $opacity={0.5} />
      <Container $wide>
        <Head>
          <span className="bar" aria-hidden="true" />
          <Meta>{statement.label}</Meta>
        </Head>

        <Lines>
          {statement.lines.map((line, i) => (
            <Line
              key={line}
              text={line}
              index={i}
              total={statement.lines.length}
              progress={scrollYProgress}
            />
          ))}
        </Lines>

        <Reveal y={20}>
          <Support>
            <p>{statement.support}</p>
          </Support>
        </Reveal>
      </Container>
    </Wrap>
  );
}
