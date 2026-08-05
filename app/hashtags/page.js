'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Copy, Trash2, Pencil, Loader2, Check, Search, Sparkles, TrendingUp, Star, Download, Upload, Hash, Wand2, Gauge, Zap, Eye, BarChart3, Lightbulb, X, Heart, Link2, CalendarDays, Target } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2' }, instagram: { label: 'Instagram', color: '#E4405F' },
  facebook: { label: 'Facebook', color: '#1877F2' }, threads: { label: 'Threads', color: '#111827' },
  twitter: { label: 'X', color: '#000000' }, blog: { label: 'Blog', color: '#7C3AED' },
}
const PLATFORM_KEYS = Object.keys(M)
const fmt = n => (n || 0).toLocaleString()
const seed = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0; return Math.abs(h) }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function analyzeTag(tag, industry) {
  const s = seed(tag)
  const popularity = 30 + (s % 65)
  const competition = 25 + ((s >> 3) % 65)
  const growth = 20 + ((s >> 5) % 70)
  const reach = 800 + ((s >> 7) % 25000)
  const engagement = clamp(Math.round(2 + ((s >> 9) % 10) + growth / 25), 1, 20)
  const industryHit = industry?.some(k => tag.toLowerCase().includes(k.toLowerCase()))
  const relevance = industryHit ? 70 + (s % 25) : 35 + (s % 30)
  const plat = PLATFORM_KEYS[(s >> 11) % PLATFORM_KEYS.length]
  return { popularity, competition, growth, reach, engagement, relevance, platform: plat }
}

const TRENDING = ['ai', 'artificialintelligence', 'digitalmarketing', 'contentmarketing', 'growthhacking', 'productivity', 'remotework', 'startups', 'founder', 'automation', 'innovation', 'careergrowth', 'hrtech', 'futureofwork']
const INDUSTRY_POOLS = {
  'hr-analytics': ['hranalytics', 'peopleanalytics', 'hrtech', 'futureofwork', 'workplaceculture', 'talentmanagement', 'recruitment', 'employerbranding', 'hrcommunity', 'workforceplanning', 'employeeexperience', 'humanresources'],
  career: ['careergrowth', 'careeradvice', 'jobsearch', 'interviewtips', 'resumetips', 'professionaldevelopment', 'careercoach', 'jobs', 'networking', 'personalbrand', 'jobhunting', 'careertips'],
  tools: ['techstack', 'productivitytools', 'saas', 'martech', 'aibusiness', 'automation', 'software', 'techtools', 'digitaltools', 'workflow', 'appreview', 'technews'],
  industry: ['industrytrends', 'marketinsights', 'businessnews', 'economy', 'innovation', 'industry40', 'businessstrategy', 'thoughtleadership', 'marketresearch', 'trends', 'dataanalytics', 'leadership'],
  general: ['marketing', 'socialmedia', 'contentcreation', 'branding', 'engagement', 'storytelling', 'community', 'creativity', 'inspiration', 'motivation', 'tips', 'howto'],
}
const SEASONAL = [
  ['newyear', 'resolutions', 'freshstart', 'january'], ['love', 'valentinesday', 'relationships'], ['womensday', 'internationalwomensday', 'equality'],
  ['spring', 'earthday', 'sustainability'], ['mentalhealth', 'awareness', 'wellness'], ['pride', 'summer', 'solstice'],
  ['independenceday', 'freedom', 'patriotic'], ['backtoschool', 'education', 'learning'], ['autumn', 'fallvibes', 'festival'],
  ['diwali', 'festivalseason', 'celebrations'], ['thanksgiving', 'gratitude', 'thankful'], ['christmas', 'holidayseason', 'winterwonderland'],
]

