'use client';

import React from 'react';
import styled from 'styled-components';

/**
 * Shipping-route motif: thin great-circle style arcs that draw themselves and
 * carry a travelling pulse. Purely decorative, hidden from assistive tech, and
 * static under prefers-reduced-motion.
 */

const Svg = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;

  .route {
    fill: none;
    stroke: rgba(255, 255, 255, 0.22);
    stroke-width: 1;
    stroke-dasharray: 3 5;
  }

  .pulse {
    fill: none;
    stroke: ${({ theme }) => theme.colors.orange};
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-dasharray: 46 600;
    stroke-dashoffset: 646;
    animation: routePulse 7s linear infinite;
  }
  .pulse.b {
    animation-duration: 9s;
    animation-delay: -3s;
  }
  .pulse.c {
    animation-duration: 8s;
    animation-delay: -5.5s;
  }

  .node {
    fill: ${({ theme }) => theme.colors.orange};
  }
  .node-ring {
    fill: none;
    stroke: ${({ theme }) => theme.colors.orange};
    stroke-width: 1;
    opacity: 0.45;
  }

  @keyframes routePulse {
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse {
      animation: none;
      stroke-dashoffset: 0;
      stroke-dasharray: none;
      opacity: 0.35;
    }
  }
`;

const PATHS = [
  'M-20 172 C 180 96, 372 214, 560 128 S 900 56, 1060 120',
  'M-20 262 C 220 226, 400 300, 604 238 S 920 168, 1060 214',
  'M-20 84 C 240 152, 452 60, 660 106 S 940 176, 1060 46',
];

export default function RouteLines({ className }: { className?: string }) {
  return (
    <Svg
      className={className}
      viewBox="0 0 1040 320"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS.map((d, i) => (
        <path key={`r${i}`} className="route" d={d} />
      ))}
      {PATHS.map((d, i) => (
        <path key={`p${i}`} className={`pulse ${['a', 'b', 'c'][i]}`} d={d} />
      ))}

      {/* Port nodes on the route network. */}
      {[
        [178, 122],
        [560, 128],
        [604, 238],
        [880, 92],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle className="node" cx={cx} cy={cy} r={2.6} />
          <circle className="node-ring" cx={cx} cy={cy} r={7} />
        </g>
      ))}
    </Svg>
  );
}
