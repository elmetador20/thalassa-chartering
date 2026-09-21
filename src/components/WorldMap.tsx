'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useInViewOnce, EASE_CSS } from '@/lib/motion';
import { LAND_DOTS_PATH, CITY_POINTS, MAP_W, MAP_H } from '@/data/worldMapData';

/**
 * Dot-matrix world map drawn from Natural Earth land data (baked at build time
 * by scripts/gen-world.mjs). Deliberately not a tiled street map: no labels, no
 * roads, no third-party tiles — an abstract geographic read-out in brand navy.
 *
 * Every entrance is a CSS transition keyed off `data-shown`, matching the rest
 * of the site's motion system.
 */

const Frame = styled.div`
  position: relative;
  width: 100%;
`;

const Svg = styled.svg`
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
`;

const Dots = styled.path`
  stroke: rgba(143, 163, 181, 0.4);
  stroke-linecap: round;
  fill: none;
  opacity: 0;
  transition: opacity 1.4s ${EASE_CSS};

  [data-shown='true'] & {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transition: none;
  }
`;

const Graticule = styled.g`
  stroke: rgba(255, 255, 255, 0.05);
  stroke-width: 0.7;
  fill: none;
`;

/** Trade lane. `pathLength="1"` normalises the dash maths across path lengths. */
const Route = styled.path<{ $delay: number }>`
  fill: none;
  stroke: rgba(255, 63, 3, 0.32);
  stroke-width: 1;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 1.5s ${EASE_CSS} ${({ $delay }) => $delay}s;

  [data-shown='true'] & {
    stroke-dashoffset: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    stroke-dashoffset: 0;
    transition: none;
  }
`;

const RoutePulse = styled.path`
  fill: none;
  stroke: #ff3f03;
  stroke-width: 1.6;
  stroke-linecap: round;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const Marker = styled.g<{ $delay: number }>`
  opacity: 0;
  transform: scale(0.6);
  transform-box: fill-box;
  transform-origin: center;
  transition:
    opacity 0.7s ${EASE_CSS} ${({ $delay }) => $delay}s,
    transform 0.7s ${EASE_CSS} ${({ $delay }) => $delay}s;

  [data-shown='true'] & {
    opacity: 1;
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transform: none;
    transition: none;
  }
`;

// Label sizes are in viewBox units, so the narrow crop needs larger values to
// render at the same physical size.
const CityLabel = styled.text<{ $narrow?: boolean }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ $narrow }) => ($narrow ? 15 : 11)}px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  fill: #fff;
`;

const CityCoord = styled.text<{ $narrow?: boolean }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ $narrow }) => ($narrow ? 11 : 8)}px;
  letter-spacing: 0.08em;
  fill: rgba(143, 163, 181, 0.85);
`;

/** Office coordinates, shown as a technical annotation beside each marker. */
const COORDS: Record<string, string> = {
  London: '51.5°N 0.1°W',
  Dubai: '25.2°N 55.3°E',
  Delhi: '28.6°N 77.2°E',
  Singapore: '1.4°N 103.8°E',
  'Hong Kong': '22.3°N 114.2°E',
};

/** Labels flip to the left where a right-hand label would collide or overflow. */
const LABEL_SIDE: Record<string, 1 | -1> = {
  London: -1,
  Dubai: -1,
  Delhi: 1,
  Singapore: -1,
  'Hong Kong': 1,
};

type Pt = { x: number; y: number };

/** Quadratic arc bowed perpendicular to the chord — reads as a great circle. */
function arc(a: Pt, b: Pt, bow = 0.17) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const dir = ny > 0 ? -1 : 1;
  const cx = mx + nx * len * bow * dir;
  const cy = my + ny * len * bow * dir;
  return `M${a.x} ${a.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`;
}

const LANES: [string, string][] = [
  ['London', 'Dubai'],
  ['Dubai', 'Delhi'],
  ['Delhi', 'Singapore'],
  ['Singapore', 'Hong Kong'],
  ['London', 'Delhi'],
  ['Dubai', 'Singapore'],
];

/**
 * Narrow screens get a cropped viewBox centred on the office network rather
 * than the whole globe — every marker stays on screen with no sideways scroll.
 */
const NARROW_VIEWBOX = '408 60 540 305';

export default function WorldMap() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const dotSize = narrow ? 2.9 : 2.1;
  const markerR = narrow ? 5.5 : 4;
  const labelGap = narrow ? 19 : 14;

  const byName = useMemo(
    () => Object.fromEntries(CITY_POINTS.map((c) => [c.name, c])) as Record<string, Pt>,
    []
  );

  const routes = useMemo(
    () => LANES.map(([from, to]) => ({ key: `${from}-${to}`, d: arc(byName[from], byName[to]) })),
    [byName]
  );

  return (
    <Frame ref={ref} data-shown={inView}>
      <Svg
        viewBox={narrow ? NARROW_VIEWBOX : `0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label="World map showing INCWORX offices in London, Dubai, Delhi, Singapore and Hong Kong, connected by trade lanes"
      >
        {/* Latitude / longitude reference lines. */}
        <Graticule aria-hidden="true">
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <line key={`h${f}`} x1={0} y1={MAP_H * f} x2={MAP_W} y2={MAP_H * f} />
          ))}
          {[0.2, 0.4, 0.5, 0.6, 0.8].map((f) => (
            <line key={`v${f}`} x1={MAP_W * f} y1={0} x2={MAP_W * f} y2={MAP_H} />
          ))}
        </Graticule>

        <Dots d={LAND_DOTS_PATH} style={{ strokeWidth: dotSize }} />

        {/* Trade lanes draw themselves, then carry a travelling pulse. */}
        <g aria-hidden="true">
          {routes.map((r, i) => (
            <Route key={r.key} d={r.d} pathLength={1} $delay={0.35 + i * 0.14} />
          ))}
          {routes.map((r, i) => (
            <RoutePulse key={`p-${r.key}`} d={r.d}>
              <animate
                attributeName="stroke-dasharray"
                values="0 400; 26 400; 0 400"
                dur="4.2s"
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-dashoffset"
                values="0; -400"
                dur="4.2s"
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
              />
            </RoutePulse>
          ))}
        </g>

        {/* Office markers. */}
        {CITY_POINTS.map((c, i) => {
          const side = LABEL_SIDE[c.name] ?? 1;
          const tx = c.x + side * labelGap;
          const anchor = side === 1 ? 'start' : 'end';
          return (
            <Marker key={c.name} $delay={0.9 + i * 0.12}>
              <circle cx={c.x} cy={c.y} r={markerR} fill="none" stroke="#FF3F03" strokeWidth={1}>
                <animate
                  attributeName="r"
                  values={`${markerR};${markerR * 3.6}`}
                  dur="2.8s"
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.75;0"
                  dur="2.8s"
                  begin={`${i * 0.45}s`}
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={c.x} cy={c.y} r={markerR} fill="#FF3F03" />
              <line
                x1={c.x + side * (markerR + 2)}
                y1={c.y}
                x2={c.x + side * (labelGap - 3)}
                y2={c.y}
                stroke="rgba(255,63,3,0.6)"
                strokeWidth={1}
              />
              <CityLabel x={tx} y={c.y - (narrow ? 4 : 3)} textAnchor={anchor} $narrow={narrow}>
                {c.name}
              </CityLabel>
              <CityCoord x={tx} y={c.y + (narrow ? 12 : 9)} textAnchor={anchor} $narrow={narrow}>
                {COORDS[c.name]}
              </CityCoord>
            </Marker>
          );
        })}
      </Svg>
    </Frame>
  );
}
