import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#F5F5F5] text-[#6E6E73]",
        secondary:
          "border-transparent bg-[#F5F5F5] text-[#6E6E73]",
        destructive:
          "border-transparent bg-[#FFEBEE] text-[#C62828]",
        outline: "text-[#1D1D1F] border-[#E5E5E5]",
        success:
          "border-transparent bg-[#E8F5E9] text-[#2E7D32]",
        warning:
          "border-transparent bg-[#FFF8E1] text-[#F57F17]",
        info:
          "border-transparent bg-[#E3F2FD] text-[#1565C0]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
