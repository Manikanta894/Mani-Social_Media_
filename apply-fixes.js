const fs = require('fs')
const path = require('path')

const T = 'C:\\Users\\Manikanta\\AppData\\Local\\Temp'
const R = 'D:\\Portfolio\\Ishaan Social Forage'

function rd(f) { return fs.readFileSync(f, 'utf8') }
function wr(f, c) { fs.writeFileSync(f, c) }
function sigOK(content, sig) { return content.includes(sig) }

// [tempFile, targetPath, signature]
const MAP = [
  ['generate (1).js', 'lib/seasonal-db.js', 'EVENT_CATEGORIES'],
  ['drip.js', 'lib/ai/drip.js', 'generateDripPosts'],
  ['backup.js', 'lib/ai/topic-generator.js', 'analyzeImage'],
  ['benchmarking.js', 'lib/ai/prompts.js', 'BANNED_WORDS'],
  ['prompts.js', 'lib/ai/generate.js', 'runGeneration'],
  ['generate.js', 'lib/ai/modules.js', 'DEFAULT_MODULES'],
  ['index (1).js', 'lib/backup.js', 'exportAllData'],
  ['auth.js', 'lib/benchmarking.js', 'getPostingGap'],
  ['automation.js', 'lib/mentions.js', 'checkMentions'],
  ['event-engine.js', 'lib/blog/intake.js', 'syncBlogToQueue'],
  ['client.js', 'lib/seasonal-engine.js', 'detectUpcomingEvents'],
  ['formatter (2).js', 'lib/observance.js', 'checkObservance'],
  ['handler.js', 'lib/scheduler.js', 'publishSweep'],
  ['analytics.js', 'lib/evergreen.js', 'findEvergreenCandidates'],
  ['mastodon.js', 'lib/event-engine.js', 'emitEvent'],
  ['bluesky.js', 'lib/telegram/client.js', 'sendMessage'],
  ['facebook.js', 'lib/telegram/formatter.js', 'formatDraftMessage'],
  ['linkedin.js', 'lib/telegram/handler.js', 'handleUpdate'],
  ['index (5).js', 'lib/publishers/index.js', 'publishJob'],
  ['ai-decision.js', 'lib/publishers/google_business_profile.js', 'publishToGoogleBusinessProfile'],
  ['generate (6).js', 'lib/publishers/threads.js', 'publishToThreads'],
  ['threads.js', 'lib/publishers/instagram.js', 'publishToInstagram'],
  ['google_business_profile.js', 'lib/publishers/mastodon.js', 'publishToMastodon'],
  ['self-heal.js', 'lib/publishers/bluesky.js', 'publishToBluesky'],
  ['automation (4).js', 'lib/publishers/facebook.js', 'publishToFacebook'],
  ['storage.js', 'lib/publishers/linkedin.js', 'publishToLinkedIn'],
  ['campaign.js', 'lib/publishers/hashnode.js', 'publishToHashnode'],
  ['hashnode.js', 'lib/analytics.js', 'fetchAllStats'],
  ['conflicts.js', 'lib/self-heal.js', 'healthCheck'],
  ['monitor.js', 'lib/automation.js', 'runTick'],
  ['publish-all.js', 'lib/storage.js', 'ENV_KEY_BY_TYPE'],
  ['migration.js', 'lib/news/campaign.js', 'startOrContinueCampaign'],
  ['intake (8).js', 'lib/migration.js', 'migrateAllToSheets'],
  ['content-library.js', 'lib/utils.js', 'twMerge'],
  ['keyboard-shortcuts.js', 'lib/media.js', 'uploadBase64Image'],
  ['sw.js', 'lib/content-pillars.js', 'DEFAULT_PILLARS'],
  ['manifest.json', 'lib/auth.js', 'verifySession'],
  ['cron.sql', 'lib/comments/fetchers.js', 'fetchRssFeed'],
  ['schema.sql', 'lib/media-store.js', 'mediaStore'],
  ['run-this.sql', 'lib/table.js', 'syncMirrorSheet'],
  ['content-library.sql', 'lib/intake.js', 'syncIntakeToQueue'],
  ['__init__ (2).py', 'lib/content-library.js', 'getLibrary'],
  ['backend_test.py', 'lib/keyboard-shortcuts.js', 'useKeyboardShortcuts'],
  ['intake.js', 'lib/gsheets.js', 'SHEETS_BASE'],
  ['fetchers.js', 'lib/news/monitor.js', 'runNewsCheck'],
  ['media.js', 'lib/news/ai-decision.js', 'runNewsDecisionPipeline'],
  ['media-store.js', 'lib/news/publish-all.js', 'runNewsPublishAll'],
  ['table.js', 'lib/news/seed.js', 'seedNewsSources'],
  ['auth (7).js', 'lib/news/conflicts.js', 'detectConflicts'],
  ['utils.js', 'lib/news/index.js', 'generateAndSave'],
  ['evergreen.js', 'lib/blog/generate.js', 'generateArticle'],
  ['scheduler.js', 'lib/blog/automation.js', 'runBlogTick'],
  ['observance.js', 'lib/blog/formatter.js', 'formatBlogMessage'],
  ['page (13).js', 'package.json', 'nextjs-mongo-template'],
  ['studio-components.js', 'next.config.js', "output: 'standalone'"],
  ['page (12).js', 'jsconfig.json', 'baseUrl'],
  ['page (11).js', 'components.json', 'ui.shadcn'],
  ['page (15).js', 'postcss.config.js', 'tailwindcss'],
  ['coach.js', 'tailwind.config.js', 'Space Grotesk'],
  ['components.js', 'app/globals.css', '@tailwind base'],
  ['globals.css', 'middleware.js', 'session cookie gate'],
  ['route (17).js', 'app/api/[[...path]]/route.js', 'sheets_configured'],
  ['page (18).js', 'app/bio/page.js', 'BioPage'],
  ['page (20).js', 'app/hashtags/page.js', 'HashtagsPage'],
  ['page (21).js', 'app/page.js', 'DashboardPage'],
  ['page (23).js', 'app/automation/page.js', 'AutomationPage'],
  ['progress.jsx', 'app/blog-automation/page.js', 'BlogAutomationPage'],
  ['page (25).js', 'app/blog/page.js', 'BlogPage'],
  ['layout.js', 'app/blog/studio-components.js', 'SeoPanel'],
  ['page (28).js', 'app/compose/page.js', 'ComposePage'],
  ['page (30).js', 'app/compose/canvas-components.js', 'QuickStartCanvas'],
  ['page (29).js', 'app/compose/coach.js', 'inlineIssues'],
  ['toast.jsx', 'app/news/page.js', 'NewsRadarPage'],
  ['carousel.jsx', 'app/settings/page.js', 'SettingsPage'],
  ['table.jsx', 'app/login/page.js', 'LoginPage'],
  ['toggle-group.jsx', 'app/layout.js', 'RootLayout'],
  ['resizable.jsx', 'app/calendar/page.js', 'CalendarPage'],
  ['pagination.jsx', 'app/commcenter/page.js', 'CommCenterPage'],
  ['breadcrumb.jsx', 'app/commcenter/components.js', 'CommCard'],
  ['sidebar.jsx', 'app/events/page.js', 'EventsPage'],
  ['separator.jsx', 'app/seasonal/page.js', 'SeasonalDashboard'],
  ['navigation-menu.jsx', 'app/comments/page.js', 'InboxPage'],
  ['context-menu.jsx', 'app/help/page.js', 'HelpPage'],
  ['alert.jsx', 'app/changelog/page.js', 'ChangelogPage'],
  ['chart.jsx', 'app/approve/page.js', 'ApprovePage'],
  ['error-boundary.js', 'app/bulk/page.js', 'BulkPage'],
  ['hover-card.jsx', 'components/error-boundary.js', 'ErrorBoundary'],
  ['package-lock.json', 'package-lock.json', 'lockfileVersion'],
  ['jsconfig.json', 'public/manifest.json', 'SocialForge'],
]

