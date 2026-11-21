'use client';

import React from 'react';
import styled from 'styled-components';
import { CATEGORY_LABELS, DESCRIPTION_MAX_LENGTH, MIN_REPORT_DATE, REPORT_CATEGORIES, TITLE_MAX_LENGTH } from '@/lib/reports/constants';
import type { FieldErrors } from '@/lib/validation/auth';
import { reportDetailsSchema } from '@/lib/validation/reports';
import { toFieldErrors } from '@/lib/validation/auth';
import { Field, Input, Select, Textarea } from './ui';

// Title, category, report date and description — shared by the upload form
// and the edit page, validated in the browser with the server's own schema.

export interface ReportDetailsValues {
  title: string;
  category: string;
  reportDate: string;
  description: string;
}

const Row = styled.div`
  display: grid;
  gap: 18px;
  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`;

/** Same rules as the server; returns null when valid. */
export function validateDetails(values: ReportDetailsValues): FieldErrors | null {
  const parsed = reportDetailsSchema.safeParse(values);
  return parsed.success ? null : toFieldErrors(parsed.error);
}

interface Props {
  values: ReportDetailsValues;
  onChange: (values: ReportDetailsValues) => void;
  errors: FieldErrors;
  /** 'YYYY-MM-DD' — today in India, the latest allowed report date. */
  today: string;
  disabled?: boolean;
}

export default function ReportDetailsFields({ values, onChange, errors, today, disabled }: Props) {
  const set = (key: keyof ReportDetailsValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...values, [key]: e.target.value });

  return (
    <>
      <Field label="Title" hint="Shown on the website and used in the report's web address." errors={errors.title}>
        {(p) => (
          <Input {...p} name="title" value={values.title} onChange={set('title')} maxLength={TITLE_MAX_LENGTH} disabled={disabled} $invalid={p['aria-invalid']} required />
        )}
      </Field>

      <Row>
        <Field label="Category" errors={errors.category}>
          {(p) => (
            <Select {...p} name="category" value={values.category} onChange={set('category')} disabled={disabled} $invalid={p['aria-invalid']} required>
              <option value="" disabled>
                Choose a category
              </option>
              {REPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Report date" hint="The date the report is for — not the upload date. 1 Jan 2000 to today." errors={errors.reportDate}>
          {(p) => (
            <Input
              {...p}
              type="date"
              name="reportDate"
              value={values.reportDate}
              onChange={set('reportDate')}
              min={MIN_REPORT_DATE}
              max={today}
              disabled={disabled}
              $invalid={p['aria-invalid']}
              required
            />
          )}
        </Field>
      </Row>

      <Field label="Description (optional)" hint="A short summary shown on the report page." errors={errors.description}>
        {(p) => (
          <Textarea
            {...p}
            name="description"
            value={values.description}
            onChange={set('description')}
            maxLength={DESCRIPTION_MAX_LENGTH}
            rows={4}
            disabled={disabled}
            $invalid={p['aria-invalid']}
          />
        )}
      </Field>
    </>
  );
}
