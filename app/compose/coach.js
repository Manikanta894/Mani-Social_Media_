'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Wand2, Scissors, Check, AlertTriangle, Gauge, TrendingUp, Hash, MessageSquare, Lightbulb, BrainCircuit, Type, PenLine, Languages, Send, Zap, Bot, X, Eye, Star } from 'lucide-react'
import { toast } from 'sonner'
import { analyze } from './studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'

const GENERIC_WORDS = /\b(just|very|really|literally|basically|amazingly|incredibly|totally|absolutely|so much|kind of|sort of)\b/gi
const FANCY_WORDS = { utilize: 'use', leverage: 'use', facilitate: 'help', commence: 'start', subsequently: 'then', additionally: 'also', endeavor: 'try', ascertain: 'find out', utilize: 'use', nevertheless: 'but' }
const CTA_WORDS = /(click|follow|comment|share|save|dm|learn more|link in bio|read more|subscribe|reply|sign up|contact|get started)/i

function firstTopic(text) {
  const words = (text || '').match(/[A-Za-z0-9]{4,}/g) || []
  return words.slice(0, 3).join(' ') || 'this topic'
}

export function inlineIssues(text) {
  const issues = []
  const first = ((text || '').split('\n')[0] || '').trim()
  if (!first) return []
  if (first.length < 20) issues.push({ sev: 'warn', label: 'Weak hook — first line is very short', fix: 'hook-question' })
  else if (!/[?!]/.test(first) && !/\b(imagine|ever|secret|mistake|why|how|stop|wait)\b/i.test(first)) issues.push({ sev: 'info', label: 'Hook lacks curiosity — open with a question or bold claim', fix: 'hook-question' })
  if ((text || '').length > 600) issues.push({ sev: 'warn', label: 'Caption is long — shorten for better retention', fix: 'shorten' })
  if (!CTA_WORDS.test(text || '')) issues.push({ sev: 'warn', label: 'Missing CTA — tell readers what to do', fix: 'cta-question' })
  if (GENERIC_WORDS.test(text || '')) issues.push({ sev: 'info', label: 'Generic filler words detected', fix: 'grammar-fix' })
  if ((text || '').length > 320 && !/\n/.test(text || '')) issues.push({ sev: 'info', label: 'Long paragraph — break into short lines', fix: 'linebreaks' })
  return issues.slice(0, 5)
}

