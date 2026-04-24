import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-[7px] rounded-[7px] font-medium tracking-[-0.005em] whitespace-nowrap transition-all outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[var(--olive-tint)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--olive)] text-white border border-[var(--olive-dark)] hover:bg-[var(--olive-dark)] shadow-[0_1px_0_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)]",
        default:
          "bg-[var(--olive)] text-white border border-[var(--olive-dark)] hover:bg-[var(--olive-dark)] shadow-[0_1px_0_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.1)]",
        secondary:
          "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--muted)] hover:border-[var(--border-strong)]",
        outline:
          "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--muted)] hover:border-[var(--border-strong)]",
        ghost:
          "bg-transparent text-[var(--foreground)] border border-transparent hover:bg-[var(--muted)]",
        destructive:
          "bg-[var(--surface)] text-[var(--red)] border border-[var(--border)] hover:bg-[var(--red-tint)]",
        link: "text-[var(--olive-dark)] underline-offset-4 hover:underline border border-transparent",
      },
      size: {
        sm: "h-[30px] px-3 text-[12.5px]",
        default: "h-[38px] px-[18px] text-[13.5px]",
        md: "h-[38px] px-[18px] text-[13.5px]",
        lg: "h-[46px] px-[22px] text-[14.5px]",
        icon: "h-[38px] w-[38px] p-0",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      full: false,
    },
  }
)

function Button({
  className,
  variant,
  size,
  full,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, full, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
