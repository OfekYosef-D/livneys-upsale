import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Form primitives shared by every screen. Labels wrap their control, so no id plumbing is needed. */

type FieldShellProps = { label: string; hint?: ReactNode; className?: string; children: ReactNode };

export function FieldShell({ label, hint, className = '', children }: FieldShellProps) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="ui-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-5 text-black/45">{hint}</span>}
    </label>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue'> & {
  label: string;
  hint?: ReactNode;
  defaultValue?: string | number | null;
};

export function TextField({ label, hint, className, defaultValue, ...props }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      <input {...props} defaultValue={defaultValue ?? undefined} className="ui-field" />
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'defaultValue'> & {
  label: string;
  hint?: ReactNode;
  defaultValue?: string | null;
};

export function TextAreaField({ label, hint, className, defaultValue, rows = 3, ...props }: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      <textarea {...props} rows={rows} defaultValue={defaultValue ?? undefined} className="ui-field min-h-20 resize-y py-2" />
    </FieldShell>
  );
}

export type Option = { value: string; label: string };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'defaultValue'> & {
  label: string;
  hint?: ReactNode;
  options: readonly Option[];
  defaultValue?: string | number | null;
};

export function SelectField({ label, hint, className, options, defaultValue, ...props }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      <select {...props} defaultValue={defaultValue === null || defaultValue === undefined ? undefined : String(defaultValue)} className="ui-field">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ label, hint, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm font-medium">
      <input {...props} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-black" />
      <span>
        {label}
        {hint && <span className="block text-xs font-normal text-black/45">{hint}</span>}
      </span>
    </label>
  );
}

export function CheckboxGroup({ title, name, options, selected }: { title: string; name: string; options: readonly Option[]; selected: readonly string[] }) {
  const selectedSet = new Set(selected);
  return (
    <fieldset className="rounded-md border border-[var(--pantry-line)] p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <p className="text-[11px] text-black/45">ללא בחירה = חל על כולם</p>
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {options.length === 0 ? (
          <p className="text-xs text-black/45">אין אפשרויות</p>
        ) : (
          options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1 text-xs font-medium hover:bg-[var(--pantry-soft)]">
              <input name={name} type="checkbox" value={option.value} defaultChecked={selectedSet.has(option.value)} className="h-4 w-4 accent-black" />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </fieldset>
  );
}

/** Typed readers for uncontrolled forms. */
export const formValue = {
  text: (form: FormData, name: string): string => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  },
  number: (form: FormData, name: string): number => Number(formValue.text(form, name)),
  checkbox: (form: FormData, name: string): boolean => form.get(name) === 'on',
  list: (form: FormData, name: string): string[] => form.getAll(name).filter((value): value is string => typeof value === 'string' && value.length > 0),
};
