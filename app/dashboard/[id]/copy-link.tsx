"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Toast } from "@/components/ui/toast"

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    const target = url.startsWith("http") ? url : `${window.location.origin}${url}`
    try {
      await navigator.clipboard.writeText(target)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={onCopy}>
        Copy link
      </Button>
      {copied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <Toast>Link copied</Toast>
        </div>
      )}
    </>
  )
}
