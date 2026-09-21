'use client';

import React from 'react';
import styled from 'styled-components';
import { Reveal } from '@/lib/motion';
import { iconFor } from './CapabilityIcons';

// ============================================================================
// Two ways of laying out a capability index, both spanning the full container
// so a section never leaves half a row empty:
//
//   <IconGrid>  title + description, three across
//   <IconList>  label only, four across — for dense term indexes
// ============================================================================

const Grid = styled.div`
  display: grid;
  gap: clamp(26px, 3vw, 44px) clamp(24px, 3vw, 48px);
  grid-template-columns: 1fr;

  @media (min-width: 620px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (min-width: 1040px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const Item = styled.div<{ $onDark: boolean }>`
  min-width: 0;
  padding-top: clamp(18px, 2vw, 24px);
  border-top: 1px solid
    ${({ theme, $onDark }) => ($onDark ? theme.colors.lineOnDark : theme.colors.lineOnLight)};

  .ico {
    display: block;
    color: ${({ theme, $onDark }) =>
      $onDark ? theme.colors.orange : theme.colors.orangeOnLight};
  }

  h4,
  h5 {
    margin-top: clamp(14px, 1.6vw, 20px);
    font-size: ${({ theme }) => theme.type.h4};
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: 0;
    color: ${({ theme, $onDark }) => ($onDark ? '#fff' : theme.colors.navy)};
  }

  p {
    margin-top: 10px;
    font-size: ${({ theme }) => theme.type.body};
    line-height: 1.6;
    color: ${({ theme, $onDark }) =>
      $onDark ? theme.colors.bodyOnDark : theme.colors.bodyOnLight};
    max-width: 38ch;
  }
`;

export type IconGridItem = { title: string; text?: string };

export function IconGrid({
  items,
  onDark = true,
  iconSize = 30,
  /** Keeps the document outline correct wherever the grid is nested. */
  headingLevel = 'h4',
}: {
  items: IconGridItem[];
  onDark?: boolean;
  iconSize?: number;
  headingLevel?: 'h3' | 'h4' | 'h5';
}) {
  const Heading = headingLevel;
  return (
    <Grid>
      {items.map((item, i) => {
        const Icon = iconFor(item.title);
        return (
          <Reveal key={item.title} delay={(i % 3) * 0.07} y={20}>
            <Item $onDark={onDark}>
              <span className="ico">
                <Icon size={iconSize} />
              </span>
              <Heading>{item.title}</Heading>
              {item.text && <p>{item.text}</p>}
            </Item>
          </Reveal>
        );
      })}
    </Grid>
  );
}

/* ------------------------------------------------------------------ list -- */

const List = styled.ul`
  display: grid;
  gap: 0 clamp(16px, 2.6vw, 40px);
  grid-template-columns: 1fr;

  /* Labels are short — pair them up early so phones don't scroll forever. */
  @media (min-width: 430px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (min-width: 780px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (min-width: 1040px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const ListItem = styled.li<{ $onDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: clamp(13px, 1.5vw, 17px) 0;
  border-bottom: 1px solid
    ${({ theme, $onDark }) =>
      $onDark ? theme.colors.lineOnDarkSoft : theme.colors.lineOnLightSoft};
  font-size: ${({ theme }) => theme.type.body};
  line-height: 1.4;
  color: ${({ theme, $onDark }) =>
    $onDark ? 'rgba(255,255,255,0.88)' : theme.colors.bodyOnLight};

  .ico {
    flex: none;
    display: inline-flex;
    color: ${({ theme, $onDark }) =>
      $onDark ? theme.colors.orange : theme.colors.orangeOnLight};
  }
`;

export function IconList({
  items,
  onDark = true,
  iconSize = 21,
}: {
  items: string[];
  onDark?: boolean;
  iconSize?: number;
}) {
  return (
    <List>
      {items.map((label) => {
        const Icon = iconFor(label);
        return (
          <ListItem key={label} $onDark={onDark}>
            <span className="ico">
              <Icon size={iconSize} />
            </span>
            {label}
          </ListItem>
        );
      })}
    </List>
  );
}