let ok = 0, fail = 0
for (const [src, dst, sig] of MAP) {
  const sp = path.join(T, src)
  const tp = path.join(R, dst)
  if (!fs.existsSync(sp)) { console.log('MISSING SRC:', src); fail++; continue }
  const content = rd(sp)
  if (!sigOK(content, sig)) { console.log('SIG FAIL:', src, '->', dst, '(expected', sig + ')'); fail++; continue }
  fs.mkdirSync(path.dirname(tp), { recursive: true })
  wr(tp, content)
  ok++
}

// ---- festivals merge: old data + new engine ----
try {
  const old = rd(path.join(T, 'providers.js'))
  if (sigOK(old, 'Makar Sankranti / Pongal')) {
    const fest = old.match(/const FESTIVALS = \[[\s\S]*?^\]/m)[0]
    const getUp = old.match(/export function getUpcomingFestivals\([\s\S]*?\n}/)[0]
    const getAll = old.match(/export function getAllFestivals\(\) \{[\s\S]*?\n}/)[0]
    const engine = rd(path.join(T, 'festivals.js'))
    if (sigOK(engine, 'getEventWindows')) {
      const merged = engine.replace("const CAPTION_TEMPLATES = {", fest + '\n\nconst CAPTION_TEMPLATES = {')
      const withObs = merged.replace('export function getTemplate(event) {', getUp + '\n\n' + getAll + '\n\nexport function getTemplate(event) {')
      wr(path.join(R, 'lib/festivals.js'), withObs)
      ok++
    } else { console.log('SIG FAIL: festivals.js engine'); fail++ }
  } else { console.log('SIG FAIL: providers.js old data'); fail++ }
} catch (e) { console.log('festivals merge error:', e.message); fail++ }