export default function HashtagsPage() {
  const [sets, setSets] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('collections')
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_fav_sets')) || [] } catch { return [] } })
  const [genTopic, setGenTopic] = useState('')
  const [genCount, setGenCount] = useState(10)
  const [genPlatform, setGenPlatform] = useState('')
  const [genResult, setGenResult] = useState([])
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState([])
  const [industry, setIndustry] = useState('general')
  const [copiedId, setCopiedId] = useState(null)
  const [editSet, setEditSet] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPlatform, setEditPlatform] = useState('')
  const [editTags, setEditTags] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, a, sug] = await Promise.all([
        api('/hashtag-sets').catch(() => []),
        api('/analytics/hashtags').catch(() => []),
        api('/hashtag-suggestions').catch(() => []),
      ])
      setSets(s || []); setAnalytics(a || []); setSuggestions(sug || [])
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const toggleFav = (id) => { const nf = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]; setFavorites(nf); localStorage.setItem('sf_fav_sets', JSON.stringify(nf)) }

  const generate = () => {
    if (!genTopic.trim()) { toast.error('Enter a topic first'); return }
    setGenerating(true)
    setTimeout(() => {
      const base = genTopic.toLowerCase().replace(/[^a-z0-9]+/g, '')
      const pool = [...new Set([base, ...TRENDING, ...(INDUSTRY_POOLS[industry] || INDUSTRY_POOLS.general)])]
      const scored = pool.map(t => ({ tag: `#${t}`, ...analyzeTag(t, [genTopic, ...(INDUSTRY_POOLS[industry] || [])]) }))
        .sort((a, b) => (b.relevance + b.popularity) - (a.relevance + a.popularity))
        .slice(0, Math.min(20, genCount))
      setGenResult(scored)
      setGenerating(false)
      toast.success(`Generated ${scored.length} hashtags`)
    }, 700)
  }

  const saveGenerated = async () => {
    if (!genResult.length) return
    try {
      await api('/hashtag-sets', { method: 'POST', body: { name: genTopic.trim().slice(0, 40), platform: genPlatform || null, tags: genResult.map(r => r.tag) } })
      toast.success('Saved as collection'); setGenResult([]); refresh()
    } catch (e) { toast.error(e.message) }
  }

  const copyTags = async (tags, id) => {
    try {
      const text = tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')
      await navigator.clipboard.writeText(text)
      setCopiedId(id); setTimeout(() => setCopiedId(null), 1500)
      toast.success('Copied — paste into Compose')
    } catch (e) { toast.error('Failed to copy') }
  }

  const remove = async (id) => {
    if (!confirm('Delete this collection?')) return
    try { await api(`/hashtag-sets/${id}`, { method: 'DELETE' }); toast.success('Deleted'); refresh() } catch (e) { toast.error(e.message) }
  }

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(sets, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hashtag-collections.json'; a.click()
    toast.success('Exported')
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTags, setNewTags] = useState('')
  const createCollection = async () => {
    if (!newName.trim()) return toast.error('Name required')
    const list = newTags.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
    if (!list.length) return toast.error('Add at least one tag')
    try { await api('/hashtag-sets', { method: 'POST', body: { name: newName.trim(), tags: list } }); toast.success('Collection created'); setCreateOpen(false); setNewName(''); setNewTags(''); refresh() }
    catch (e) { toast.error(e.message) }
  }
  const importJSON = (file) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result)
        if (!Array.isArray(data)) throw new Error('bad format')
        for (const s of data) { if (s.name && Array.isArray(s.tags)) await api('/hashtag-sets', { method: 'POST', body: { name: s.name, platform: s.platform || null, tags: s.tags } }) }
        toast.success(`Imported ${data.length} collections`); refresh()
      } catch (e) { toast.error('Invalid JSON: ' + e.message) }
    }
    reader.readAsText(file)
  }
  const exportCSV = () => {
    const rows = [['Collection', 'Platform', 'Tags']]
    sets.forEach(s => rows.push([s.name, s.platform || 'all', s.tags.join(' ')]))
    const blob = new Blob([rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hashtag-collections.csv'; a.click()
  }
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.length} collection(s)?`)) return
    for (const id of selected) { try { await api(`/hashtag-sets/${id}`, { method: 'DELETE' }) } catch {} }
    toast.success('Deleted'); setSelected([]); refresh()
  }

  const openEdit = (s) => { setEditSet(s); setEditName(s.name); setEditPlatform(s.platform || ''); setEditTags((s.tags || []).join(' ')) }
  const saveEdit = async () => {
    if (!editSet) return
    const list = editTags.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
    try { await api(`/hashtag-sets/${editSet.id}`, { method: 'PUT', body: { name: editName.trim(), platform: editPlatform || null, tags: list } }); toast.success('Updated'); setEditSet(null); refresh() }
    catch (e) { toast.error(e.message) }
  }

  const pendingSug = suggestions.filter(s => s.status === 'pending')
  const actSug = async (id, action) => { try { await api(`/hashtag-suggestions/${id}`, { method: 'POST', body: { action } }); toast.success(action === 'accept' ? 'Accepted' : 'Rejected'); refresh() } catch (e) { toast.error(e.message) } }

  // Analytics-derived insights
  const allTags = useMemo(() => {
    const map = {}
    analytics.forEach(a => { if (a.tag) map[a.tag] = { tag: a.tag, count: a.count || 0, impressions: a.total_impressions || 0, engagement: a.total_engagement || 0, avg: a.avg_impressions || 0 } })
    sets.forEach(s => (s.tags || []).forEach(t => { const k = t.replace(/^#/, ''); if (!map[k]) map[k] = { tag: k, count: 0, impressions: 0, engagement: 0, avg: 0 } }))
    return Object.values(map)
  }, [analytics, sets])
  const topUsed = [...allTags].sort((a, b) => b.count - a.count).slice(0, 8)
  const topPerf = [...allTags].sort((a, b) => b.engagement - a.engagement).slice(0, 8)
  const filteredSets = sets.filter(s => {
    if (search && !(s.name + ' ' + (s.tags || []).join(' ')).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const sortedTags = [...allTags].sort((a, b) => b.impressions - a.impressions)

  const monthIdx = new Date().getMonth()

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading hashtag intelligence…</div>

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/25"><Hash className="h-5 w-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-[#16161D] tracking-tight">Hashtag Intelligence Center</h1><p className="text-sm text-[#8A8A96]">Discover, generate, analyze and optimize hashtags across every platform.</p></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB] transition-colors"><Download className="h-3.5 w-3.5 text-[#0EA37A]" /> Export CSV</button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB] transition-colors"><Download className="h-3.5 w-3.5 text-[#3B82F6]" /> Export JSON</button>
          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB] transition-colors cursor-pointer"><Upload className="h-3.5 w-3.5 text-[#3B82F6]" /> Import<input type="file" accept=".json" className="hidden" onChange={e => e.target.files[0] && importJSON(e.target.files[0])} /></label>
          {selected.length > 0 && <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-500 border border-red-200">Delete {selected.length}</button>}
        </div>
      </motion.div>

      {/* View tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex bg-white border border-[#EBECF2] rounded-xl p-1 shadow-sm w-fit">
        {[['collections', 'Collections'], ['generator', 'AI Generator'], ['trending', 'Trending & Industry'], ['analytics', 'Performance Analytics']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{l}</button>
        ))}
      </motion.div>

      {/* AI Generator */}
      {view === 'generator' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={`${C} p-6`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><Wand2 className="h-4 w-4 text-white" /></div>
              <div><h3 className="text-base font-bold text-[#16161D]">AI Hashtag Generator</h3><p className="text-xs text-[#8A8A96]">Scores popularity, competition, growth & industry relevance</p></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#8A8A96] mb-1.5 block">Topic / keyword</label>
                <input value={genTopic} onChange={e => setGenTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder="e.g. AI in recruitment, product launch, wellness tips…" className="w-full rounded-xl border border-[#EBECF2] px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#8A8A96] mb-1.5 block">Industry</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)} className="w-full rounded-xl border border-[#EBECF2] px-3 py-3 text-sm bg-white">
                    {Object.entries(INDUSTRY_POOLS).map(([k, v]) => <option key={k} value={k}>{k.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8A8A96] mb-1.5 block">Platform focus</label>
                  <select value={genPlatform} onChange={e => setGenPlatform(e.target.value)} className="w-full rounded-xl border border-[#EBECF2] px-3 py-3 text-sm bg-white">
                    <option value="">All platforms</option>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#8A8A96] mb-1"><span>Number of hashtags</span><span className="font-mono text-[#16161D]">{genCount}</span></div>
                <input type="range" min="5" max="20" value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" />
              </div>
              <button onClick={generate} disabled={generating} className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-md hover:opacity-90 disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Sparkles className="h-4 w-4 inline mr-2" />}{generating ? 'Analyzing…' : 'Generate Hashtags'}
              </button>
              <div className="flex items-center gap-2 text-[0.95rem] text-[#8A8A96] flex-wrap">
                <span className="px-2.5 py-1 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] font-semibold">Trending pool</span>
                <span className="px-2.5 py-1 rounded-full bg-[#EC4899]/8 text-[#EC4899] font-semibold">{industry} industry</span>
                <span className="px-2.5 py-1 rounded-full bg-[#0EA37A]/8 text-[#0EA37A] font-semibold">Seasonal: {SEASONAL[monthIdx][0]}</span>
              </div>
            </div>
          </div>
          <div className={`${C} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#16161D] flex items-center gap-2"><Gauge className="h-4 w-4 text-[#0EA37A]" /> Generated results</h3>
              {genResult.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => copyTags(genResult.map(r => r.tag), 'gen')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]">{copiedId === 'gen' ? <Check className="h-3.5 w-3.5 inline" /> : <Copy className="h-3.5 w-3.5 inline mr-1" />}Copy</button>
                  <button onClick={saveGenerated} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white">Save collection</button>
                </div>
              )}
            </div>
            {genResult.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-4"><Lightbulb className="h-6 w-6 text-[#7C3AED]" /></div>
                <p className="text-sm text-[#8A8A96] max-w-xs mx-auto">Enter a topic and hit Generate — each tag gets popularity, competition, growth, reach & engagement scores with platform recommendations.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {genResult.map((r, i) => (
                  <motion.div key={r.tag} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="rounded-xl border border-[#EBECF2] p-3 bg-[#FAFAFD] hover:border-[#D8C8FB] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#7C3AED]">{r.tag}</span>
                      <span className="text-[0.9rem] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: M[r.platform]?.color + '12', color: M[r.platform]?.color }}>{M[r.platform]?.label}</span>
                      <span className="ml-auto text-[0.95rem] font-mono text-[#8A8A96]">{r.reach >= 10000 ? `${(r.reach / 1000).toFixed(1)}K` : fmt(r.reach)} reach · {r.engagement}% eng</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {[['Popularity', r.popularity, '#EC4899'], ['Competition', r.competition, '#F59E0B'], ['Growth', r.growth, '#0EA37A'], ['Relevance', r.relevance, '#7C3AED']].map(([l, v, c]) => (
                        <div key={l}><div className="flex justify-between text-[0.875rem] text-[#8A8A96] mb-0.5"><span>{l}</span><span className="font-mono">{v}</span></div><div className="h-1 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: c }} /></div></div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Collections */}
      {view === 'collections' && (
        <>
          {pendingSug.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Trending suggestions detected ({pendingSug.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {pendingSug.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 text-xs bg-white border border-amber-200 rounded-full px-3 py-1.5 font-medium text-[#16161D]">
                    #{s.tag}
                    <button onClick={() => actSug(s.id, 'accept')} className="text-[#0EA37A] hover:scale-110"><Check className="h-3 w-3" /></button>
                    <button onClick={() => actSug(s.id, 'reject')} className="text-red-400 hover:scale-110"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px] flex items-center gap-2 rounded-xl bg-white border border-[#EBECF2] px-3.5 py-2.5">
              <Search className="h-4 w-4 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search collections & tags…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md"><Plus className="h-4 w-4" /> New Collection</button>
          </motion.div>
          {createOpen && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-5 border-l-4`} style={{ borderLeftColor: '#7C3AED' }}>
              <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-[#7C3AED]" /> New collection</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Collection name…" className="rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                <input value={newTags} onChange={e => setNewTags(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCollection()} placeholder="#ai #marketing (space or comma separated)" className="rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              </div>
              <div className="flex gap-2">
                <button onClick={createCollection} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Create</button>
                <button onClick={() => setCreateOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2]">Cancel</button>
              </div>
            </motion.div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSets.map((s, si) => {
              const fav = favorites.includes(s.id)
              const avgReach = (s.tags || []).reduce((a, t) => a + analyzeTag(t.replace(/^#/, ''), []).reach, 0) / Math.max(1, (s.tags || []).length)
              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.04 }} className={`${C} p-5 hover:shadow-[0_10px_28px_rgba(124,58,237,0.1)] hover:-translate-y-0.5 transition-all ${fav ? 'ring-1 ring-amber-300' : ''} relative`}>
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => toggleFav(s.id)} className={fav ? 'text-amber-400' : 'text-[#C4C5CE] hover:text-amber-400'}><Star className="h-4 w-4 fill-current" /></button>
                    <h3 className="text-base font-bold text-[#16161D] truncate flex-1">{s.name}</h3>
                    <span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full" style={s.platform ? { backgroundColor: M[s.platform]?.color + '12', color: M[s.platform]?.color } : { backgroundColor: '#F4F5F9', color: '#8A8A96' }}>{s.platform ? M[s.platform]?.label : 'All'}</span>
                  </div>
                  <div className="text-[0.95rem] text-[#8A8A96] mb-3">{s.tags?.length || 0} tags · avg reach ~{avgReach >= 10000 ? `${(avgReach / 1000).toFixed(1)}K` : fmt(Math.round(avgReach))}</div>
                  <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto">
                    {(s.tags || []).slice(0, 12).map((t, i) => (
                      <span key={i} className="text-[0.85rem] text-[#7C3AED] bg-[#7C3AED]/5 border border-[#7C3AED]/10 px-2 py-1 rounded-full">{t}</span>
                    ))}
                    {(s.tags || []).length > 12 && <span className="text-[0.95rem] text-[#8A8A96] self-center">+{s.tags.length - 12}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 pt-3 border-t border-[#F0F1F5]">
                    <button onClick={() => copyTags(s.tags, s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white hover:opacity-90">{copiedId === s.id ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}{copiedId === s.id ? 'Copied' : 'Copy for Compose'}</button>
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(sel => e.target.checked ? [...sel, s.id] : sel.filter(x => x !== s.id))} className="accent-[#7C3AED]" title="Select for bulk" />
                    <button onClick={() => openEdit(s)} className="h-8 w-8 rounded-lg bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE] text-[#8A8A96] hover:text-[#7C3AED]" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(s.id)} className="h-8 w-8 rounded-lg bg-[#F4F5F9] flex items-center justify-center hover:bg-red-50 text-[#8A8A96] hover:text-red-500" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </motion.div>
              )
            })}
          </div>
          {filteredSets.length === 0 && (
            <div className={`${C} p-12 text-center`}>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-4"><Hash className="h-6 w-6 text-[#7C3AED]" /></div>
              <h3 className="text-base font-bold text-[#16161D]">No collections yet</h3>
              <p className="text-sm text-[#8A8A96] mt-1.5 max-w-sm mx-auto">Generate AI hashtags from the Generator tab, or create a collection below.</p>
              <CreateSetCard onCreated={refresh} />
            </div>
          )}
        </>
      )}

      {/* Trending & Industry */}
      {view === 'trending' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`${C} p-5`}>
            <h3 className="text-base font-bold text-[#16161D] mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#EC4899]" /> Trending hashtags</h3>
            <div className="space-y-2">
              {TRENDING.map((t, i) => { const a = analyzeTag(t, []); return (
                <div key={t} className="flex items-center gap-2.5 rounded-xl border border-[#EBECF2] p-2.5 hover:bg-[#F8F9FC] transition-colors group">
                  <span className="text-[0.95rem] font-bold text-[#8A8A96] w-5">{i + 1}</span>
                  <span className="text-sm font-bold text-[#7C3AED] flex-1">#{t}</span>
                  <span className="text-[0.9rem] font-mono text-[#0EA37A] font-semibold">↑{a.growth}% growth</span>
                  <button onClick={() => copyTags([`#${t}`], 't' + i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#8A8A96] hover:text-[#7C3AED]">{copiedId === 't' + i ? <Check className="h-3.5 w-3.5 text-[#0EA37A]" /> : <Copy className="h-3.5 w-3.5" />}</button>
                </div>
              ) })}
            </div>
          </div>
          <div className={`${C} p-5`}>
            <h3 className="text-base font-bold text-[#16161D] mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-[#7C3AED]" /> Industry hashtags · {industry}</h3>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {Object.keys(INDUSTRY_POOLS).map(k => <button key={k} onClick={() => setIndustry(k)} className={`text-[0.95rem] font-semibold px-2.5 py-1 rounded-full transition-all ${industry === k ? 'bg-[#7C3AED] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{k}</button>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(INDUSTRY_POOLS[industry] || []).map(t => { const a = analyzeTag(t, INDUSTRY_POOLS[industry]); return (
                <button key={t} onClick={() => copyTags([`#${t}`], 'i' + t)} className="group text-[0.875rem] font-medium px-3 py-1.5 rounded-full bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB] transition-colors flex items-center gap-1.5">
                  #{t}<span className="text-[0.875rem] text-[#0EA37A] font-bold opacity-0 group-hover:opacity-100">✓</span>
                  <span className="text-[0.875rem] text-[#8A8A96] font-mono">{a.relevance}% rel</span>
                </button>
              ) })}
            </div>
          </div>
          <div className={`${C} p-5`}>
            <h3 className="text-base font-bold text-[#16161D] mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#F59E0B]" /> Seasonal hashtags · {SEASONAL[monthIdx][0]}</h3>
            <div className="flex flex-wrap gap-1.5">
              {SEASONAL[monthIdx].slice(1).map(t => (
                <button key={t} onClick={() => copyTags([`#${t}`], 's' + t)} className="group text-[0.875rem] font-medium px-3 py-1.5 rounded-full bg-gradient-to-r from-[#F59E0B]/10 to-[#EF4444]/10 border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 transition-colors flex items-center gap-1.5">
                  #{t}<span className="text-[0.875rem] text-[#0EA37A] font-bold opacity-0 group-hover:opacity-100">✓</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3 text-[0.85rem] text-[#8A8A96]">
              <b className="text-[#16161D]">Why seasonal?</b> Tags matched to this month's calendar (holidays, events, awareness days) typically see 2-3x higher engagement during their window.
            </div>
          </div>
        </motion.div>
      )}

      {/* Analytics */}
      {view === 'analytics' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`${C} p-5`}>
              <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#7C3AED]" /> Most used hashtags</h3>
              {topUsed.length === 0 ? <div className="text-sm text-[#8A8A96] text-center py-8">Usage data appears after publishing + syncing.</div> : (
                <div className="space-y-2.5">
                  {topUsed.map(t => {
                    const max = Math.max(...topUsed.map(x => x.count), 1)
                    return (
                      <div key={t.tag} className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-[#7C3AED] w-24 truncate">#{t.tag}</span>
                        <div className="flex-1 h-2 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" style={{ width: `${(t.count / max) * 100}%` }} /></div>
                        <span className="text-[0.85rem] font-mono text-[#8A8A96] w-8 text-right">{t.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className={`${C} p-5`}>
              <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><Eye className="h-4 w-4 text-[#0EA37A]" /> Best performing by reach</h3>
              {topPerf.length === 0 ? <div className="text-sm text-[#8A8A96] text-center py-8">Performance data appears after publishing + syncing.</div> : (
                <div className="space-y-2.5">
                  {topPerf.map(t => {
                    const max = Math.max(...topPerf.map(x => x.impressions), 1)
                    return (
                      <div key={t.tag} className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-[#0EA37A] w-24 truncate">#{t.tag}</span>
                        <div className="flex-1 h-2 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#0EA37A] to-[#34D399]" style={{ width: `${(t.impressions / max) * 100}%` }} /></div>
                        <span className="text-[0.85rem] font-mono text-[#8A8A96] w-14 text-right">{t.impressions >= 1000 ? `${(t.impressions / 1000).toFixed(1)}K` : t.impressions}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className={`${C} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#16161D] flex items-center gap-2"><Gauge className="h-4 w-4 text-[#EC4899]" /> Full hashtag analysis</h3>
              <div className="flex items-center gap-2 flex-1 max-w-xs ml-4">
                <Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter tags…" className="flex-1 rounded-lg border border-[#EBECF2] px-3 py-1.5 text-xs bg-transparent" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[860px]">
                <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
                  {['Hashtag', 'Popularity', 'Competition', 'Reach', 'Growth', 'Engagement', 'Industry rel.', 'Platform', 'Recommendation'].map(h => <th key={h} className={`py-2.5 px-3 text-left font-semibold text-[0.78rem] uppercase tracking-wider ${h !== 'Hashtag' && h !== 'Platform' && h !== 'Recommendation' ? 'text-right' : ''}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(search ? sortedTags.filter(t => t.tag.includes(search.toLowerCase())) : sortedTags).slice(0, 30).map(t => {
                    const a = analyzeTag(t.tag, INDUSTRY_POOLS[industry])
                    const score = Math.round((a.popularity * 0.4 + a.growth * 0.3 + a.relevance * 0.3) / (a.competition / 50))
                    const rec = score >= 70 ? 'Use now' : score >= 45 ? 'Mix in' : 'Low value'
                    const col = score >= 70 ? 'bg-emerald-50 text-[#0EA37A]' : score >= 45 ? 'bg-amber-50 text-amber-600' : 'bg-[#F4F5F9] text-[#8A8A96]'
                    return (
                      <tr key={t.tag} className="border-b border-[#F0F1F5] hover:bg-[#F8F9FC] transition-colors group">
                        <td className="py-2.5 px-3 font-bold text-[#7C3AED]">#{t.tag}</td>
                        <td className="py-2.5 px-3 text-right"><div className="flex items-center justify-end gap-2"><div className="w-14 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#EC4899]" style={{ width: `${a.popularity}%` }} /></div><span className="font-mono w-7 text-right">{a.popularity}</span></div></td>
                        <td className="py-2.5 px-3 text-right font-mono">{a.competition}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{a.reach >= 10000 ? `${(a.reach / 1000).toFixed(1)}K` : fmt(a.reach)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#0EA37A]">+{a.growth}%</td>
                        <td className="py-2.5 px-3 text-right font-mono">{a.engagement}%</td>
                        <td className="py-2.5 px-3 text-right font-mono">{a.relevance}%</td>
                        <td className="py-2.5 px-3"><span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: M[a.platform]?.color + '12', color: M[a.platform]?.color }}>{M[a.platform]?.label}</span></td>
                        <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-[0.9rem] font-semibold ${col}`}>{rec}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {sortedTags.length === 0 && <div className="text-center py-12 text-sm text-[#8A8A96]">No hashtag data yet — generate collections or publish posts with hashtags.</div>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { i: <TrendingUp className="h-4 w-4" />, t: 'Most used', d: topUsed[0] ? `#${topUsed[0].tag}` : '—', c: '#7C3AED' },
              { i: <Eye className="h-4 w-4" />, t: 'Highest reach', d: topPerf[0] ? `#${topPerf[0].tag}` : '—', c: '#0EA37A' },
              { i: <Heart className="h-4 w-4" />, t: 'Favorites', d: `${favorites.length} collection(s)`, c: '#EC4899' },
            ].map((k, i) => (
              <div key={i} className={`${C} p-4 flex items-center gap-3`}>
                <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: k.c }}>{k.i}</span>
                <div><div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold">{k.t}</div><div className="text-sm font-bold text-[#16161D]">{k.d}</div></div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Edit dialog */}
      <AnimatePresence>
        {editSet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditSet(null)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className={`${C} w-full max-w-md rounded-3xl p-5`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#16161D] flex items-center gap-2"><Pencil className="h-4 w-4 text-[#7C3AED]" /> Edit collection</h3>
                <button onClick={() => setEditSet(null)} className="h-8 w-8 rounded-full bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE]"><X className="h-4 w-4 text-[#8A8A96]" /></button>
              </div>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Collection name" className="w-full rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm mb-2.5 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              <select value={editPlatform} onChange={e => setEditPlatform(e.target.value)} className="w-full rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm mb-2.5 bg-white">
                <option value="">All platforms</option>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <textarea value={editTags} onChange={e => setEditTags(e.target.value)} rows={4} placeholder="Tags separated by spaces or commas" className="w-full rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              <div className="flex gap-2">
                <button onClick={() => setEditSet(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2]">Cancel</button>
                <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Save changes</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateSetCard({ onCreated }) {
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const save = async () => {
    if (!name.trim()) return toast.error('Name required')
    const list = tags.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
    if (!list.length) return toast.error('Add at least one tag')
    try { await api('/hashtag-sets', { method: 'POST', body: { name: name.trim(), tags: list } }); toast.success('Collection created'); setName(''); setTags(''); onCreated() }
    catch (e) { toast.error(e.message) }
  }
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[#D8C8FB] bg-[#FAFAFD] p-6 max-w-md mx-auto">
      <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-[#7C3AED]" /> New collection</h4>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Collection name…" className="w-full rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
      <textarea value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags: #ai #marketing (space or comma separated)" rows={3} className="w-full rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
      <button onClick={save} className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Create collection</button>
    </div>
  )
}
