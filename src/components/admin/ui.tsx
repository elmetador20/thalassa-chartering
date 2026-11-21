'use client';

import React, { useId, useState } from 'react';
import styled, { css } from 'styled-components';

// ============================================================================
// Admin UI primitives — light surfaces, navy type, orange only as focus and
// accent. Sharp corners and hairline rules, in keeping with the main site.
// ============================================================================

const INPUT_BORDER = '#7A8C9E'; // 3.5:1 on white: meets the 3:1 rule for UI boundaries

// ------------------------------------------------------------------ layout --

const HeaderWrap = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
  margin-bottom: clamp(22px, 3vw, 34px);
`;

const Eyebrow = styled.p`
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.orangeOnLight};
  margin-bottom: 8px;
`;

const Title = styled.h1`
  font-size: clamp(26px, 1.6vw + 18px, 36px);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textOnLight};
`;

const Description = styled.p`
  margin-top: 8px;
  max-width: 62ch;
  font-size: 15px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.bodyOnLight};
`;

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <HeaderWrap>
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Title>{title}</Title>
        {description && <Description>{description}</Description>}
      </div>
      {actions}
    </HeaderWrap>
  );
}

export const Panel = styled.section`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  border-radius: ${({ theme }) => theme.layout.radius};
  padding: clamp(18px, 2.2vw, 28px);
  min-width: 0;
`;

export const PanelHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 18px;
`;

export const PanelTitle = styled.h2`
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.005em;
  color: ${({ theme }) => theme.colors.textOnLight};
`;

export const Muted = styled.p`
  font-size: 14px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.mutedOnLight};
`;

export const Stack = styled.div<{ $gap?: number }>`
  display: grid;
  gap: ${({ $gap = 20 }) => $gap}px;
  min-width: 0;
`;

export const Columns = styled.div`
  display: grid;
  gap: 20px;
  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    align-items: start;
  }
`;

// ----------------------------------------------------------------- buttons --

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

const variants: Record<ButtonVariant, ReturnType<typeof css>> = {
  primary: css`
    background: ${({ theme }) => theme.colors.navy};
    border-color: ${({ theme }) => theme.colors.navy};
    color: #fff;
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.navyLift};
    }
  `,
  secondary: css`
    background: #fff;
    border-color: ${INPUT_BORDER};
    color: ${({ theme }) => theme.colors.textOnLight};
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.navy};
    }
  `,
  danger: css`
    background: #fff;
    border-color: ${({ theme }) => theme.colors.danger};
    color: ${({ theme }) => theme.colors.danger};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerSoft};
    }
  `,
  success: css`
    background: ${({ theme }) => theme.colors.success};
    border-color: ${({ theme }) => theme.colors.success};
    color: #fff;
    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
  `,
};

export const Button = styled.button<{ $variant?: ButtonVariant; $small?: boolean; $block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: ${({ $small }) => ($small ? 36 : 46)}px;
  padding: 0 ${({ $small }) => ($small ? 14 : 20)}px;
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.layout.radius};
  font-size: ${({ $small }) => ($small ? 13.5 : 15)}px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, filter 0.15s ease;
  ${({ $variant = 'primary' }) => variants[$variant]}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

// ------------------------------------------------------------------ fields --

const FieldWrap = styled.div`
  display: grid;
  gap: 7px;
  min-width: 0;
  /* Never stretch label/input rows when a neighbouring field in the same form
     row is taller (e.g. one with a password checklist) — stretching would
     push the input down and the show/hide toggle out of the box. */
  align-content: start;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textOnLight};
`;

const Hint = styled.p`
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.mutedOnLight};
`;

const ErrorList = styled.ul`
  display: grid;
  gap: 3px;
  font-size: 13.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.danger};

  li::before {
    content: '•';
    margin-right: 6px;
  }
`;

const inputStyles = css<{ $invalid?: boolean }>`
  width: 100%;
  min-height: 46px;
  padding: 10px 13px;
  border: 1px solid ${({ $invalid, theme }) => ($invalid ? theme.colors.danger : INPUT_BORDER)};
  border-radius: ${({ theme }) => theme.layout.radius};
  background: #fff;
  font: inherit;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textOnLight};

  &::placeholder {
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
`;

export const Input = styled.input<{ $invalid?: boolean }>`
  ${inputStyles}
`;

export const Textarea = styled.textarea<{ $invalid?: boolean }>`
  ${inputStyles}
  min-height: 88px;
  resize: vertical;
`;

interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  errors?: string[];
  /** Show every error (password rules) rather than only the first. */
  showAllErrors?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode;
}