// ---- seasonal-events legacy shim (new seasonal-engine imports from it) ----
wr(path.join(R, 'lib/seasonal-events.js'), "// Legacy alias — the full event engine now lives in lib/festivals.js + lib/seasonal-db.js\nexport * from './festivals'\n")
ok++

// ---- analytics split: page + intel-components ----
try {
  const txt = rd(path.join(T, 'accordion.jsx'))
  const idxExports = txt.indexOf('export function AccountCards')
  const idxPage = txt.indexOf('export default function AnalyticsPage')
  if (idxExports > 0 && idxPage > idxExports) {
    const header = `'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, TrendingDown, Eye, Star, MessageSquare, Share2, Save, Search, Target, Clock, Users, Globe, Monitor, Smartphone, Tablet, Gauge, Zap, AlertTriangle, Plus, Trash2, ArrowUpRight, ArrowDownRight, CalendarDays, Sparkles, Bot, CheckCircle, Heart, Repeat2, BarChart3, LayoutGrid, GraduationCap, Briefcase, Megaphone, FlaskConical, UserRound, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { analyze } from '@/app/compose/studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()
const short = n => n >= 1000 ? \`\${(n / 1000).toFixed(1)}K\` : fmt(n)
const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2' }, instagram: { label: 'Instagram', color: '#E4405F' },
  facebook: { label: 'Facebook', color: '#1877F2' }, threads: { label: 'Threads', color: '#111827' },
  twitter: { label: 'X', color: '#000000' }, blog: { label: 'Blog', color: '#7C3AED' }, newsletter: { label: 'Newsletter', color: '#F97316' },
}
const eng = p => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)

`
    const intel = header + txt.slice(idxExports, idxPage)
    wr(path.join(R, 'app/analytics/intel-components.js'), intel)
    wr(path.join(R, 'app/analytics/page.js'), txt.slice(0, idxExports) + '\n' + txt.slice(idxPage))
    ok += 2
  } else { console.log('SIG FAIL: accordion.jsx split markers'); fail++ }
} catch (e) { console.log('analytics split error:', e.message); fail++ }

// ---- delete stale supabase libs if present ----
for (const f of ['lib/supabase.js', 'lib/supabase-browser.js']) {
  const p = path.join(R, f)
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('deleted stale', f) }
}

console.log('DONE — ok:', ok, 'fail:', fail)
