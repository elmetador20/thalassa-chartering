'use client';

import React from 'react';
import styled from 'styled-components';
import { containsIdentity, PASSWORD_MIN_LENGTH, passwordRuleProblems, type PasswordIdentity } from '@/lib/validation/auth';

// Live view of the same rules the server enforces. Purely a guide: the
// server re-checks everything, plus a dictionary strength estimate.

const List = styled.ul`
  display: grid;
  gap: 4px;
  font-size: 13px;
  line-height: 1.45;

  li {
    display: flex;
    gap: 8px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  li[data-met='true'] {
    color: ${({ theme }) => theme.colors.success};
  }
  .mark {
    width: 14px;
    flex: none;
    font-weight: 600;
  }
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

const RULES: { label: string; broken: (problems: string[]) => boolean }[] = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, broken: (p) => p.some((m) => m.startsWith('Use at least')) },
  { label: 'Upper- and lowercase letters', broken: (p) => p.some((m) => /uppercase|lowercase/.test(m)) },
  { label: 'At least one number', broken: (p) => p.some((m) => m.includes('number')) },
  { label: 'At least one special character', broken: (p) => p.some((m) => m.includes('special')) },
  { label: 'No sequences or repeated characters', broken: (p) => p.some((m) => /sequence|repeat/.test(m)) },
];

function Item({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li data-met={met}>
      <span className="mark" aria-hidden="true">
        {met ? '✓' : '–'}
      </span>
      {children}
      <VisuallyHidden>{met ? ' (met)' : ' (not met)'}</VisuallyHidden>
    </li>
  );
}

export default function PasswordChecklist({ password, identity }: { password: string; identity: PasswordIdentity }) {
  const problems = password ? passwordRuleProblems(password) : [];
  const has = Boolean(password);

  return (
    <List aria-label="Password requirements">
      {RULES.map((rule) => (
        <Item key={rule.label} met={has && !rule.broken(problems)}>
          {rule.label}
        </Item>
      ))}
      <Item met={has && !containsIdentity(password, identity)}>Doesn&apos;t contain the name or email</Item>
    </List>
  );
}
