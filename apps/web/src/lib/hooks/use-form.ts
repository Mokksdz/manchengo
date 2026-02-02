'use client';

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

/**
 * Lightweight form hook for Manchengo ERP
 *
 * Provides Zod-based validation without react-hook-form dependency.
 * Drop-in replacement for manual useState-per-field pattern.
 *
 * Usage:
 *   const form = useForm({
 *     schema: z.object({ name: z.string().min(1), email: z.string().email() }),
 *     defaultValues: { name: '', email: '' },
 *   });
 *
 *   <input value={form.values.name} onChange={e => form.setValue('name', e.target.value)} />
 *   {form.errors.name && <span>{form.errors.name}</span>}
 *   <button onClick={() => form.handleSubmit(onSubmit)} disabled={form.isSubmitting}>
 */

type FormErrors<T> = Partial<Record<keyof T, string>>;

interface UseFormOptions<T extends z.ZodObject<z.ZodRawShape>> {
  schema: T;
  defaultValues: z.infer<T>;
}

interface UseFormReturn<T extends Record<string, unknown>> {
  values: T;
  errors: FormErrors<T>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, message: string) => void;
  clearErrors: () => void;
  touch: (field: keyof T) => void;
  reset: (values?: T) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => Promise<void>;
  getFieldProps: (field: keyof T) => {
    value: T[keyof T];
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    onBlur: () => void;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  };
}

export function useForm<T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues,
}: UseFormOptions<T>): UseFormReturn<z.infer<T>> {
  type Values = z.infer<T>;

  const [values, setValuesState] = useState<Values>(defaultValues);
  const [errors, setErrors] = useState<FormErrors<Values>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialValues] = useState(defaultValues);

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  );

  const validate = useCallback(
    (vals: Values): FormErrors<Values> => {
      const result = schema.safeParse(vals);
      if (result.success) return {};

      const fieldErrors: FormErrors<Values> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof Values;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return fieldErrors;
    },
    [schema],
  );

  const isValid = useMemo(() => {
    const result = schema.safeParse(values);
    return result.success;
  }, [schema, values]);

  const setValue = useCallback(<K extends keyof Values>(field: K, value: Values[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    setErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  }, []);

  const setValues = useCallback((partial: Partial<Values>) => {
    setValuesState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setError = useCallback((field: keyof Values, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearErrors = useCallback(() => setErrors({}), []);

  const touch = useCallback((field: keyof Values) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const reset = useCallback(
    (newValues?: Values) => {
      setValuesState(newValues ?? defaultValues);
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    },
    [defaultValues],
  );

  const handleSubmit = useCallback(
    async (onSubmit: (values: Values) => Promise<void> | void) => {
      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Record<keyof Values, boolean>,
      );
      setTouched(allTouched);

      // Validate
      const validationErrors = validate(values);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate],
  );

  const getFieldProps = useCallback(
    (field: keyof Values) => ({
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        setValue(field, val as Values[keyof Values]);
      },
      onBlur: () => touch(field),
      'aria-invalid': !!errors[field] && !!touched[field],
      'aria-describedby': errors[field] && touched[field] ? `${String(field)}-error` : undefined,
    }),
    [values, errors, touched, setValue, touch],
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    setValue,
    setValues,
    setError,
    clearErrors,
    touch,
    reset,
    handleSubmit,
    getFieldProps,
  };
}
