import * as React from "react"
import { cn } from "@/lib/utils"

type MicroLabelProps = React.HTMLAttributes<HTMLSpanElement>

function MicroLabel({ className, children, ...props }: MicroLabelProps) {
  return (
    <span
      className={cn(
        "font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--muted-fg)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

type MonoURLProps = React.HTMLAttributes<HTMLSpanElement>

function MonoURL({ className, children, ...props }: MonoURLProps) {
  return (
    <span
      className={cn(
        "font-mono text-[11.5px] tracking-[-0.01em] text-[var(--muted-fg)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

type StatProps = {
  label: string
  value: React.ReactNode
  delta?: string
  mono?: boolean
  className?: string
}

function Stat({ label, value, delta, mono = true, className }: StatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <MicroLabel className="whitespace-nowrap">{label}</MicroLabel>
      <div
        className={cn(
          "mt-[6px] text-[26px] leading-none tracking-[-0.02em] text-[var(--foreground)] font-medium",
          mono ? "font-mono" : "font-sans"
        )}
      >
        {value}
      </div>
      {delta && (
        <div className="mt-[6px] text-[11.5px] text-[var(--olive-dark)] font-mono whitespace-nowrap">
          {delta}
        </div>
      )}
    </div>
  )
}

export { MicroLabel, MonoURL, Stat }
