'use client';

import { useId, useRef, type ReactNode } from 'react';
import { useField } from '@/lib/useStudio';

/* ------------------------------------------------------------------ layout primitives */

export function Section({
  title,
  hint,
  defaultOpen = false,
  children,
  id,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <details className="panel" open={defaultOpen} id={id}>
      <summary>
        <span>{title}</span>
        {hint && <small>{hint}</small>}
      </summary>
      <div className="panel-body">{children}</div>
    </details>
  );
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={`row cols-${cols}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ bound fields (read/write the draft by path) */

interface Base {
  path: string;
  label: string;
  hint?: string;
}

export function TextField({
  path,
  label,
  hint,
  max,
  placeholder,
  type = 'text',
  multiline,
  rows = 3,
}: Base & {
  max?: number;
  placeholder?: string;
  type?: 'text' | 'email' | 'url' | 'tel';
  multiline?: boolean;
  rows?: number;
}) {
  const id = useId();
  const f = useField<string>(path);
  const value = f.value ?? '';
  const common = {
    id,
    value,
    maxLength: max,
    placeholder,
    'aria-invalid': f.error ? true : undefined,
    'aria-describedby': f.error ? `${id}-e` : undefined,
  } as const;
  return (
    <Field label={label} hint={hint} error={f.error} htmlFor={id}>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => f.set(e.target.value)} />
      ) : (
        <input
          {...common}
          type={type}
          autoComplete="off"
          spellCheck={type === 'text'}
          onChange={(e) => f.set(e.target.value)}
        />
      )}
      {max && value.length > max * 0.8 ? (
        <span className="counter">
          {value.length}/{max}
        </span>
      ) : null}
    </Field>
  );
}

export function SelectField<T extends string | number>({
  path,
  label,
  hint,
  options,
}: Base & { options: readonly { value: T; label: string }[] }) {
  const id = useId();
  const f = useField<T>(path);
  return (
    <Field label={label} hint={hint} error={f.error} htmlFor={id}>
      <select
        id={id}
        value={String(f.value ?? options[0]?.value)}
        onChange={(e) =>
          f.set(typeof options[0]?.value === 'number' ? Number(e.target.value) : e.target.value)
        }
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Segmented<T extends string | number>({
  path,
  label,
  hint,
  options,
}: Base & { options: readonly { value: T; label: string }[] }) {
  const f = useField<T>(path);
  const name = useId();
  return (
    <Field label={label} hint={hint} error={f.error}>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label key={String(o.value)} className={f.value === o.value ? 'on' : ''}>
            <input
              type="radio"
              name={name}
              checked={f.value === o.value}
              onChange={() => f.set(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

export function ToggleField({ path, label, hint, invert }: Base & { invert?: boolean }) {
  const id = useId();
  const f = useField<boolean>(path);
  const on = invert ? !f.value : Boolean(f.value);
  return (
    <div className="toggle">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => f.set(invert ? !e.target.checked : e.target.checked)}
      />
      <label htmlFor={id}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
    </div>
  );
}

export function RangeField({
  path,
  label,
  hint,
  min,
  max,
  step = 1,
  unit = '',
}: Base & { min: number; max: number; step?: number; unit?: string }) {
  const id = useId();
  const f = useField<number>(path);
  const value = f.value ?? min;
  return (
    <Field label={label} hint={hint} error={f.error} htmlFor={id}>
      <div className="range">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => f.set(Number(e.target.value))}
        />
        <output htmlFor={id}>
          {value}
          {unit}
        </output>
      </div>
    </Field>
  );
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function ColorField({
  path,
  label,
  hint,
  fallback = '#b34700',
  optional,
}: Base & { fallback?: string; optional?: boolean }) {
  const id = useId();
  const f = useField<string>(path);
  const value = typeof f.value === 'string' ? f.value : '';
  const shown = HEX.test(value)
    ? value.length === 4
      ? `#${[...value.slice(1)].map((c) => c + c).join('')}`
      : value
    : fallback;
  return (
    <Field label={label} hint={hint} error={f.error} htmlFor={id}>
      <div className="color">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={shown}
          onChange={(e) => f.set(e.target.value)}
        />
        <input
          id={id}
          type="text"
          value={value}
          placeholder={optional ? 'auto' : fallback}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => f.set(e.target.value.trim())}
        />
        {optional && value ? (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => f.set('')}
            aria-label={`Reset ${label}`}
          >
            Reset
          </button>
        ) : null}
      </div>
    </Field>
  );
}

export function FileButton({
  label,
  accept,
  onFile,
  disabled,
}: {
  label: string;
  accept: string;
  onFile: (f: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="btn small"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        {label}
      </button>
    </>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'bad' | 'good';
  children: ReactNode;
}) {
  return (
    <div className={`notice ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
