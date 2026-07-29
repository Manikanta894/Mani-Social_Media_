'use client'

export default function ChangelogPage() {
  const entries = [
    { date: '2026-07-29', version: '0.5.0', title: 'Seasonal Intelligence Engine', items: ['Expanded event database (52 events across global/Indian/industry)', 'AI-powered event analysis with relevance scoring', 'Isolated seasonal queue with full status pipeline', 'Custom events CRUD and Telegram approval cards'] },
    { date: '2026-07-28', version: '0.4.0', title: 'Frontend split + enhancements', items: ['Split monolithic SPA into 15 individual Next.js routes', 'Compose carousel mode (2-10 images)', 'URL extraction for context-free captioning', 'Tone slider (casual ↔ formal)', 'Compliance checks for stats/claims'] },
    { date: '2026-07-27', version: '0.3.0', title: 'Blog + Analytics + Auth', items: ['Blog push with Hashnode integration', 'Analytics dashboard with charts', 'TOTP MFA authentication', 'Self-healing automation (health check, circuit breaker)'] },
    { date: '2026-07-26', version: '0.2.0', title: 'Bulk Posts + Comments', items: ['Bulk post creator with CSV import', 'Unified engagement inbox', 'First-comment scheduling', 'Channel groups support'] },
    { date: '2026-07-25', version: '0.1.0', title: 'Initial release', items: ['AI caption generation (Gemini/OpenAI/Anthropic/Groq)', 'Multi-platform publishing (LinkedIn/Instagram/Facebook/Threads)', 'Prompt style management', 'Supabase backend with RLS'] },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-8">
      <div className="border-b border-border pb-6 mb-8">
        <h1 className="editorial-title text-2xl sm:text-3xl">Build Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Private changelog — every update, every fix.</p>
      </div>
      <div className="space-y-8">
        {entries.map((entry, i) => (
          <div key={i} className="border-l-2 border-accent/30 pl-4">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="editorial-mono text-[0.625rem] text-muted-foreground">{entry.date}</span>
              <span className="editorial-mono text-[0.5rem] text-accent border border-accent/30 px-1.5 py-0.5 rounded-sm">{entry.version}</span>
            </div>
            <h2 className="text-base font-serif font-semibold mb-2">{entry.title}</h2>
            <ul className="space-y-1">
              {entry.items.map((item, j) => (
                <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-accent mt-1">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
