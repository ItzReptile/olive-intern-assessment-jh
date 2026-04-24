import * as React from "react"
import { cn } from "@/lib/utils"

type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
}

function Toast({ className, children, ...props }: ToastProps) {
  return (
    <div
      data-slot="toast"
      className={cn(
        "inline-flex items-center gap-[10px] bg-[var(--foreground)] text-[var(--background)] px-4 py-[11px] rounded-lg text-[13px] font-medium shadow-toast tq-toast-in",
        className
      )}
      {...props}
    >
      <span className="w-4 h-4 rounded-full bg-[var(--olive)] text-white inline-flex items-center justify-center text-[10px] font-bold">
        ✓
      </span>
      {children}
    </div>
  )
}

export { Toast }