export function applyCoachFix(key, ctx) {
  const { caption = '', hashtags = [], setPost, rewrite, toastMsg } = ctx
  const c = caption || ''
  const topic = firstTopic(c)
  const set = (patch, msg) => { setPost(patch); toast.success(msg || 'Applied') }
  switch (key) {
    case 'hook-question': return set({ caption: `Ever wondered how ${topic} actually works? Here's what I found.\n\n${c}` }, 'Question hook added')
    case 'hook-story': return set({ caption: `Last week, I learned the hard way that ${topic} isn't what it seems.\n\n${c}` }, 'Story hook added')
    case 'hook-stat': return set({ caption: `80% of results come from 20% of the effort — ${topic} is no exception.\n\n${c}` }, 'Statistic hook added')
    case 'hook-pain': return set({ caption: `If ${topic} feels harder than it should, you're not alone.\n\n${c}` }, 'Pain-point hook added')
    case 'hook-bold': return set({ caption: `Here's the truth about ${topic} most people ignore.\n\n${c}` }, 'Bold hook added')
    case 'cta-question': return set({ caption: c.trimEnd() + '\n\n👉 ' + 'What\u2019s your take on this? Drop a comment below.' }, 'Question CTA added')
    case 'cta-comments': return set({ caption: c.trimEnd() + '\n\n💬 I read every comment — tell me what you think!' }, 'Comment invite added')
    case 'cta-save': return set({ caption: c.trimEnd() + '\n\n🔖 Save this for your next content session.' }, 'Save CTA added')
    case 'cta-business': return set({ caption: c.trimEnd() + '\n\n📩 Want the full breakdown? DM me or book a call.' }, 'Business CTA added')
    case 'cta-sales': return set({ caption: c.trimEnd() + '\n\n🚀 Ready to get started? Link in bio — limited slots this month.' }, 'Sales CTA added')
    case 'hashtags-better': return set({ hashtags: [...new Set([...(hashtags || []), 'digitalmarketing', 'contentmarketing', 'socialmediamarketing'])] }, 'Better hashtags added')
    case 'hashtags-trending': return set({ hashtags: [...new Set([...(hashtags || []), 'ai', 'growthhacking', 'productivity'])] }, 'Trending hashtags added')
    case 'hashtags-industry': return set({ hashtags: [...new Set([...(hashtags || []), 'thoughtleadership', 'industryinsights', 'innovation'])] }, 'Industry hashtags added')
    case 'hashtags-local': return set({ hashtags: [...new Set([...(hashtags || []), 'bengaluru', 'startupcity', 'localbusiness'])] }, 'Local hashtags added')
    case 'shorten': return set({ caption: c.split(/\n+/).filter(Boolean).slice(0, 3).join('\n\n').slice(0, Math.floor(c.length * 0.55) || 120) }, 'Shortened')
    case 'grammar-fix': return set({ caption: c.replace(GENERIC_WORDS, '').replace(/\s{2,}/g, ' ').replace(/(^|\.\s+)([a-z])/g, (m, p, l) => p + l.toUpperCase()).trim() }, 'Grammar cleaned')
    case 'simplify': return set({ caption: c.replace(/!(2,})/g, '!').replace(/\b(utilize|leverage|facilitate|commence|subsequently|additionally|endeavor|ascertain|nevertheless)\b/gi, m => FANCY_WORDS[m.toLowerCase()] || m) }, 'Simplified for readability')
    case 'linebreaks': return set({ caption: c.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean).join('\n\n') }, 'Broken into short lines')
    case 'seo-keywords': return set({ hashtags: [...new Set([...(hashtags || []), 'contentstrategy', 'digitalgrowth', 'brandbuilding'])] }, 'SEO keywords added')
    case 'seo-title': return set({ caption: `${topic.charAt(0).toUpperCase() + topic.slice(1)}: the complete guide\n\n${c}` }, 'SEO-style title added')
    case 'seo-meta': return set({ caption: c.slice(0, 155) + (c.length > 155 ? '…' : '') }, 'Meta-length description (155 chars)')
    case 'optimize-linkedin': return set({ caption: c.trimEnd() + '\n\nWhat has worked for your team? I\u2019d love to compare notes.' }, 'LinkedIn: professional question added')
    case 'optimize-instagram': return set({ caption: c.trimEnd() + '\n\nSave this for later 🔖', hashtags: [...new Set([...(hashtags || []), 'explorepage', 'instagramtips'])] }, 'Instagram: visual + save CTA added')
    case 'optimize-facebook': return set({ caption: c.trimEnd() + '\n\nTell me your story in the comments — this community learns best together.' }, 'Facebook: community prompt added')
    case 'optimize-threads': return set({ caption: c.split(/\n+/)[0].slice(0, 480) }, 'Threads: trimmed to short-form')
    case 'rewrite-professional': return rewrite ? (rewrite(), undefined) : toast.info('Use AI Rewrite')
    case 'humanize': return set({ caption: c.replace(GENERIC_WORDS, '').replace(/!{2,}/g, '!') }, 'Humanized')
    case 'translate': return toast.info('Choose a language in AI Controls, then hit AI Rewrite')
    case 'expand': return toast.info('For a longer version set Length: Long and hit AI Rewrite')
    default: return
  }
}

