import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[12px] text-[14px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EC7620] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,#191c26_0%,#2d313f_46%,#1a1d28_100%)] text-white shadow-[0_12px_28px_rgba(18,22,33,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-[2px] hover:shadow-[0_16px_34px_rgba(18,22,33,0.22),inset_0_1px_0_rgba(255,255,255,0.16)] dark:bg-[linear-gradient(135deg,#e8e8ec_0%,#d4d4da_46%,#e0e0e6_100%)] dark:text-[#111118] dark:shadow-[0_12px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] dark:hover:shadow-[0_16px_34px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]",
        destructive:
          "bg-[#C62828] text-white hover:bg-[#B71C1C] shadow-lg shadow-red-900/20",
        outline:
          "border border-[var(--glass-border-muted)] bg-[var(--glass-pill-bg)] text-[var(--text-primary)] backdrop-blur-[22px] shadow-[0_8px_20px_rgba(18,22,33,0.08),inset_0_1px_0_var(--glass-inset)] hover:-translate-y-[1px] hover:bg-[var(--glass-bg-hover)]",
        secondary:
          "bg-[var(--glass-bg-muted)] text-[var(--text-primary)] backdrop-blur-[18px] hover:bg-[var(--glass-bg-hover)]",
        ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-muted)]",
        link: "text-[#EC7620] underline-offset-4 hover:underline",
        amber: "bg-[linear-gradient(135deg,#ec7620_0%,#f58b34_50%,#dd5c16_100%)] text-white shadow-lg shadow-[#EC7620]/30 hover:-translate-y-[2px] hover:shadow-xl hover:shadow-[#EC7620]/40",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-8 rounded-[8px] px-3 text-[13px]",
        lg: "h-11 rounded-[10px] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
