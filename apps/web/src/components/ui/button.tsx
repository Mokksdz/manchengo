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
          "bg-[linear-gradient(135deg,#191c26_0%,#2d313f_46%,#1a1d28_100%)] text-white shadow-[0_12px_28px_rgba(18,22,33,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-[2px] hover:shadow-[0_16px_34px_rgba(18,22,33,0.22),inset_0_1px_0_rgba(255,255,255,0.16)]",
        destructive:
          "bg-[#C62828] text-white hover:bg-[#B71C1C] shadow-lg shadow-red-900/20",
        outline:
          "border border-white/85 bg-white/75 text-[#1D1D1F] backdrop-blur-[22px] shadow-[0_8px_20px_rgba(18,22,33,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] hover:-translate-y-[1px] hover:bg-white/85",
        secondary:
          "bg-white/62 text-[#1D1D1F] backdrop-blur-[18px] hover:bg-white/74",
        ghost: "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white/58",
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
