import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC7620]/20 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#1D1D1F] text-white hover:bg-[#333336]",
        destructive:
          "bg-[#C62828] text-white hover:bg-[#B71C1C]",
        outline:
          "border border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] text-[#1D1D1F]",
        secondary:
          "bg-[#F5F5F5] text-[#1D1D1F] hover:bg-[#E5E5E5]",
        ghost: "hover:bg-[#F5F5F5] text-[#6E6E73] hover:text-[#1D1D1F]",
        link: "text-[#EC7620] underline-offset-4 hover:underline",
        amber: "bg-[#EC7620] text-white hover:bg-[#DD5C16]",
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
