"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ErrorLine } from "@/components/ui/error-line"
import { MicroLabel } from "@/components/ui/typography"
import { cn } from "@/lib/utils"

export function DeleteQuizButton({ quizId, title }: { quizId: string; title: string }) {
  const router = useRouter()
  const [isCreator, setIsCreator] = useState(false)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("createdQuizzes")
      const list: string[] = raw ? JSON.parse(raw) : []
      setIsCreator(list.includes(quizId))
    } catch {
      setIsCreator(false)
    }
  }, [quizId])

  async function handleDelete() {
    setDeleting(true)
    setError("")
    try {
      const res = await fetch(`/api/quiz/${quizId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")

      // Remove from the creator's localStorage so the quiz stops showing
      // edit/delete affordances.
      try {
        const raw = window.localStorage.getItem("createdQuizzes")
        const list: string[] = raw ? JSON.parse(raw) : []
        window.localStorage.setItem(
          "createdQuizzes",
          JSON.stringify(list.filter((id) => id !== quizId))
        )
      } catch {
        /* ignore */
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Delete failed")
      setDeleting(false)
    }
  }

  if (!isCreator) return null

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>

      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (deleting) return
          setOpen(next)
          if (!next) setError("")
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-[rgba(31,29,26,0.4)] backdrop-blur-[2px] tq-fade-in" />
          <Dialog.Popup
            className={cn(
              "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[min(calc(100vw-32px),440px)]",
              "bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-result",
              "tq-scale-in"
            )}
          >
            <div className="px-6 pt-6 pb-5 border-b border-[var(--border)]">
              <MicroLabel className="!text-[var(--red)]">Delete quiz</MicroLabel>
              <Dialog.Title className="font-serif text-[26px] font-normal tracking-[-0.02em] leading-[1.15] mt-2 mb-0">
                Delete &ldquo;{title}&rdquo;?
              </Dialog.Title>
              <Dialog.Description className="text-[13.5px] text-[var(--muted-fg)] leading-[1.5] mt-3 mb-0">
                The quiz and every response it has collected will be permanently removed. This cannot be undone.
              </Dialog.Description>
            </div>
            {error && (
              <div className="px-6 pt-4">
                <ErrorLine>{error}</ErrorLine>
              </div>
            )}
            <div className="px-6 py-4 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-2 rounded-b-[12px]">
              <Dialog.Close
                render={
                  <Button variant="secondary" size="sm" disabled={deleting}>
                    Cancel
                  </Button>
                }
              />
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <Spinner size={12} /> Deleting…
                  </>
                ) : (
                  "Delete quiz"
                )}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
