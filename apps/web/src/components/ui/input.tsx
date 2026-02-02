import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-[#E5E5E5] bg-white px-4 py-2.5 text-[15px] text-[#1D1D1F] transition-colors file:border-0 file:bg-transparent file:text-[15px] file:font-medium placeholder:text-[#AEAEB2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC7620]/20 focus-visible:border-[#EC7620] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
