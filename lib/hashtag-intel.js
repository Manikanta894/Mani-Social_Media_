import { storage, tableList } from './storage'

const DAY_MS = 86400000
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const cleanTag = (raw) => String(raw || '').trim().replace(/^#+/, '').replace(/\s+/g, '')
const num = (v) => Number(v) || 0

const STOPWORDS = new Set(
  'a an the and or but if then else for with about from into over under after before to of in on at by is are was were be been being have has had do does did will would should could can may might must shall not so than that this these those there here it its i we you your our my me us they them he she his her their what which who whom when where why how all any both each few more most other some such no nor own same too very just also up out off get got go going doing make made new now way'.split(' ')
)

const SEED_TAGS = [
  { tag: 'AIToolsForBusiness', industries: ['ai', 'tech', 'marketing'], score: 79, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'AIWorkflow', industries: ['ai', 'tech', 'productivity'], score: 76, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'PromptEngineering', industries: ['ai', 'tech'], score: 75, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'AIAutomation', industries: ['ai', 'tech', 'productivity'], score: 77, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'MachineLearning', industries: ['ai', 'tech'], score: 72, platforms: ['linkedin', 'twitter'] },
  { tag: 'AIPoweredProductivity', industries: ['ai', 'productivity'], score: 74, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'GenAI', industries: ['ai', 'tech', 'marketing'], score: 71, platforms: ['linkedin', 'twitter'] },
  { tag: 'AIForBusiness', industries: ['ai', 'marketing', 'tech'], score: 73, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'FutureOfWork', industries: ['tech', 'hr', 'ai'], score: 75, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'BuildInPublic', industries: ['tech', 'marketing'], score: 73, platforms: ['linkedin', 'twitter'] },
  { tag: 'IndieHackers', industries: ['tech', 'marketing'], score: 71, platforms: ['linkedin', 'twitter'] },
  { tag: 'TechTrends', industries: ['tech'], score: 68, platforms: ['linkedin', 'twitter'] },
  { tag: 'NoCode', industries: ['tech', 'productivity', 'marketing'], score: 72, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'TechStack', industries: ['tech'], score: 66, platforms: ['linkedin', 'twitter'] },
  { tag: 'DigitalTransformation', industries: ['tech', 'hr'], score: 70, platforms: ['linkedin', 'twitter'] },
  { tag: 'DeveloperProductivity', industries: ['tech', 'productivity'], score: 69, platforms: ['linkedin', 'twitter'] },
  { tag: 'ContentMarketing', industries: ['marketing'], score: 74, platforms: ['linkedin', 'instagram'] },
  { tag: 'MarketingStrategy', industries: ['marketing'], score: 72, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'PersonalBranding', industries: ['marketing', 'hr'], score: 76, platforms: ['linkedin', 'instagram'] },
  { tag: 'LinkedInTips', industries: ['marketing', 'hr', 'tech'], score: 73, platforms: ['linkedin'] },
  { tag: 'GrowthMarketing', industries: ['marketing', 'tech'], score: 71, platforms: ['linkedin', 'twitter'] },
  { tag: 'BrandStorytelling', industries: ['marketing'], score: 70, platforms: ['linkedin', 'instagram'] },
  { tag: 'EmailMarketing', industries: ['marketing'], score: 68, platforms: ['linkedin', 'twitter'] },
  { tag: 'SocialSelling', industries: ['marketing', 'hr'], score: 67, platforms: ['linkedin', 'twitter'] },
  { tag: 'EmployeeExperience', industries: ['hr'], score: 75, platforms: ['linkedin', 'instagram'] },
  { tag: 'TalentAcquisition', industries: ['hr'], score: 72, platforms: ['linkedin'] },
  { tag: 'PeopleOps', industries: ['hr', 'tech'], score: 73, platforms: ['linkedin', 'twitter'] },
  { tag: 'HRTech', industries: ['hr', 'tech'], score: 71, platforms: ['linkedin', 'twitter'] },
  { tag: 'WorkplaceCulture', industries: ['hr', 'marketing'], score: 74, platforms: ['linkedin', 'instagram'] },
  { tag: 'EmployeeEngagement', industries: ['hr'], score: 70, platforms: ['linkedin', 'instagram'] },
  { tag: 'LeadershipDevelopment', industries: ['hr', 'marketing'], score: 72, platforms: ['linkedin'] },
  { tag: 'FutureOfHR', industries: ['hr'], score: 69, platforms: ['linkedin', 'twitter'] },
  { tag: 'DeepWork', industries: ['productivity', 'tech'], score: 78, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'TimeManagement', industries: ['productivity'], score: 72, platforms: ['instagram', 'linkedin'] },
  { tag: 'WorkSmarter', industries: ['productivity', 'tech'], score: 73, platforms: ['linkedin', 'twitter', 'instagram'] },
  { tag: 'GoalSetting', industries: ['productivity'], score: 70, platforms: ['instagram', 'linkedin'] },
  { tag: 'ProductivityHacks', industries: ['productivity'], score: 68, platforms: ['instagram', 'twitter'] },
  { tag: 'MorningRoutine', industries: ['productivity'], score: 66, platforms: ['instagram'] },
  { tag: 'FocusMode', industries: ['productivity', 'tech'], score: 71, platforms: ['twitter', 'instagram'] },
  { tag: 'GettingThingsDone', industries: ['productivity'], score: 67, platforms: ['linkedin', 'twitter'] },
]

function entryMetrics(row) {
  return {
    imp: num(row.total_impressions || row.impressions),
    eng: num(row.likes) + num(row.comments) + num(row.shares) + num(row.total_engagement),
    reach: num(row.reach) || num(row.total_impressions || row.impressions),
    uses: num(row.count) || 1,
    ts: row.captured_at || row.checked_at || row.updated_at || row.created_at || null,
    platforms: Array.isArray(row.platforms) ? row.platforms : (row.platform ? [row.platform] : []),
  }
}

export function scoreTag(tag, history) {
  const rows = Array.isArray(history) ? history : []
  if (!rows.length) return 0
  let impressions = 0
  let engagement = 0
  let uses = 0
  let lastUsed = null
  const platforms = new Set()
  for (const r of rows) {
    const m = entryMetrics(r)
    impressions += m.imp
    engagement += m.eng
    uses += m.uses
    for (const p of m.platforms) platforms.add(p)
    if (m.ts && (!lastUsed || m.ts > lastUsed)) lastUsed = m.ts
  }
  const avgImp = impressions / Math.max(uses, 1)
  const impScore = clamp(Math.log10(1 + avgImp) / 7, 0, 1) * 30
  const rate = impressions > 0 ? engagement / impressions : 0
  const engScore = clamp(rate / 0.15, 0, 1) * 35
  const usageScore = clamp(Math.log2(1 + uses) / 6, 0, 1) * 15
  const recencyScore = !lastUsed ? 5 : clamp(1 - Math.max(0, Date.now() - new Date(lastUsed).getTime()) / DAY_MS / 90, 0, 1) * 10
  const fitScore = clamp(platforms.size / 4, 0, 1) * 10
  return Math.round(clamp(impScore + engScore + usageScore + recencyScore + fitScore, 0, 100))
}

function seedFallback(platform, count, industry) {
  const wants = industry ? String(industry).toLowerCase() : null
  const seeds = SEED_TAGS
    .filter(s => !wants || s.industries.includes(wants))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
  return seeds.map(s => ({
    tag: '#' + s.tag,
    score: s.score,
    reach: null,
    engagement: null,
    platforms: platform ? [platform] : s.platforms,
  }))
}

export async function getRankedHashtags({ topic, platform, count = 10, industry } = {}) {
  try {
    const [stats, analytics] = await Promise.all([
      storage.hashtagStats.list().catch(() => []),
      tableList('analytics').catch(() => []),
    ])
    const tagRows = {}
    const totals = {}
    const consider = (row) => {
      const name = cleanTag(row.tag)
      if (!name) return
      const m = entryMetrics(row)
      if (!tagRows[name]) { tagRows[name] = []; totals[name] = { reach: 0, engagement: 0 } }
      tagRows[name].push(row)
      totals[name].reach += m.reach
      totals[name].engagement += m.eng
    }
    for (const r of stats) consider(r)
    for (const r of analytics) consider(r)

    const topicWords = ((topic || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [])
    let ranked = Object.keys(tagRows).map((name) => {
      const t = totals[name]
      let score = scoreTag(name, tagRows[name])
      const pSet = new Set()
      for (const r of tagRows[name]) {
        for (const p of entryMetrics(r).platforms) pSet.add(p)
      }
      if (platform && pSet.has(platform)) score = clamp(score + 12, 0, 100)
      if (platform && pSet.size === 0) score = clamp(score - 8, 0, 100)
      if (topicWords.some(w => name.toLowerCase().includes(w))) score = clamp(score + 8, 0, 100)
      return { tag: '#' + name, score, reach: t.reach, engagement: t.engagement, platforms: [...pSet] }
    }).sort((a, b) => b.score - a.score || b.engagement - a.engagement)

    if (ranked.length < count) {
      const wants = industry ? String(industry).toLowerCase() : null
      const seen = new Set(ranked.map(r => r.tag))
      const fillers = SEED_TAGS
        .filter(s => !wants || s.industries.includes(wants))
        .filter(s => !seen.has('#' + s.tag))
        .sort((a, b) => b.score - a.score)
      for (const s of fillers) {
        if (ranked.length >= count) break
        seen.add('#' + s.tag)
        ranked.push({ tag: '#' + s.tag, score: s.score, reach: null, engagement: null, platforms: platform ? [platform] : s.platforms })
      }
    }

    ranked.sort((a, b) => b.score - a.score || b.engagement - a.engagement)
    const result = ranked.slice(0, count)
    await storage.appState.set('hashtag_intel_last', {
      at: new Date().toISOString(),
      platform: platform || null,
      tags: result.map(r => r.tag),
    }).catch(() => {})
    return result
  } catch (e) {
    return seedFallback(platform, count, industry)
  }
}

export async function recordUsage({ tags, platform, jobId } = {}) {
  try {
    const names = (Array.isArray(tags) ? tags : []).map(cleanTag).filter(Boolean)
    if (!names.length) return { ok: true, recorded: 0 }
    const existing = await storage.hashtagStats.list().catch(() => [])
    const byTag = new Map(existing.map(r => [cleanTag(r.tag), r]))
    for (const name of names) {
      const cur = byTag.get(name)
      const platforms = new Set(cur && Array.isArray(cur.platforms) ? cur.platforms : [])
      if (platform) platforms.add(platform)
      await storage.hashtagStats.upsert({
        tag: name,
        count: (cur ? num(cur.count) : 0) + 1,
        total_impressions: cur ? num(cur.total_impressions) : 0,
        total_engagement: cur ? num(cur.total_engagement) : 0,
        platforms: [...platforms],
      }).catch(() => {})
    }
    await storage.appState.set('hashtag_intel_usage', {
      at: new Date().toISOString(),
      platform: platform || null,
      jobId: jobId || null,
      tags: names,
    }).catch(() => {})
    return { ok: true, recorded: names.length }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e), recorded: 0 }
  }
}

export async function suggestForCaption({ caption, platform, count = 6 } = {}) {
  try {
    const pool = await getRankedHashtags({ platform, count: Math.max(count * 5, 30) })
    const words = ((caption || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(w => !STOPWORDS.has(w))
    const scored = pool.map(r => {
      const name = r.tag.slice(1).toLowerCase()
      const hits = words.filter(w => name.includes(w) || (name.length >= 4 && w.includes(name))).length
      return { r, hits }
    })
    const matched = scored.filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits || b.r.score - a.r.score).map(x => x.r)
    const rest = scored.filter(x => x.hits === 0).map(x => x.r)
    return matched.concat(rest).slice(0, count)
  } catch (e) {
    return seedFallback(platform, count)
  }
}
