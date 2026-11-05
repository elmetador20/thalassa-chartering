// Shared shape for server-action form state, used by `useFormState`.
// Never carries a password: `values` holds only fields safe to echo back so a
// form submitted without JavaScript can be re-filled.

import type { FieldErrors } from './validation/auth';

export interface FormState {
  status: 'idle' | 'error' | 'success';
  /** Form-level message (e.g. "Invalid email or password."). */
  message?: string;
  fieldErrors?: FieldErrors;
  values?: Record<string, string>;
}

export const IDLE_FORM_STATE: FormState = { status: 'idle' };

/** Result of a one-shot action such as "approve". */
export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Reads the named text fields of a submitted form. Files and missing fields
 *  become empty strings, so schemas always receive strings. */
export function readFormFields<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}
