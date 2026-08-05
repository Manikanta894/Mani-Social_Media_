// ============================================================================
// Google Sheets API client — single-user, quota-conscious.
// Service account JWT auth (no refresh tokens). All operational data lives in
// one spreadsheet; every module = one sheet (tab). Secrets never touch Sheets.
//
// Env vars:
//   GOOGLE_SPREADSHEET_ID        the spreadsheet id (share it with the service account)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL service account email
//   GOOGLE_PRIVATE_KEY           PEM private key (use single-line with \n escapes)
// ============================================================================

import crypto from 'crypto'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

let _token = null
let _tokenExp = 0
let _meta = null

function configured() {
  return !!(process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
}

export function sheetsConfigured() { return configured() }

function signJwt(claims, keyPem) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  sign.end()
  const sig = sign.sign(keyPem).toString('base64url')
  return `${header}.${payload}.${sig}`
}

// Service-account access token, cached until ~5 min before expiry.
async function accessToken() {
  if (configured() && _token && Date.now() < _tokenExp) return _token
  if (!configured()) throw new Error('Google Sheets not configured. Set GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and share the spreadsheet with the service account.')
  const now = Math.floor(Date.now() / 1000)
  const jwt = signJwt(
    {
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  )
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google auth failed ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  _token = data.access_token
  _tokenExp = Date.now() + (data.expires_in - 300) * 1000
  return _token
}

async function gFetch(url, opts = {}) {
  const token = await accessToken()
  const headers = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  // Build the request init WITHOUT a body key when there is no body — passing
  // body: undefined breaks fetch on some Node runtimes (Vercel) with
  // "fetch failed" even though it works locally.
  const init = { ...opts, headers }
  if (opts.body) init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
  const res = await fetch(url, init)
  if (res.status === 429) {
    // Quota-safe: back off once, then retry
    await new Promise(r => setTimeout(r, 1500))
    const init2 = { ...opts, headers }
    if (opts.body) init2.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    const res2 = await fetch(url, init2)
    if (!res2.ok) throw new Error(`Sheets API ${res2.status}: ${(await res2.text()).slice(0, 300)}`)
    return res2
  }
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res
}

async function gJson(url, opts = {}) {
  const res = await gFetch(url, opts)
  return res.json()
}

// ---- Spreadsheet metadata / sheet (tab) management ----

async function getSpreadsheet() {
  if (_meta) return _meta
  const data = await gJson(`${SHEETS_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}?fields=sheets(properties(sheetId,title,gridProperties))`)
  _meta = data
  return _meta
}

async function listSheetNames() {
  const meta = await getSpreadsheet()
  return (meta.sheets || []).map(s => s.properties.title)
}

export async function ensureSheet(title) {
  const names = await listSheetNames()
  if (names.includes(title)) return true
  // Add the sheet if missing
  const data = await gJson(`${SHEETS_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    body: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 5000, columnCount: 40 } } } }] },
  })
  _meta = null
  return !!data
}

// ---- Value I/O ----

export async function readValues(sheet, range = 'A1:AN') {
  const data = await gJson(`${SHEETS_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}!${range}`, { cache: 'no-store' })
  return data.values || []
}

export async function appendValues(sheet, values) {
  const url = `${SHEETS_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
  await gFetch(url, { method: 'POST', body: { values } })
  _meta = null
}

export async function clearSheet(sheet) {
  const url = `${SHEETS_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}!A2:AN`
  await gFetch(url, { method: 'DELETE' })
}

export async function writeValues(sheet, values, start = 'A1') {
  const url = `${SHEETS_BASE}/${process.env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}!${start}:AN?valueInputOption=RAW`
  await gFetch(url, { method: 'PUT', body: { values } })
  _meta = null
}

// ---- Google Drive (media store) ----

export async function driveList(folderId, pageSize = 100) {
  const q = `'${folderId}' in parents and trashed=false`
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${pageSize}&fields=files(id,name,mimeType,size,createdTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`
  const data = await gJson(url)
  return data.files || []
}

export async function driveDownload(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`
  const res = await gFetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf
}

export async function driveUpload(name, mimeType, bytes, folderId) {
  // Simple resumable-less upload: multipart is not required; use media upload then move
  const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=media&supportsAllDrives=true`
  const res = await gFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': mimeType || 'application/octet-stream', 'Content-Length': String(bytes.length) },
    body: bytes,
  })
  const file = await res.json()
  if (folderId) {
    await gFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?addParents=${encodeURIComponent(folderId)}&removeParents=root&supportsAllDrives=true`, { method: 'PATCH', body: { name } })
  } else {
    await gFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?supportsAllDrives=true`, { method: 'PATCH', body: { name } })
  }
  return file
}

export async function driveDelete(fileId) {
  await gFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, { method: 'DELETE' }).catch(() => {})
}

// True MOVE: change a file's parent folder via the Drive API. No download,
// no re-upload — instant and quota-free. Spec: "Never copy. Move."
export async function driveMove(fileId, toFolderId) {
  if (!fileId || !toFolderId) throw new Error('driveMove requires fileId and toFolderId')
  const meta = await driveMetadata(fileId)
  const parents = (meta.parents || []).join(',')
  const q = `addParents=${encodeURIComponent(toFolderId)}&removeParents=${encodeURIComponent(parents)}&supportsAllDrives=true`
  await gFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${q}`, { method: 'PATCH', body: { name: meta.name } })
  return { moved: true, toFolderId }
}

export async function driveMetadata(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,parents&supportsAllDrives=true`
  return await gJson(url)
}
