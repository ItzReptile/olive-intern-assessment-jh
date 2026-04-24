import { cn } from "@/lib/utils"

type WordmarkProps = {
  size?: number
  muted?: boolean
  className?: string
}

function Wordmark({ size = 20, muted = false, className }: WordmarkProps) {
  return (
    <div
      className={cn(
        "inline-flex items-baseline tracking-[-0.01em] font-serif",
        muted ? "text-[var(--muted-fg)]" : "text-[var(--foreground)]",
        className
      )}
      style={{ fontSize: `${size}px` }}
    >
      <span className="italic">Text</span>
      <span
        className="font-sans font-medium text-[var(--muted-fg)] px-1"
        style={{ fontSize: `${size * 0.7}px` }}
      >
        to
      </span>
      <span>Quiz</span>
    </div>
  )
}

export { Wordmark }
