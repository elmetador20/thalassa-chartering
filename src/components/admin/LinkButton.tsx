'use client';

import Link from 'next/link';
import styled, { css } from 'styled-components';

/** A link that looks like a Button — for navigation, never for actions. */
export const LinkButton = styled(Link)<{ $variant?: 'primary' | 'secondary'; $small?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: ${({ $small }) => ($small ? 36 : 46)}px;
  padding: 0 ${({ $small }) => ($small ? 14 : 20)}px;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.layout.radius};
  font-size: ${({ $small }) => ($small ? 13.5 : 15)}px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease;

  ${({ $variant = 'primary', theme }) =>
    $variant === 'primary'
      ? css`
          background: ${theme.colors.navy};
          border-color: ${theme.colors.navy};
          color: #fff;
          &:hover {
            background: ${theme.colors.navyLift};
          }
        `
      : css`
          background: #fff;
          border-color: #7a8c9e;
          color: ${theme.colors.textOnLight};
          &:hover {
            border-color: ${theme.colors.navy};
          }
        `}
`;
