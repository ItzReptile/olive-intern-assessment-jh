import * as React from "react"
import { cn } from "@/lib/utils"

type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "soft" | "olive" | "muted"
  as?: "span" | "button"
}

const variants: Record<NonNullable<PillProps["variant"]>, string> = {
  default:
    "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--border-strong)]",
  soft: "bg-transparent text-[var(--muted-fg)] border border-[var(--border)]",
  olive:
    "bg-[var(--olive-tint)] text-[var(--olive-dark)] border border-[var(--olive-tint-border)]",
  muted: "bg-[var(--muted)] text-[var(--muted-fg)] border border-[var(--border)]",
}

function Pill({ className, variant = "default", as = "span", children, ...props }: PillProps) {
  const Tag = as as any
  return (
    <Tag
      data-slot="pill"
      className={cn(
        "inline-flex items-center px-[11px] py-[5px] rounded-full text-[12.5px] font-medium tracking-[-0.005em] transition-colors",
        variants[variant],
        as === "button" && "cursor-pointer hover:bg-[var(--olive-tint)] hover:text-[var(--olive-dark)] hover:border-[var(--olive-tint-border)]",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export { Pill }
