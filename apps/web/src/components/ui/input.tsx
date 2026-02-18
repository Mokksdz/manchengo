import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, Check } from "lucide-react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error message to display */
  error?: string
  /** Success state */
  success?: boolean
  /** Hint text shown below the input */
  hint?: string
  /** Label for the input (for accessibility) */
  label?: string
  /** Whether the field is required */
  required?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type,
    error,
    success,
    hint,
    label,
    required,
    id,
    "aria-describedby": ariaDescribedBy,
    ...props
  }, ref) => {
    // Generate IDs for accessibility - always call useId unconditionally
    const generatedId = React.useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const hintId = `${inputId}-hint`

    // Build aria-describedby
    const describedByIds: string[] = []
    if (ariaDescribedBy) describedByIds.push(ariaDescribedBy)
    if (error) describedByIds.push(errorId)
    if (hint && !error) describedByIds.push(hintId)
    const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#1D1D1F] mb-1.5"
          >
            {label}
            {required && (
              <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
            )}
            {required && <span className="sr-only">(requis)</span>}
          </label>
        )}

        <div className="relative">
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-10 w-full rounded-[11px] border border-white/75 bg-white/72 px-4 py-2.5 text-[15px] text-[#1D1D1F] shadow-[0_8px_20px_rgba(18,22,33,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[18px] transition-all",
              "file:border-0 file:bg-transparent file:text-[15px] file:font-medium",
              "placeholder:text-[#AEAEB2]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                : success
                ? "border-green-500 focus-visible:ring-green-500/20 focus-visible:border-green-500"
                : "focus-visible:ring-[#EC7620]/20 focus-visible:border-[#EC7620]",
              (error || success) && "pr-10",
              className
            )}
            ref={ref}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            aria-required={required}
            {...props}
          />

          {/* Status icons */}
          {error && (
            <AlertCircle
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500"
              aria-hidden="true"
            />
          )}
          {success && !error && (
            <Check
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Error message */}
        {error && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {/* Hint text (only show if no error) */}
        {hint && !error && (
          <p
            id={hintId}
            className="mt-1.5 text-sm text-[#6E6E73]"
          >
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