function buildCoach(text) {
  const a = analyze(text)
  const c = text || ''
  const first = c.split('\n')[0] || ''
  const problems = []
  if (a.hookScore < 60) {
    problems.push(first.length < 20 ? 'Hook is weak — first line barely exists' : 'Hook doesn\u2019t create curiosity or emotion')
  }
  if (a.ctaScore < 60) problems.push(a.ctaScore < 30 ? 'CTA missing entirely' : 'CTA is weak — no clear next step')
  if (a.hashtagCount === 0) problems.push('No hashtags — content won\u2019t be discovered')
  else if (a.hashtagCount > 10) problems.push('Too many hashtags — looks spammy')
  if (GENERIC_WORDS.test(c)) problems.push('Generic filler words dilute impact')
  if (a.quality < 50) problems.push('Content likely to perform below average')
  const priority = []
  if (a.hookScore < 70) priority.push('1. Improve Hook')
  if (a.ctaScore < 70) priority.push('2. Add CTA')
  if (a.hashtagScore < 70) priority.push('3. Replace Hashtags')
  if (a.seo < 70) priority.push('4. Optimize SEO')
  if (priority.length === 0) priority.push('1. Publish as-is', '2. A/B test two variants')
  const summary = problems.length
    ? `Your content is ${a.quality >= 70 ? 'well structured' : 'still developing'} but likely to perform ${a.quality >= 70 ? 'well with polish' : 'below average'} because ${problems.slice(0, 3).map(p => p.toLowerCase().replace(/^-\s*/, '')).join('; ')}.`
    : 'Your content is strong across the board — publish with confidence and monitor the first hour of engagement.'
  return {
    a, problems, priority, summary,
    projected: {
      quality: Math.min(95, a.quality + 45), seo: Math.min(95, a.seo + 45), engagement: Math.min(95, a.engagement + 45),
      reach: Math.round((1000 + a.engagement * 60) * 3.2),
    },
  }
}

