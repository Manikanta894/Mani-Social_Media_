// ============================================================================
// Discord Command Center — REST API client (dependency-free, uses fetch)
// Reads bot token from storage.settings (falls back to process.env).
// ============================================================================

import { storage } from '../storage'

const API = 'https://discord.com/api/v10'

async function token() {
  const s = await storage.settings.get()
  const t = s.discord_bot_token
  if (!t) throw new Error('Discord bot token is not configured.')
  return t
}

async function call(method, path, body) {
  const t = await token()
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Authorization': `Bot ${t}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text
    try { const j = JSON.parse(text); detail = j.message || j.error || text } catch {}
    throw new Error(`Discord ${method} ${path} failed: ${res.status} ${detail}`)
  }
  if (res.status === 204) return null
  return await res.json().catch(() => null)
}

// --- Guild / channel management -------------------------------------------

export async function getGuild(guildId) {
  return await call('GET', `/guilds/${guildId}`)
}

export async function listChannels(guildId) {
  return await call('GET', `/guilds/${guildId}/channels`)
}

export async function createChannel(guildId, { name, type = 0, topic = '', parentId = null, position = null }) {
  return await call('POST', `/guilds/${guildId}/channels`, {
    name,
    type, // 0 = text, 4 = category
    topic,
    parent_id: parentId,
    position,
  })
}

export async function createCategory(guildId, name, position = null) {
  return await call('POST', `/guilds/${guildId}/channels`, { name, type: 4, position })
}

export async function deleteChannel(channelId) {
  return await call('DELETE', `/channels/${channelId}`)
}

export async function getChannel(channelId) {
  return await call('GET', `/channels/${channelId}`)
}

// --- Messages --------------------------------------------------------------

export async function sendMessage({ channelId, content = '', embeds = [], components = [], threadName = null }) {
  const body = { content: content || undefined, embeds, components }
  if (threadName) body.thread_name = threadName
  return await call('POST', `/channels/${channelId}/messages`, body)
}

export async function editMessage({ channelId, messageId, content = '', embeds = [], components = [] }) {
  return await call('PATCH', `/channels/${channelId}/messages/${messageId}`, {
    content: content || undefined,
    embeds,
    components,
  })
}

export async function deleteMessage({ channelId, messageId }) {
  return await call('DELETE', `/channels/${channelId}/messages/${messageId}`)
}

export async function getMessage({ channelId, messageId }) {
  return await call('GET', `/channels/${channelId}/messages/${messageId}`)
}

export async function listMessages({ channelId, limit = 50, before = null }) {
  const q = new URLSearchParams({ limit: String(limit) })
  if (before) q.set('before', before)
  return await call('GET', `/channels/${channelId}/messages?${q}`)
}

// --- Threads ---------------------------------------------------------------

export async function createThread({ channelId, name, messageId = null, autoArchiveDuration = 1440 }) {
  if (messageId) {
    return await call('POST', `/channels/${channelId}/messages/${messageId}/threads`, {
      name, auto_archive_duration: autoArchiveDuration,
    })
  }
  return await call('POST', `/channels/${channelId}/threads`, {
    name, auto_archive_duration: autoArchiveDuration, type: 11,
  })
}

// --- Interactions (webhook responses) --------------------------------------

export async function respondToInteraction({ interactionId, interactionToken, type = 4, data = {} }) {
  return await call('POST', `/interactions/${interactionId}/${interactionToken}/callback`, {
    type, // 4 = CHANNEL_MESSAGE_WITH_SOURCE, 5 = DEFERRED, 6 = DEFERRED_UPDATE, 7 = UPDATE
    data,
  })
}

export async function editInteractionMessage({ interactionToken, messageId = '@original', content = '', embeds = [], components = [] }) {
  return await call('PATCH', `/webhooks/@me/${interactionToken}/messages/${messageId}`, {
    content: content || undefined,
    embeds,
    components,
  })
}

export async function deleteInteractionMessage({ interactionToken, messageId = '@original' }) {
  return await call('DELETE', `/webhooks/@me/${interactionToken}/messages/${messageId}`)
}

// --- Slash commands --------------------------------------------------------

async function appId() {
  const me = await getMe()
  return me?.id || '@me'
}

export async function registerCommands(guildId, commands) {
  const id = await appId()
  return await call('PUT', `/applications/${id}/guilds/${guildId}/commands`, commands)
}

export async function listCommands(guildId) {
  const id = await appId()
  return await call('GET', `/applications/${id}/guilds/${guildId}/commands`)
}

export async function getMe() {
  return await call('GET', '/users/@me')
}

// --- Helpers ---------------------------------------------------------------

export function embed({ title = '', description = '', color = 0x5865F2, fields = [], footer = null, timestamp = null, url = null, image = null, thumbnail = null, author = null }) {
  const e = {}
  if (title) e.title = title
  if (description) e.description = description
  if (color) e.color = color
  if (fields && fields.length) e.fields = fields
  if (footer) e.footer = { text: footer }
  if (timestamp) e.timestamp = timestamp
  if (url) e.url = url
  if (image) e.image = { url: image }
  if (thumbnail) e.thumbnail = { url: thumbnail }
  if (author) e.author = { name: author }
  return e
}

export function field(name, value, inline = false) {
  return { name: String(name).slice(0, 256), value: String(value).slice(0, 1024), inline }
}

export function button({ label, customId, style = 1, emoji = null, url = null, disabled = false }) {
  const b = { type: 2, label, style, custom_id: customId, disabled }
  if (emoji) b.emoji = { name: emoji }
  if (url) { b.url = url; b.style = 5 }
  return b
}

export function actionRow(components) {
  return { type: 1, components }
}

export function selectMenu({ customId, placeholder = 'Select…', options = [], minValues = 1, maxValues = 1 }) {
  return {
    type: 1,
    components: [{
      type: 3,
      custom_id: customId,
      placeholder,
      min_values: minValues,
      max_values: maxValues,
      options: options.map(o => ({
        label: String(o.label).slice(0, 100),
        value: String(o.value).slice(0, 100),
        description: o.description ? String(o.description).slice(0, 100) : undefined,
        emoji: o.emoji ? { name: o.emoji } : undefined,
        default: o.default || false,
      })),
    }],
  }
}

export function progressBar(percent, width = 10) {
  const filled = Math.round(Math.max(0, Math.min(100, percent)) / 100 * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function statusBadge(status) {
  const map = {
    running: '🟢 Running', waiting: '🟡 Waiting', paused: '⏸ Paused', stopped: '🔴 Stopped',
    ok: '✅ OK', error: '❌ Error', warning: '⚠️ Warning', disabled: '⚪ Disabled',
    connected: '🟢 Connected', disconnected: '🔴 Disconnected',
  }
  return map[status] || status
}