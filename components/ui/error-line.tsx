import * as React from "react"
import { cn } from "@/lib/utils"

type ErrorLineProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
}

function ErrorLine({ className, children, ...props }: ErrorLineProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 bg-[var(--red-tint)] border border-[var(--red-tint-border)] rounded-[7px] px-3 py-[9px] text-[12.5px] leading-[1.4] text-[#7c361f]",
        className
      )}
      {...props}
    >
      <span className="flex-shrink-0 mt-[1px] w-[14px] h-[14px] rounded-full bg-[var(--red)] text-white inline-flex items-center justify-center text-[9px] font-bold">
        !
      </span>
      <span>{children}</span>
    </div>
  )
}

export { ErrorLine }
