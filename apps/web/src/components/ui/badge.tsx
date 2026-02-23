import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-black/5 bg-gray-500/10 text-[#6E6E73]",
        secondary:
          "border-black/5 bg-[#F5F5F5] text-[#6E6E73]",
        destructive:
          "border-red-500/20 bg-red-500/10 text-[#C62828]",
        outline: "text-[#1D1D1F] border-[#E5E5E5]",
        success:
          "border-emerald-500/20 bg-emerald-500/10 text-[#2E7D32]",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-[#F57F17]",
        info:
          "border-blue-500/20 bg-blue-500/10 text-[#1565C0]",
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
