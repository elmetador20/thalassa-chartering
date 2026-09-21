import React from 'react';

// Minimal stroked icon set. Icons are used sparingly — as functional
// indicators (direction, contact, location), never as decorative section art.

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const ArrowRight = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" {...stroke} />
  </svg>
);

export const ArrowDown = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4v15M6 13l6 6 6-6" {...stroke} />
  </svg>
);

export const ArrowUpRight = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M7 17 17 7M8 7h9v9" {...stroke} />
  </svg>
);

export const Menu = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3 7h18M3 15h18" {...stroke} />
  </svg>
);

export const Close = ({ size = 22, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M5 5l14 14M19 5 5 19" {...stroke} />
  </svg>
);

export const MapPin = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" {...stroke} />
    <circle cx="12" cy="10" r="2.6" {...stroke} />
  </svg>
);

export const Mail = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="1" {...stroke} />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" {...stroke} />
  </svg>
);

export const Phone = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path
      d="M6.4 4h3l1.5 3.9-2 1.5a12 12 0 0 0 5 5l1.5-2 3.9 1.5v3a1.9 1.9 0 0 1-2.1 1.9A15.9 15.9 0 0 1 4.1 6.1 1.9 1.9 0 0 1 6.4 4Z"
      {...stroke}
    />
  </svg>
);

export const Globe = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.4" {...stroke} />
    <path d="M3.6 12h16.8M12 3.6c2.2 2.3 3.3 5.2 3.3 8.4s-1.1 6.1-3.3 8.4c-2.2-2.3-3.3-5.2-3.3-8.4S9.8 5.9 12 3.6Z" {...stroke} />
  </svg>
);

export const Plus = ({ size = 18, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M5 12h14" {...stroke} />
  </svg>
);
