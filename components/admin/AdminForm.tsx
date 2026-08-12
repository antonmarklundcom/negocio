'use client';

import { useFormState, useFormStatus } from 'react-dom';

/**
 * THE ONLY CLIENT COMPONENT IN THE ADMIN.
 *
 * Justification: `useFormState` keeps the submitted values on the DOM and
 * renders field errors inline when validation fails. The server-only
 * alternative — throwing to the nearest `error.tsx` — discards everything the
 * user typed on every mistake.
 *
 * Every admin form in this app reuses this instance. A second form component
 * would mean a second validation style, and the pure tests in
 * `tests/validation.test.ts` would not cover it.
 *
 * `useFormState` (not React 19's `useActionState`) because this app is on
 * React 18 / Next 14 — the Next upgrade is its own PR in Phase C.
 */

export type FieldDef =
  | { type: 'text' | 'email' | 'url' | 'password'; name: string; label: string; required?: boolean; maxLength?: number; hint?: string; autoComplete?: string }
  | { type: 'number'; name: string; label: string; required?: boolean; min?: number; max?: number; hint?: string }
  | { type: 'textarea'; name: string; label: string; rows?: number; maxLength?: number; hint?: string }
  | {
      type: 'select';
      name: string;
      label: string;
      options: { value: string; label: string }[];
      required?: boolean;
      /**
       * Rendered as the EMPTY leading option. Never a fabricated default — an
       * unselected select must be able to exist and must fail validation.
       */
      placeholder?: string;
      hint?: string;
    }
  | { type: 'checkbox'; name: string; label: string; hint?: string };

export interface AdminFormState {
  errors?: Record<string, string>;
  formError?: string;
  notice?: string;
}

export type AdminFormAction = (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;

export interface AdminFormProps {
  fields: FieldDef[];
  action: AdminFormAction;
  submitLabel: string;
  /**
   * `Record<string, unknown>` on purpose: an entity row is spread straight in
   * and carries `Date`s and enum unions the form never renders. Only keys
   * matching a field `name` are read.
   */
  defaultValues?: Record<string, unknown>;
  children?: React.ReactNode;
}

const EMPTY: AdminFormState = {};

export function AdminForm({ fields, action, submitLabel, defaultValues = {}, children }: AdminFormProps) {
  const [state, formAction] = useFormState(action, EMPTY);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError && (
        <p role="alert" className="rounded-card border border-terra bg-terra/10 px-4 py-3 text-[14px] text-ink">
          {state.formError}
        </p>
      )}
      {state.notice && (
        <p role="status" className="rounded-card border border-line bg-white px-4 py-3 text-[14px] text-ink">
          {state.notice}
        </p>
      )}

      {fields.map((field) => (
        <Field key={field.name} field={field} error={state.errors?.[field.name]} defaultValues={defaultValues} />
      ))}

      {children}

      <SubmitButton label={submitLabel} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-card bg-blue px-5 py-3 text-sm font-bold text-white hover:bg-blued disabled:opacity-60"
    >
      {pending ? 'Guardando…' : label}
    </button>
  );
}

function Field({
  field,
  error,
  defaultValues,
}: {
  field: FieldDef;
  error?: string;
  defaultValues: Record<string, unknown>;
}) {
  const id = `field-${field.name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hint = 'hint' in field ? field.hint : undefined;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  const raw = defaultValues[field.name];
  const defaultValue = raw === null || raw === undefined ? '' : String(raw);

  const inputClass =
    'w-full rounded-card border bg-white px-3 py-2.5 text-[15px] outline-none focus:border-blue ' +
    (error ? 'border-terra' : 'border-line');

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-bold">
        {field.label}
        {'required' in field && field.required && <span className="text-terra"> *</span>}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          id={id}
          name={field.name}
          rows={field.rows ?? 4}
          maxLength={field.maxLength}
          defaultValue={defaultValue}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={inputClass}
        />
      ) : field.type === 'select' ? (
        <select
          id={id}
          name={field.name}
          defaultValue={defaultValue}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={inputClass}
        >
          {/* The empty option is the unselected state. It has no value, so a
              form submitted without a choice fails validation rather than
              silently taking the first option. */}
          <option value="">{field.placeholder ?? '— Elegí una opción —'}</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === 'checkbox' ? (
        <input
          id={id}
          name={field.name}
          type="checkbox"
          defaultChecked={raw === true || raw === 1 || raw === 'on'}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="h-5 w-5 rounded border-line"
        />
      ) : (
        <input
          id={id}
          name={field.name}
          type={field.type}
          required={false}
          maxLength={'maxLength' in field ? field.maxLength : undefined}
          min={field.type === 'number' ? field.min : undefined}
          max={field.type === 'number' ? field.max : undefined}
          autoComplete={'autoComplete' in field ? field.autoComplete : undefined}
          defaultValue={field.type === 'password' ? '' : defaultValue}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={inputClass}
        />
      )}

      {hint && (
        <p id={hintId} className="mt-1 text-[13px] text-ink2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-[13px] font-medium text-terra">
          {error}
        </p>
      )}
    </div>
  );
}
