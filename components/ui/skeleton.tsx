import * as React from "react"
import { cn } from "@/lib/utils"

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  w?: number | string
  h?: number | string
  r?: number
}

function Skeleton({ w = "100%", h = 12, r = 4, className, style, ...props }: SkeletonProps) {
  const mergedStyle: React.CSSProperties = {
    width: typeof w === "number" ? `${w}px` : w,
    height: typeof h === "number" ? `${h}px` : h,
    borderRadius: `${r}px`,
    backgroundImage: "linear-gradient(90deg, var(--border) 0%, #efeadf 50%, var(--border) 100%)",
    backgroundSize: "200% 100%",
    animation: "tq-shimmer 1.6s ease-in-out infinite",
    ...style,
  }
  return <div className={cn(className)} style={mergedStyle} {...props} />
}

export { Skeleton }
