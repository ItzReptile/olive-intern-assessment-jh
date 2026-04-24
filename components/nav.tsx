import Link from "next/link"
import { cn } from "@/lib/utils"
import { Wordmark } from "@/components/ui/wordmark"

type NavProps = {
  active?: "home" | "dashboard" | "docs"
  mobile?: boolean
  showDashboard?: boolean
  className?: string
}

function Nav({ active, mobile = false, showDashboard = true, className }: NavProps) {
  if (mobile) {
    return (
      <nav
        className={cn(
          "flex justify-between items-center px-5 py-[14px] border-b border-[var(--border)] bg-[var(--background)]",
          className
        )}
      >
        <Link href="/" aria-label="Home">
          <Wordmark size={17} />
        </Link>
        <div className="flex gap-5 items-center text-[13px]">
          {showDashboard && (
            <Link
              href={active === "dashboard" ? "/" : "/dashboard"}
              className={cn(
                "no-underline transition-colors hover:text-[var(--foreground)]",
                active === "dashboard" ? "text-[var(--foreground)]" : "text-[var(--muted-fg)]"
              )}
            >
              {active === "dashboard" ? "Home" : "Dashboard"}
            </Link>
          )}
          <Link
            href="/docs"
            className={cn(
              "no-underline transition-colors hover:text-[var(--foreground)]",
              active === "docs" ? "text-[var(--foreground)]" : "text-[var(--muted-fg)]"
            )}
          >
            Docs
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <nav
      className={cn(
        "flex justify-between items-center px-12 py-[18px] border-b border-[var(--border)]",
        className
      )}
    >
      <Link href="/" aria-label="Home">
        <Wordmark size={20} />
      </Link>
      <div className="flex gap-7 items-center text-[13.5px]">
        <Link
          href="/"
          className={cn(
            "no-underline transition-colors hover:text-[var(--foreground)]",
            active === "home" ? "text-[var(--foreground)]" : "text-[var(--muted-fg)]"
          )}
        >
          Home
        </Link>
        {showDashboard && (
          <Link
            href="/dashboard"
            className={cn(
              "no-underline transition-colors hover:text-[var(--foreground)]",
              active === "dashboard" ? "text-[var(--foreground)]" : "text-[var(--muted-fg)]"
            )}
          >
            Dashboard
          </Link>
        )}
        <Link
          href="/docs"
          className={cn(
            "no-underline transition-colors hover:text-[var(--foreground)]",
            active === "docs" ? "text-[var(--foreground)]" : "text-[var(--muted-fg)]"
          )}
        >
          Docs
        </Link>
        <div className="w-7 h-7 rounded-full bg-[var(--olive-tint)] border border-[var(--olive-tint-border)] text-[var(--olive-dark)] flex items-center justify-center text-[11px] font-semibold">
          JM
        </div>
      </div>
    </nav>
  )
}

export { Nav }
