// Thin, dependency-free Telegram Bot API client.
// Reads the bot token from storage.settings (which falls back to process.env).

import { storage } from '../storage'

async function token() {
  const s = await storage.settings.get()
  const t = s.telegram_bot_token
  if (!t) throw new Error('Telegram bot token is not configured.')
  return t
}

async function call(method, body) {
  const t = await token()
  const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    throw new Error(`Telegram ${method} failed: ${data.description || res.statusText}`)
  }
  return data.result
}

export async function sendMessage({ chatId, text, replyMarkup, parseMode = 'HTML', disablePreview = true }) {
  return await call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: disablePreview,
    reply_markup: replyMarkup,
  })
}

export async function sendPhoto({ chatId, photoUrl, caption, replyMarkup, parseMode = 'HTML' }) {
  return await call('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
  })
}

export async function editMessageText({ chatId, messageId, text, replyMarkup, parseMode = 'HTML' }) {
  return await call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  })
}

export async function editMessageReplyMarkup({ chatId, messageId, replyMarkup }) {
  return await call('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  })
}

export async function answerCallbackQuery({ callbackQueryId, text, showAlert = false }) {
  return await call('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || undefined,
    show_alert: showAlert,
  })
}

export async function setWebhook({ url, secret, allowedUpdates = ['message', 'callback_query'] }) {
  return await call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: allowedUpdates,
    drop_pending_updates: true,
  })
}

export async function deleteWebhook() {
  return await call('deleteWebhook', { drop_pending_updates: true })
}

export async function getWebhookInfo() {
  return await call('getWebhookInfo', {})
}

export async function getMe() {
  return await call('getMe', {})
}