function ScoreCard({ title, icon, color, score, problems, fixes, onFix, children }) {
  return (
    <div className={`${C} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#F0F1F5] bg-[#FAFAFD]">
        <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}12`, color }}>{icon}</span>
        <span className="text-xs font-bold text-[#16161D] flex-1">{title}</span>
        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white" style={{ backgroundColor: score >= 70 ? '#0EA37A' : score >= 45 ? '#F59E0B' : '#EF4444' }}>{score}</div>
      </div>
      <div className="p-3 space-y-2.5">
        {problems.length > 0 && (
          <div>
            <div className="text-[0.55rem] font-bold uppercase tracking-wider text-[#8A8A96] mb-1.5">Problems found</div>
            {problems.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[0.65rem] text-[#16161D] py-0.5">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" /><span>{p}</span>
              </div>
            ))}
          </div>
        )}
        {problems.length === 0 && <div className="text-[0.65rem] text-[#0EA37A] font-medium">No problems detected — great job!</div>}
        {fixes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fixes.map(f => (
              <button key={f.key} onClick={() => onFix(f.key)} className="text-[0.6rem] font-semibold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED]/8 to-[#EC4899]/8 border border-[#D8C8FB]/50 text-[#7C3AED] hover:bg-gradient-to-r hover:from-[#7C3AED] hover:to-[#EC4899] hover:text-white transition-all flex items-center gap-1">
                <Wand2 className="h-3 w-3" />{f.label}
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function AnalysisPanel({ text, hashtags, onAction }) {
  const [fixAll, setFixAll] = useState(false)
  const coach = buildCoach(text || '')
  const { a } = coach
  const fix = (k) => { onAction(k); if (fixAll) setFixAll(false) }
  const fixAllClick = () => {
    setFixAll(true)
    const seq = []
    if (a.hookScore < 70) seq.push('hook-question')
    if (a.ctaScore < 70) seq.push('cta-question')
    if (a.hashtagCount === 0) seq.push('hashtags-better')
    if (a.seo < 70) seq.push('seo-keywords')
    if (GENERIC_WORDS.test(text || '')) seq.push('grammar-fix')
    if (seq.length === 0) seq.push('shorten')
    seq.forEach((k, i) => setTimeout(() => fix(k), i * 400))
    toast.success(`Applying ${seq.length} fixes…`)
  }
  const quickActions = [
    { key: 'hook-question', label: 'Improve Hook', icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { key: 'cta-question', label: 'Add CTA', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { key: 'seo-keywords', label: 'Improve SEO', icon: <Gauge className="h-3.5 w-3.5" /> },
    { key: 'hashtags-better', label: 'Better Hashtags', icon: <Hash className="h-3.5 w-3.5" /> },
    { key: 'rewrite-professional', label: 'Rewrite Professionally', icon: <PenLine className="h-3.5 w-3.5" /> },
    { key: 'humanize', label: 'Humanize', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'shorten', label: 'Shorten', icon: <Scissors className="h-3.5 w-3.5" /> },
    { key: 'expand', label: 'Expand', icon: <Wand2 className="h-3.5 w-3.5" /> },
    { key: 'translate', label: 'Translate', icon: <Languages className="h-3.5 w-3.5" /> },
    { key: 'optimize-linkedin', label: 'Optimize LinkedIn', icon: <BriefIcon c="#0A66C2" /> },
    { key: 'optimize-instagram', label: 'Optimize Instagram', icon: <BriefIcon c="#E4405F" /> },
    { key: 'optimize-facebook', label: 'Optimize Facebook', icon: <BriefIcon c="#1877F2" /> },
    { key: 'optimize-threads', label: 'Optimize Threads', icon: <BriefIcon c="#111827" /> },
  ]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[#7C3AED]" /> AI Content Coach</h4>
        <button onClick={fixAllClick} className="text-[0.6rem] font-bold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white flex items-center gap-1"><Zap className="h-3 w-3" /> Fix All</button>
      </div>

      <ScoreCard title="Content Quality" icon={<Gauge className="h-3.5 w-3.5" />} color="#7C3AED" score={a.quality}
        problems={a.hookScore < 60 ? ['Hook is weak — first line doesn\u2019t grab attention'] : []}
        fixes={[{ key: 'hook-question', label: 'Generate stronger hook' }, { key: 'cta-question', label: 'Add stronger CTA' }, { key: 'humanize', label: 'Increase readability' }, { key: 'hook-story', label: 'Add storytelling' }, { key: 'rewrite-professional', label: 'Improve quality' }]}
        onFix={fix} />

      <ScoreCard title="SEO Score" icon={<Gauge className="h-3.5 w-3.5" />} color="#3B82F6" score={a.seo}
        problems={[...(a.hashtagCount === 0 ? ['Missing keywords — no hashtags detected'] : []), ...(a.keyword ? [`Keyword "${a.keyword.word}" density ${a.density}%`] : ['Keyword density low']), 'No meta description']}
        fixes={[{ key: 'seo-title', label: 'Generate SEO title' }, { key: 'seo-keywords', label: 'Add keywords' }, { key: 'seo-meta', label: 'Meta description' }]}
        onFix={fix} />

      <ScoreCard title="Predicted Engagement" icon={<TrendingUp className="h-3.5 w-3.5" />} color="#EC4899" score={a.engagement}
        problems={[...(a.hookScore < 60 ? ['Weak first sentence'] : []), ...(a.ctaScore < 60 ? ['Missing CTA'] : []), ...((text || '').length > 400 ? ['Caption too long'] : [])]}
        fixes={[{ key: 'hook-bold', label: 'Viral hook' }, { key: 'cta-question', label: 'Add question' }, { key: 'shorten', label: 'Shorten' }, { key: 'optimize-instagram', label: 'Improve engagement' }]}
        onFix={fix} />

      <ScoreCard title="Hook Score" icon={<Lightbulb className="h-3.5 w-3.5" />} color="#F59E0B" score={a.hookScore}
        problems={[(text || '').split('\n')[0]?.length < 20 ? 'Starts too slowly — no hook present' : 'Doesn\u2019t create curiosity or emotion']}
        fixes={[{ key: 'hook-story', label: 'Story hook' }, { key: 'hook-question', label: 'Question hook' }, { key: 'hook-stat', label: 'Statistic hook' }, { key: 'hook-pain', label: 'Pain point hook' }, { key: 'hook-bold', label: 'Bold hook' }]}
        onFix={fix} />

      <ScoreCard title="CTA Score" icon={<MessageSquare className="h-3.5 w-3.5" />} color="#0EA37A" score={a.ctaScore}
        problems={[a.ctaScore < 30 ? 'No CTA — readers don\u2019t know what to do next' : 'CTA exists but is weak']}
        fixes={[{ key: 'cta-question', label: 'Ask question' }, { key: 'cta-comments', label: 'Invite comments' }, { key: 'cta-save', label: 'Save CTA' }, { key: 'cta-business', label: 'Business CTA' }, { key: 'cta-sales', label: 'Sales CTA' }]}
        onFix={fix} />

      <ScoreCard title="Hashtag Score" icon={<Hash className="h-3.5 w-3.5" />} color="#14B8A6" score={a.hashtagScore}
        problems={[a.hashtagCount === 0 ? 'No hashtags — content won\u2019t be discovered' : a.hashtagCount > 10 ? 'Too many — looks spammy' : 'Mix may be too generic or competitive']}
        fixes={[{ key: 'hashtags-better', label: 'Better hashtags' }, { key: 'hashtags-trending', label: 'Trending' }, { key: 'hashtags-industry', label: 'Industry' }, { key: 'hashtags-local', label: 'Local' }]}
        onFix={fix} />

      <ScoreCard title="Grammar & Flow" icon={<Type className="h-3.5 w-3.5" />} color="#8B5CF6" score={a.grammar}
        problems={[...(GENERIC_WORDS.test(text || '') ? ['Generic filler words (very, really, just…)'] : []), ...((text || '').length > 320 && !/\n/.test(text || '') ? ['Long paragraph — hard to scan'] : [])]}
        fixes={[{ key: 'grammar-fix', label: 'Fix grammar' }, { key: 'humanize', label: 'Humanize' }, { key: 'linebreaks', label: 'Improve flow' }]}
        onFix={fix} />

      <ScoreCard title="Readability" icon={<Eye className="h-3.5 w-3.5" />} color="#6366F1" score={a.flesch}
        problems={[`Reading level: ${a.readability} · ${a.words} words · ${a.readingTime}m read`]}
        fixes={[{ key: 'simplify', label: 'Simplify' }, { key: 'shorten', label: 'Shorten' }, { key: 'linebreaks', label: 'Improve flow' }]}
        onFix={fix} />

      <ScoreCard title="Brand Voice Match" icon={<Star className="h-3.5 w-3.5" />} color="#F97316" score={a.quality >= 65 ? 78 : 52}
        problems={[a.quality >= 65 ? 'Good alignment with professional brand voice' : 'Tone drifts — too casual/formal for the brand']}
        fixes={[{ key: 'rewrite-professional', label: 'Rewrite in brand voice' }]}
        onFix={fix} />

      {/* AI Coach Summary */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1A1037] to-[#4C1D63] p-4 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#EC4899]/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2.5"><Bot className="h-4 w-4 text-[#C4B5FD]" /><span className="text-xs font-bold uppercase tracking-wider text-[#C4B5FD]">AI Coach Summary</span></div>
          <p className="text-[0.7rem] text-white/85 leading-relaxed">{coach.summary}</p>
          <div className="mt-3">
            <div className="text-[0.6rem] text-white/50 uppercase tracking-wider font-semibold mb-1.5">Recommended priority</div>
            <div className="flex flex-wrap gap-1.5">
              {coach.priority.map(p => <span key={p} className="text-[0.6rem] font-bold px-2.5 py-1 rounded-full bg-white/10 border border-white/15">{p}</span>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[['Quality', a.quality, coach.projected.quality, '#C4B5FD'], ['SEO', a.seo, coach.projected.seo, '#F9A8D4'], ['Engagement', a.engagement, coach.projected.engagement, '#6EE7B7'], ['Est. Reach', Math.round((1000 + a.engagement * 60) / 1000) + 'K', (coach.projected.reach / 1000).toFixed(1) + 'K', '#93C5FD']].map(([l, from, to, col]) => (
              <div key={l} className="rounded-xl bg-white/5 border border-white/10 p-2">
                <div className="text-[0.55rem] text-white/50 uppercase tracking-wider">{l}</div>
                <div className="text-sm font-bold" style={{ color: col }}>{from} <span className="text-white/40">→</span> {to}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick AI Actions */}
      <div className={`${C} p-4`}>
        <h4 className="text-xs font-bold text-[#16161D] mb-2.5 flex items-center gap-2"><Zap className="h-4 w-4 text-[#EC4899]" /> Quick AI Actions</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {quickActions.map(q => (
            <button key={q.key} onClick={() => fix(q.key)} className="flex items-center gap-1.5 text-[0.62rem] font-semibold px-2 py-2 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{q.icon}{q.label}</button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {fixAll && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-[#0EA37A]/8 border border-[#0EA37A]/20 p-3 text-[0.65rem] text-[#0EA37A] font-medium flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 animate-pulse" /> Fixes applied — review the editor and hit AI Rewrite for a fully polished version.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BriefIcon({ c }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
}
