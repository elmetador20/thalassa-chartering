'use client';

import React from 'react';
import styled from 'styled-components';
import { describeActivity, formatDateTime, type ActivityLike } from '@/lib/admin-format';
import { EmptyState } from './ui';

export interface ActivityRow extends ActivityLike {
  id: string;
  createdAt: string;
}

const List = styled.ol`
  display: grid;

  li {
    display: grid;
    gap: 3px;
    padding: 12px 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLightSoft};
  }
  li:first-child {
    padding-top: 0;
  }
  li:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .what {
    font-size: 14.5px;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  li[data-alert='true'] .what {
    color: ${({ theme }) => theme.colors.danger};
  }
  time {
    font-size: 12.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
`;

export default function ActivityFeed({ items }: { items: ActivityRow[] }) {
  if (items.length === 0) return <EmptyState>No activity recorded yet.</EmptyState>;
  return (
    <List>
      {items.map((item) => (
        <li key={item.id} data-alert={item.action === 'LOGIN_FAILED'}>
          <span className="what">{describeActivity(item)}</span>
          <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
        </li>
      ))}
    </List>
  );
}
