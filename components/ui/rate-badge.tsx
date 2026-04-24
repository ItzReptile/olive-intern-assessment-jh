import { cn } from "@/lib/utils"

type RateBadgeProps = {
  value: number
  className?: string
}

function RateBadge({ value, className }: RateBadgeProps) {
  const tone =
    value >= 70
      ? { bg: "bg-[var(--green-tint)]", fg: "text-[var(--olive-dark)]", border: "border-[var(--olive-tint-border)]", dot: "bg-[var(--olive-dark)]" }
      : value >= 40
      ? { bg: "bg-[var(--yellow-tint)]", fg: "text-[#8a6b1d]", border: "border-[var(--yellow-tint-border)]", dot: "bg-[#8a6b1d]" }
      : { bg: "bg-[var(--red-tint)]", fg: "text-[#8f3e27]", border: "border-[var(--red-tint-border)]", dot: "bg-[#8f3e27]" }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[11.5px] font-semibold tracking-[-0.01em] font-mono border",
        tone.bg,
        tone.fg,
        tone.border,
        className
      )}
    >
      <span className={cn("w-[6px] h-[6px] rounded-full", tone.dot)} />
      {value}%
    </span>
  )
}

export { RateBadge }
