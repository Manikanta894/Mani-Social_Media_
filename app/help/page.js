'use client'

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-8">
      <div className="border-b border-border pb-6 mb-8">
        <h1 className="editorial-title text-2xl sm:text-3xl">Keyboard Shortcuts</h1>
        <p className="text-sm text-muted-foreground mt-1">Available global shortcuts.</p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-4 py-2 border-b border-border/50">
          <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded-sm">Ctrl+Enter</kbd>
          <span className="text-sm text-muted-foreground">Publish current post</span>
        </div>
        <div className="flex items-center gap-4 py-2 border-b border-border/50">
          <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded-sm">Ctrl+S</kbd>
          <span className="text-sm text-muted-foreground">Save draft</span>
        </div>
        <div className="flex items-center gap-4 py-2 border-b border-border/50">
          <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded-sm">Esc</kbd>
          <span className="text-sm text-muted-foreground">Cancel / Close dialog</span>
        </div>
        <div className="flex items-center gap-4 py-2 border-b border-border/50">
          <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded-sm">?</kbd>
          <span className="text-sm text-muted-foreground">Show this help</span>
        </div>
      </div>
    </div>
  )
}
