import * as React from "react"
import { cn } from "@/lib/utils"

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: number | string
  hoverable?: boolean
}

function Card({ className, padding, hoverable, style, ...props }: CardProps) {
  const mergedStyle: React.CSSProperties = {
    padding: typeof padding === "number" ? `${padding}px` : padding,
    ...style,
  }
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-card transition-shadow",
        hoverable && "hover:shadow-card-hover",
        className
      )}
      style={mergedStyle}
      {...props}
    />
  )
}

export { Card }
