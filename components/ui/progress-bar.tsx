import { cn } from "@/lib/utils"

type ProgressBarProps = {
  value?: number
  height?: number
  track?: boolean
  className?: string
}

function ProgressBar({ value = 0, height = 4, track = true, className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        "w-full rounded-full overflow-hidden",
        track ? "bg-[var(--border)]" : "bg-transparent",
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div
        className="h-full bg-[var(--olive)] rounded-full"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          transition: "width 0.4s cubic-bezier(.2,.7,.3,1)",
        }}
      />
    </div>
  )
}

export { ProgressBar }
