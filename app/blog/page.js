'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Loader2, Wand2, Send, ImageIcon, Eye, Globe, Pencil, X, Save, ExternalLink, Clock, RotateCcw, ChevronDown, ChevronUp, List, Plus, Trash2, Copy, Check, LayoutDashboard, FileText, CalendarDays, CheckCircle, Search, Gauge, Sparkles, Zap, PenLine, Newspaper, Hash, Dribbble, Link, History, MoreHorizontal, AlertTriangle, Bot } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'
import { SeoPanel, SeoSuggestions, GooglePreview, AssistantPanel, RepurposePanel, blogSeo } from './studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()

export default function BlogPage() {
  const [posts, setPosts] = useState([])
  const [activePost, setActivePost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [context, setContext] = useState('')
  const [styleId, setStyleId] = useState('')
  const [styles, setStyles] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSeo, setEditSeo] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [createMode, setCreateMode] = useState('topic')
  const [libraryFilter, setLibraryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [dripOpen, setDripOpen] = useState(false)
  const [dripCount, setDripCount] = useState(4)
  const [dripSpread, setDripSpread] = useState(5)
  const [dripRunning, setDripRunning] = useState(false)
  const [dripResult, setDripResult] = useState(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [autoSaved, setAutoSaved] = useState(false)
  const bodyRef = useRef(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([api('/blog/posts'), api('/prompt-styles')])
      setPosts(p || []); setStyles(s || [])
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  // Autosave draft body
  useEffect(() => {
    if (!editing || !activePost) return
    const t = setTimeout(() => { localStorage.setItem('sf_blog_autosave', JSON.stringify({ id: activePost.id, title: editTitle, body: editBody, seo: editSeo })); setAutoSaved(true); setTimeout(() => setAutoSaved(false), 2000) }, 1200)
    return () => clearTimeout(t)
  }, [editBody, editTitle, editSeo, editing])

  const handleImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => { const base64 = ev.target.result.split(',')[1]; setImageBase64(base64); setImagePreview(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const generate = async () => {
    if (!context.trim()) return toast.error('Enter a topic or context first')
    setGenerating(true)
    try {
      const result = await api('/blog/generate', {
        method: 'POST',
        body: { context: context.trim(), style_id: styleId || undefined, imageBase64: imageBase64 || undefined, mimeType: 'image/jpeg', imageUrl: imagePreview || undefined },
      })
      const bp = await api('/blog/posts', {
        method: 'POST',
        body: { title: result.title, body_markdown: result.body_markdown, seo_description: result.seo_description, status: 'draft' },
      })
      setActivePost(bp); setEditing(true)
      setEditTitle(bp.title); setEditBody(bp.body_markdown); setEditSeo(bp.seo_description || ''); setEditSlug(bp.slug || ''); setEditCategory(bp.category || ''); setEditTags((bp.tags || []).join(', '))
      setShowPreview(true)
      toast.success('Article generated — review before publishing')
      setContext(''); setImageFile(null); setImagePreview(null); setImageBase64(null)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const publishNow = async () => {
    if (!activePost) return
    setPublishing(true)
    try {
      const result = await api('/blog/publish/' + activePost.id, { method: 'POST', body: { dry_run: false } })
      toast.success('Published to INSIGHTS!')
      setActivePost(prev => ({ ...prev, status: 'published', published_url: result.url }))
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setPublishing(false) }
  }

  const scheduleForLater = async () => {
    if (!activePost) return
    const dateVal = scheduleDate || new Date().toISOString().split('T')[0]
    const timeVal = scheduleTime || '10:00'
    try {
      const sched = new Date(`${dateVal}T${timeVal}:00`).toISOString()
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { status: 'scheduled', scheduled_for: sched } })
      toast.success(`Scheduled for ${dateVal} at ${timeVal}`)
      setActivePost(prev => ({ ...prev, status: 'scheduled' }))
      setScheduleDate(''); setScheduleTime('')
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const regenerate = async () => {
    if (!activePost) return
    setGenerating(true)
    try {
      const result = await api('/blog/generate', { method: 'POST', body: { context: editTitle + ' — ' + (editSeo || ''), style_id: styleId || undefined } })
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { title: result.title, body_markdown: result.body_markdown, seo_description: result.seo_description } })
      toast.success('Regenerated')
      setEditTitle(result.title); setEditBody(result.body_markdown); setEditSeo(result.seo_description || '')
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const saveEdit = async () => {
    if (!activePost) return
    try {
      const slug = editSlug || (editTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const body = { title: editTitle, body_markdown: editBody, seo_description: editSeo, slug, category: editCategory || null, tags: editTags.split(',').map(t => t.trim()).filter(Boolean) }
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body })
      toast.success('Saved')
      setActivePost(prev => ({ ...prev, ...body }))
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const selectPost = (p) => {
    setActivePost(p); setEditing(true)
    setEditTitle(p.title); setEditBody(p.body_markdown); setEditSeo(p.seo_description || ''); setEditSlug(p.slug || ''); setEditCategory(p.category || ''); setEditTags((p.tags || []).join(', '))
    setShowPreview(true)
  }
  const newArticle = () => { setActivePost(null); setEditing(false); setShowPreview(false); setContext(''); setCreateMode('topic'); document.querySelector('#topic-input')?.focus() }

  const runDrip = async () => {
    if (!activePost) return; setDripRunning(true); setDripResult(null)
    try { const result = await api('/blog-drip/' + activePost.id, { method: 'POST', body: { count: dripCount, spread_days: dripSpread } }); setDripResult(result); toast.success('Scheduled ' + result.total + ' drip posts') }
    catch (e) { toast.error(e.message) } finally { setDripRunning(false) }
  }

  const duplicatePost = async (p) => {
    try {
      const bp = await api('/blog/posts', { method: 'POST', body: { title: p.title + ' (copy)', body_markdown: p.body_markdown, seo_description: p.seo_description, status: 'draft' } })
      toast.success('Duplicated'); refresh()
      return bp
    } catch (e) { toast.error(e.message) }
  }
  const deletePost = async (p) => {
    if (!confirm(`Delete "${p.title?.slice(0, 40)}"?`)) return
    try { await api('/blog/posts/' + p.id, { method: 'PUT', body: { status: 'rejected' } }); toast.success('Archived'); if (activePost?.id === p.id) setActivePost(null); refresh() }
    catch (e) { toast.error(e.message) }
  }
  const bulkDelete = async () => { for (const id of selected) { try { await api('/blog/posts/' + id, { method: 'PUT', body: { status: 'rejected' } }) } catch {} } toast.success('Archived ' + selected.length); setSelected([]); refresh() }

  const seo = blogSeo(editTitle, editBody, editSeo, editSlug, imagePreview)
  const filtered = posts.filter(p => {
    if (libraryFilter !== 'all' && p.status !== libraryFilter) return false
    if (search && !(p.title || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const kpis = [
    { l: 'Total Articles', v: fmt(posts.length), c: '#7C3AED' },
    { l: 'Drafts', v: fmt(posts.filter(p => p.status === 'draft').length), c: '#8A8A96' },
    { l: 'Scheduled', v: fmt(posts.filter(p => p.status === 'scheduled').length), c: '#3B82F6' },
    { l: 'Published', v: fmt(posts.filter(p => p.status === 'published').length), c: '#0EA37A' },
    { l: 'Avg SEO Score', v: `${posts.length ? Math.round(posts.reduce((a, p) => a + blogSeo(p.title, p.body_markdown, p.seo_description, p.slug).seo, 0) / posts.length) : 0}`, c: '#EC4899' },
    { l: 'Total Views', v: fmt(posts.reduce((a, p) => a + (p.views || 0), 0)), c: '#14B8A6' },
    { l: 'Categories', v: fmt(new Set(posts.map(p => p.category).filter(Boolean)).size), c: '#F59E0B' },
    { l: 'Words Written', v: fmt(posts.reduce((a, p) => a + ((p.body_markdown || '').match(/[A-Za-z0-9]+/g) || []).length, 0)), c: '#8B5CF6' },
  ]
  const libraryActions = [['all', 'All'], ['draft', 'Drafts'], ['scheduled', 'Scheduled'], ['published', 'Published'], ['rejected', 'Archived']]

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading Blog Studio…</div>

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0EA37A] to-[#14B8A6] flex items-center justify-center shadow-lg shadow-[#0EA37A]/25"><PenLine className="h-5 w-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-[#16161D] tracking-tight">Blog Studio</h1><p className="text-sm text-[#8A8A96]">Create, optimize, schedule and publish professional SEO articles directly to INSIGHTS.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={newArticle} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#0EA37A] to-[#14B8A6] shadow-md hover:opacity-90"><Plus className="h-4 w-4" /> New Article</button>
          <button onClick={refresh} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><RefreshCw className="h-4 w-4 text-[#8A8A96]" /></button>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={{ animate: { transition: { staggerChildren: 0.04 } } }} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(k => (
          <motion.div key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all`}>
            <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-[#8A8A96]">{k.l}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.c }}>{k.v}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_330px] gap-5 items-start">
        {/* ============ LEFT: Library ============ */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
            <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-[#7C3AED]" /> Quick Actions</h4>
            <div className="space-y-1">
              {[
                { l: 'New Article', a: newArticle, i: <Plus className="h-3.5 w-3.5" />, c: '#0EA37A' },
                { l: 'Drafts', a: () => setLibraryFilter('draft'), i: <FileText className="h-3.5 w-3.5" />, c: '#8A8A96' },
                { l: 'Scheduled', a: () => setLibraryFilter('scheduled'), i: <CalendarDays className="h-3.5 w-3.5" />, c: '#3B82F6' },
                { l: 'Published', a: () => setLibraryFilter('published'), i: <CheckCircle className="h-3.5 w-3.5" />, c: '#0EA37A' },
                { l: 'Templates', a: () => setCreateMode('template'), i: <Sparkles className="h-3.5 w-3.5" />, c: '#EC4899' },
              ].map(qa => (
                <button key={qa.l} onClick={qa.a} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.7rem] font-semibold text-[#16161D] hover:bg-[#F8F9FC] hover:text-[#7C3AED] transition-colors">
                  <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: qa.c + '12', color: qa.c }}>{qa.i}</span>{qa.l}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} overflow-hidden`}>
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 mb-3"><h4 className="text-sm font-bold text-[#16161D] flex-1">Article Library</h4>
                {selected.length > 0 && <button onClick={bulkDelete} className="text-[0.6rem] font-bold px-2 py-1 rounded-lg bg-red-50 text-red-500">Archive {selected.length}</button>}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2 mb-2.5">
                <Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…" className="flex-1 bg-transparent text-xs focus:outline-none" />
              </div>
              <div className="flex gap-1 mb-3 flex-wrap">
                {libraryActions.map(([k, l]) => (
                  <button key={k} onClick={() => setLibraryFilter(k)} className={`text-[0.6rem] font-semibold px-2.5 py-1.5 rounded-full transition-all ${libraryFilter === k ? 'bg-[#7C3AED] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto border-t border-[#F0F1F5]">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-[0.7rem] text-[#8A8A96]">No articles here yet. Generate your first article.</div>
              ) : filtered.map(p => {
                const s = blogSeo(p.title, p.body_markdown, p.seo_description, p.slug)
                const statusColor = { draft: '#8A8A96', scheduled: '#3B82F6', published: '#0EA37A', rejected: '#EF4444' }[p.status] || '#8A8A96'
                return (
                  <div key={p.id} className={`px-4 py-3 border-b border-[#F0F1F5] cursor-pointer hover:bg-[#F8F9FC] transition-colors group ${activePost?.id === p.id ? 'bg-[#7C3AED]/5' : ''}`} onClick={() => selectPost(p)}>
                    <div className="flex items-center gap-2 mb-1">
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={e => { e.stopPropagation(); setSelected(sel => e.target.checked ? [...sel, p.id] : sel.filter(x => x !== p.id)) }} className="accent-[#7C3AED] shrink-0" onClick={e => e.stopPropagation()} />
                      <span className="text-xs font-semibold text-[#16161D] truncate flex-1">{p.title || 'Untitled'}</span>
                      <span className="text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: statusColor + '15', color: statusColor }}>{p.status}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[0.55rem] text-[#8A8A96]">{p.category || 'uncategorized'}</span>
                      <span className="text-[0.55rem] font-bold text-[#7C3AED]">{s.seo}</span>
                      <span className="text-[0.55rem] text-[#8A8A96] font-mono">{s.readTime}m</span>
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.status === 'published' && p.published_url && <a href={p.published_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[0.6rem] text-[#0EA37A]"><ExternalLink className="h-3 w-3" /></a>}
                        <button onClick={e => { e.stopPropagation(); duplicatePost(p) }} className="text-[0.6rem] text-[#8A8A96] hover:text-[#7C3AED]"><Copy className="h-3 w-3" /></button>
                        <button onClick={e => { e.stopPropagation(); deletePost(p) }} className="text-[0.6rem] text-[#8A8A96] hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* ============ CENTER: Editor ============ */}
        <div className="space-y-4">
          {!activePost ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-6`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0EA37A]/10 to-[#14B8A6]/10 flex items-center justify-center"><PenLine className="h-5 w-5 text-[#0EA37A]" /></div>
                <div><h3 className="text-lg font-bold text-[#16161D]">New Article</h3><p className="text-sm text-[#8A8A96]">Generate a full SEO article from any source.</p></div>
              </div>
              <div className="flex gap-1 bg-[#F4F5F9] rounded-xl p-1 mb-4 flex-wrap">
                {[['topic', 'Topic'], ['keywords', 'Keywords'], ['url', 'URL'], ['research', 'Research Paper'], ['pdf', 'PDF'], ['youtube', 'YouTube'], ['markdown', 'Markdown'], ['notes', 'Notes'], ['prompt', 'AI Prompt']].map(([k, l]) => (
                  <button key={k} onClick={() => setCreateMode(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${createMode === k ? 'bg-white shadow-sm text-[#0EA37A]' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{l}</button>
                ))}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <textarea id="topic-input" value={context} onChange={e => setContext(e.target.value)} rows={4}
                    placeholder={createMode === 'topic' ? 'Topic: "How AI is transforming HR recruitment in 2026"…' : createMode === 'keywords' ? 'Paste target keywords, one per line…' : createMode === 'url' ? 'Paste an article/blog URL to rewrite…' : createMode === 'prompt' ? 'Describe the article you want, in detail…' : `Paste ${createMode.replace('_', ' ')} content here…`}
                    className="w-full rounded-xl border border-[#EBECF2] px-4 py-3.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0EA37A]/20" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={styleId} onChange={e => setStyleId(e.target.value)} className="rounded-xl border border-[#EBECF2] px-3 py-2.5 text-xs bg-white">
                      <option value="">Default writing style</option>{styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <label className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-[#EBECF2] px-3 py-2.5 text-xs font-semibold text-[#8A8A96] hover:border-[#D8C8FB]">
                      <ImageIcon className="h-3.5 w-3.5" />{imageFile ? 'Cover set' : 'Cover image'}<input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                    </label>
                    <span className="text-[0.6rem] text-[#8A8A96]">Vision AI reads your cover image for context</span>
                  </div>
                  {imagePreview && <img src={imagePreview} alt="" className="h-24 rounded-xl object-cover" />}
                  <button onClick={generate} disabled={generating || !context.trim()} className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#0EA37A] to-[#14B8A6] shadow-md disabled:opacity-50">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Wand2 className="h-4 w-4 inline mr-2" />}{generating ? 'Writing your article…' : 'Generate SEO Article'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                <div className="rounded-xl bg-gradient-to-br from-[#0EA37A]/8 to-[#14B8A6]/8 border border-[#EBECF2] p-4">
                  <div className="text-xs font-bold text-[#16161D] mb-2 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-[#0EA37A]" /> AI does everything</div>
                  <p className="text-[0.7rem] text-[#8A8A96] leading-relaxed">Title, meta description, slug, headings, FAQ, internal links and schema — generated and optimized automatically.</p>
                </div>
                <div className="rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-4">
                  <div className="text-xs font-bold text-[#16161D] mb-2 flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5 text-[#7C3AED]" /> SEO Center</div>
                  <p className="text-[0.7rem] text-[#8A8A96] leading-relaxed">Real-time scores for title, meta, headings, keywords, readability, links and alt tags — with fixes.</p>
                </div>
                <div className="rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-4">
                  <div className="text-xs font-bold text-[#16161D] mb-2 flex items-center gap-1.5"><Send className="h-3.5 w-3.5 text-[#EC4899]" /> One-click publish</div>
                  <p className="text-[0.7rem] text-[#8A8A96] leading-relaxed">Schedule, publish live to INSIGHTS, or drip the article into a 5-day social campaign.</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Editor toolbar */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ({ draft: '#8A8A96', scheduled: '#3B82F6', published: '#0EA37A', rejected: '#EF4444' }[activePost.status] || '#8A8A96') + '15', color: { draft: '#8A8A96', scheduled: '#3B82F6', published: '#0EA37A', rejected: '#EF4444' }[activePost.status] || '#8A8A96' }}>{activePost.status}</span>
                  <span className="text-[0.6rem] text-[#8A8A96] font-mono">{seo.words} words · {seo.readTime}m read</span>
                  {autoSaved && <span className="text-[0.6rem] text-[#0EA37A] font-semibold flex items-center gap-1"><Check className="h-3 w-3" /> Auto-saved</span>}
                  {activePost.published_url && <a href={activePost.published_url} target="_blank" rel="noreferrer" className="text-[0.65rem] text-[#0EA37A] hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> View live</a>}
                  <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                    <button onClick={saveEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0EA37A] to-[#14B8A6]"><Save className="h-3.5 w-3.5" /> Save</button>
                    <button onClick={() => setDripOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><Dribbble className="h-3.5 w-3.5 text-[#7C3AED]" /> Drip</button>
                    {activePost.status !== 'published' && <button onClick={publishNow} disabled={publishing} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">{publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish</button>}
                  </div>
                </div>
              </motion.div>

              {/* Editor */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} overflow-hidden`}>
                <div className="p-5 space-y-3">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Article title…" className="w-full text-xl font-bold text-[#16161D] rounded-xl border border-[#EBECF2] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editSeo} onChange={e => setEditSeo(e.target.value)} placeholder="Meta description (120-165 chars)…" className="rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                    <input value={editSlug} onChange={e => setEditSlug(e.target.value)} placeholder="slug-auto-generated" className="rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Category (ai, tech, business…)" className="rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                    <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="Tags (comma separated)" className="rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  </div>
                  <textarea ref={bodyRef} value={editBody} onChange={e => setEditBody(e.target.value)} rows={26} placeholder="Write in Markdown — ## headings, > quotes, [links](url), ![alt](image)…" className="w-full text-sm leading-relaxed font-mono rounded-xl border border-[#EBECF2] px-4 py-3.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  <div className="flex gap-2 flex-wrap text-[0.6rem] text-[#8A8A96]">
                    <span className="px-2.5 py-1 rounded-full bg-[#F4F5F9]">## Heading</span><span className="px-2.5 py-1 rounded-full bg-[#F4F5F9]">**bold**</span><span className="px-2.5 py-1 rounded-full bg-[#F4F5F9]">[text](url)</span><span className="px-2.5 py-1 rounded-full bg-[#F4F5F9]">![alt](img)</span><span className="px-2.5 py-1 rounded-full bg-[#F4F5F9]">{'>'} quote</span><span className="px-2.5 py-1 rounded-full bg-[#F4F5F9]">- list</span>
                  </div>
                </div>
              </motion.div>

              {/* Assistant + repurpose */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AssistantPanel title={editTitle} body={editBody} onInsert={(chunk) => setEditBody(b => b + '\n\n' + chunk)} />
                <RepurposePanel title={editTitle} body={editBody} onDrip={() => setDripOpen(true)} />
              </div>
            </>
          )}
        </div>

        {/* ============ RIGHT: SEO & Preview ============ */}
        <div className="space-y-4">
          {activePost ? (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><SeoPanel post={{ title: editTitle, body_markdown: editBody, seo_description: editSeo, slug: editSlug, image_ref: imagePreview }} /></motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><GooglePreview post={{ title: editTitle, seo_description: editSeo, slug: editSlug }} /></motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><SeoSuggestions post={{ title: editTitle, body_markdown: editBody, seo_description: editSeo, slug: editSlug }} onApply={() => {
                const s = blogSeo(editTitle, editBody, editSeo, editSlug)
                const fixes = []
                if ((editTitle || '').length < 30) fixes.push((e) => e + ' — The Complete Guide')
                if (s.h2s < 3) fixes.push((e) => e + '\n\n## What You Need to Know\n\n(Add your first key insight here.)')
                if (!/## FAQ/i.test(editBody)) fixes.push((e) => e + '\n\n## FAQ\n\n**Question 1?**\nAnswer here.\n\n**Question 2?**\nAnswer here.')
                let b = editBody
                fixes.forEach(f => { b = f(b) })
                setEditBody(b)
                if ((editSeo || '').length < 120) setEditSeo(editSeo || (editTitle + ' — practical insights and strategies explained clearly. Read the full guide.').slice(0, 160))
                toast.success('Improvements applied')
              }} /></motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
                <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-[#3B82F6]" /> Scheduling</h4>
                <div className="flex items-center gap-2">
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="flex-1 rounded-xl border border-[#EBECF2] px-3 py-2.5 text-xs min-w-0" />
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="rounded-xl border border-[#EBECF2] px-3 py-2.5 text-xs" />
                </div>
                <button onClick={scheduleForLater} className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold bg-[#3B82F6] text-white">Schedule for later</button>
              </motion.div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-6 text-center`}>
              <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0EA37A]/10 to-[#14B8A6]/10 flex items-center justify-center mb-3"><Gauge className="h-5 w-5 text-[#0EA37A]" /></div>
              <h4 className="text-sm font-bold text-[#16161D]">SEO & preview panel</h4>
              <p className="text-[0.7rem] text-[#8A8A96] mt-1.5 leading-relaxed">Select or generate an article — real-time SEO scores, Google preview, AI review and scheduling appear here.</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Drip dialog */}
      <AnimatePresence>
        {dripOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDripOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className={`${C} w-full max-w-md rounded-3xl p-5`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5"><div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><Dribbble className="h-4 w-4 text-white" /></div>
                  <div><h3 className="text-base font-bold text-[#16161D]">Drip to Social</h3><p className="text-[0.65rem] text-[#8A8A96]">Break into {dripCount} posts across {dripSpread} days</p></div></div>
                <button onClick={() => setDripOpen(false)} className="h-8 w-8 rounded-full bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE]"><X className="h-4 w-4 text-[#8A8A96]" /></button>
              </div>
              <div className="space-y-3">
                <div><div className="flex justify-between text-xs mb-1"><span className="text-[#8A8A96]">Number of posts</span><span className="font-bold text-[#16161D]">{dripCount}</span></div><input type="range" min="3" max="5" value={dripCount} onChange={e => setDripCount(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" /></div>
                <div><div className="flex justify-between text-xs mb-1"><span className="text-[#8A8A96]">Spread across (days)</span><span className="font-bold text-[#16161D]">{dripSpread}</span></div><input type="range" min="3" max="7" value={dripSpread} onChange={e => setDripSpread(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" /></div>
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3 space-y-1.5">
                  <div className="text-xs font-bold text-[#16161D] mb-1">Schedule preview</div>
                  {Array.from({ length: dripCount }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + Math.floor((dripSpread / dripCount) * i) + 1); d.setHours(10 + (i % 8), 0, 0, 0); return (
                    <div key={i} className="flex items-center gap-2 text-[0.65rem] text-[#8A8A96]"><span className="font-bold text-[#16161D] w-5">#{i + 1}</span><span>{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="ml-auto text-[0.5rem]">LinkedIn · IG · FB · Threads</span></div>
                  ) })}
                </div>
                {dripResult && <div className="rounded-xl bg-[#0EA37A]/8 border border-[#0EA37A]/20 p-3 text-[0.7rem] text-[#0EA37A] font-semibold">Scheduled {dripResult.total} drip posts!</div>}
                <button onClick={runDrip} disabled={dripRunning} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-md disabled:opacity-50">{dripRunning ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Send className="h-4 w-4 inline mr-2" />}{dripRunning ? 'Generating…' : 'Generate & Schedule'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