/** Label + control + hint + errors, wired together for screen readers. */
export function Field({ label, hint, errors, showAllErrors, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const shown = errors?.length ? (showAllErrors ? errors : errors.slice(0, 1)) : [];
  const describedBy = [hint ? hintId : null, shown.length ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <FieldWrap>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-invalid': shown.length > 0, 'aria-describedby': describedBy })}
      {hint && <Hint id={hintId}>{hint}</Hint>}
      {shown.length > 0 && (
        <ErrorList id={errorId}>
          {shown.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ErrorList>
      )}
    </FieldWrap>
  );
}

const PasswordWrap = styled.div`
  position: relative;

  input {
    padding-right: 76px;
  }
`;

const Reveal = styled.button`
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  min-height: 34px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.layout.radius};
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy};

  &:hover {
    background: ${({ theme }) => theme.colors.infoSoft};
  }
`;

/** A password input with a show / hide toggle. */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { $invalid?: boolean }
>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <PasswordWrap>
      <Input ref={ref} {...props} type={visible ? 'text' : 'password'} spellCheck={false} autoCapitalize="off" />
      <Reveal
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={props.id}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? 'Hide' : 'Show'}
      </Reveal>
    </PasswordWrap>
  );
});

// ------------------------------------------------------------------ alerts --

const AlertBox = styled.div<{ $tone: 'error' | 'success' | 'info' }>`
  padding: 12px 14px;
  border-left: 3px solid
    ${({ $tone, theme }) => ($tone === 'error' ? theme.colors.danger : $tone === 'success' ? theme.colors.success : theme.colors.navy)};
  background: ${({ $tone, theme }) =>
    $tone === 'error' ? theme.colors.dangerSoft : $tone === 'success' ? theme.colors.successSoft : theme.colors.infoSoft};
  color: ${({ $tone, theme }) =>
    $tone === 'error' ? theme.colors.danger : $tone === 'success' ? theme.colors.success : theme.colors.textOnLight};
  font-size: 14.5px;
  line-height: 1.5;
`;

/** Errors interrupt (role=alert); confirmations are announced politely. */
export function Alert({ tone, children }: { tone: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  return (
    <AlertBox $tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </AlertBox>
  );
}

// ------------------------------------------------------------------ badges --

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const BadgeBox = styled.span<{ $tone: BadgeTone }>`
  display: inline-flex;
  justify-self: start; /* never stretch inside the stacked mobile table */
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.layout.radius};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  ${({ $tone, theme }) => {
    const map = {
      success: [theme.colors.success, theme.colors.successSoft],
      warning: [theme.colors.warning, theme.colors.warningSoft],
      danger: [theme.colors.danger, theme.colors.dangerSoft],
      neutral: [theme.colors.neutral, theme.colors.neutralSoft],
      info: [theme.colors.navy, theme.colors.infoSoft],
    } as const;
    const [fg, bg] = map[$tone];
    return css`
      color: ${fg};
      background: ${bg};
    `;
  }}

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
`;

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <BadgeBox $tone={tone}>{children}</BadgeBox>;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
  SUPER_ADMIN: 'info',
  ADMIN: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{STATUS_LABELS[status] ?? status}</Badge>;
}

// ------------------------------------------------------------------- stats --

export const StatGrid = styled.div`
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: ${({ theme }) => theme.colors.lineOnLight};
  border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  border-radius: ${({ theme }) => theme.layout.radius};
  overflow: hidden;

  @media (min-width: 760px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const StatCell = styled.div<{ $highlight?: boolean }>`
  background: ${({ $highlight, theme }) => ($highlight ? theme.colors.warningSoft : '#fff')};
  padding: 18px 20px;
  min-width: 0;

  .value {
    font-size: clamp(26px, 2vw + 14px, 34px);
    font-weight: 400;
    line-height: 1.1;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  .label {
    margin-top: 6px;
    font-size: 13.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
`;

export function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <StatCell $highlight={highlight}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </StatCell>
  );
}

// ------------------------------------------------------------------- table --

/** A table that becomes stacked label/value rows on narrow screens. Each
 *  <td> carries `data-label` with its column name. */
export const ResponsiveTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14.5px;

  th {
    text-align: left;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.mutedOnLight};
    padding: 0 12px 10px 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  }

  td {
    padding: 14px 12px 14px 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLightSoft};
    vertical-align: top;
    color: ${({ theme }) => theme.colors.bodyOnLight};
  }

  tr:last-child td {
    border-bottom: 0;
  }

  @media (max-width: 859px) {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    tr {
      display: block;
      padding: 14px 0;
      border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLight};
    }
    tr:last-child {
      border-bottom: 0;
    }
    td {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      column-gap: 12px;
      row-gap: 2px;
      padding: 5px 0;
      border: 0;
    }
    /* Everything in a cell belongs in the value column, however many pieces
       it has (name + email + date); only the label sits on the left. */
    td > * {
      grid-column: 2;
      min-width: 0;
    }
    td::before {
      grid-column: 1;
      grid-row: 1;
      content: attr(data-label);
      font-size: 12.5px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: ${({ theme }) => theme.colors.mutedOnLight};
    }
  }
`;

export const Strong = styled.span`
  display: block;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textOnLight};
  overflow-wrap: anywhere;
`;

export const Sub = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.mutedOnLight};
  overflow-wrap: anywhere;
`;

export const EmptyState = styled.div`
  padding: 28px 0 8px;
  text-align: center;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.mutedOnLight};
`;

/** Read by screen readers, invisible on screen. */
export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`;

export const Select = styled.select<{ $invalid?: boolean }>`
  ${inputStyles}
  appearance: auto;
`;
