import { cn } from "@/lib/utils"

type SpinnerProps = {
  size?: number
  className?: string
}

function Spinner({ size = 14, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block tq-spin rounded-full border-2 border-current border-r-transparent", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  )
}

export { Spinner }
