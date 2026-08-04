import { EVENTS as DB_EVENTS, SEASON_EVENTS, EVENT_CATEGORIES } from './seasonal-db'

export const ALL_EVENTS = [...DB_EVENTS, ...SEASON_EVENTS]
export const CATEGORY_META = EVENT_CATEGORIES

const FESTIVALS = [
  // January
  { month: 1, day: 1, name: 'New Year\'s Day', type: 'observance', industry: 'general', emoji: '🎉' },
  { month: 1, day: 14, name: 'Makar Sankranti / Pongal', type: 'festival', industry: 'general', emoji: '🪁' },
  { month: 1, day: 26, name: 'Republic Day of India', type: 'national', industry: 'general', emoji: '🇮🇳' },
  { month: 1, day: 30, name: 'Martyr\'s Day', type: 'observance', industry: 'general', emoji: '🕊️' },

  // February
  { month: 2, day: 14, name: 'Valentine\'s Day', type: 'observance', industry: 'lifestyle', emoji: '💝' },
  { month: 2, day: 19, name: 'Shivaji Jayanti', type: 'festival', industry: 'regional', emoji: '🛡️' },
  { month: 2, day: 26, name: 'Maha Shivaratri', type: 'festival', industry: 'general', emoji: '🕉️' },

  // March
  { month: 3, day: 8, name: 'International Women\'s Day', type: 'observance', industry: 'general', emoji: '👩' },
  { month: 3, day: 14, name: 'Holika Dahan', type: 'festival', industry: 'general', emoji: '🔥' },
  { month: 3, day: 15, name: 'Holi', type: 'festival', industry: 'general', emoji: '🎨' },
  { month: 3, day: 22, name: 'World Water Day', type: 'observance', industry: 'environment', emoji: '💧' },
  { month: 3, day: 25, name: 'Gudi Padwa / Ugadi', type: 'festival', industry: 'general', emoji: '🌺' },
  { month: 3, day: 31, name: 'Eid-ul-Fitr', type: 'festival', industry: 'general', emoji: '🌙' },

  // April
  { month: 4, day: 1, name: 'April Fools\' Day', type: 'observance', industry: 'fun', emoji: '😂' },
  { month: 4, day: 7, name: 'World Health Day', type: 'observance', industry: 'health', emoji: '🏥' },
  { month: 4, day: 14, name: 'Ambedkar Jayanti', type: 'festival', industry: 'general', emoji: '📚' },
  { month: 4, day: 14, name: 'Baisakhi / Vishu', type: 'festival', industry: 'general', emoji: '🌾' },
  { month: 4, day: 22, name: 'Earth Day', type: 'observance', industry: 'environment', emoji: '🌍' },
  { month: 4, day: 23, name: 'World Book Day', type: 'observance', industry: 'education', emoji: '📖' },

  // May
  { month: 5, day: 1, name: 'Labour Day / Maharashtra Day', type: 'observance', industry: 'general', emoji: '⚒️' },
  { month: 5, day: 9, name: 'Rabindranath Tagore Jayanti', type: 'observance', industry: 'culture', emoji: '🎭' },
  { month: 5, day: 12, name: 'Mother\'s Day', type: 'observance', industry: 'lifestyle', emoji: '💐' },
  { month: 5, day: 18, name: 'Buddha Purnima', type: 'festival', industry: 'general', emoji: '☸️' },

  // June
  { month: 6, day: 1, name: 'Global Day of Parents', type: 'observance', industry: 'lifestyle', emoji: '👨‍👩‍👧' },
  { month: 6, day: 5, name: 'World Environment Day', type: 'observance', industry: 'environment', emoji: '🌿' },
  { month: 6, day: 16, name: 'Father\'s Day', type: 'observance', industry: 'lifestyle', emoji: '👔' },
  { month: 6, day: 21, name: 'International Yoga Day', type: 'observance', industry: 'health', emoji: '🧘' },

  // July
  { month: 7, day: 1, name: 'National Doctor\'s Day', type: 'observance', industry: 'health', emoji: '🩺' },
  { month: 7, day: 7, name: 'World Chocolate Day', type: 'observance', industry: 'food', emoji: '🍫' },
  { month: 7, day: 17, name: 'World Emoji Day', type: 'observance', industry: 'fun', emoji: '😊' },
  { month: 7, day: 28, name: 'World Nature Conservation Day', type: 'observance', industry: 'environment', emoji: '🌳' },

  // August
  { month: 8, day: 1, name: 'Friendship Day', type: 'observance', industry: 'lifestyle', emoji: '🤝' },
  { month: 8, day: 7, name: 'Raksha Bandhan', type: 'festival', industry: 'general', emoji: '🎀' },
  { month: 8, day: 15, name: 'Independence Day', type: 'national', industry: 'general', emoji: '🇮🇳' },
  { month: 8, day: 16, name: 'Janmashtami', type: 'festival', industry: 'general', emoji: '🦚' },
  { month: 8, day: 26, name: 'Ganesh Chaturthi', type: 'festival', industry: 'general', emoji: '🐘' },
  { month: 8, day: 29, name: 'National Sports Day', type: 'observance', industry: 'sports', emoji: '🏅' },

  // September
  { month: 9, day: 5, name: 'Teacher\'s Day', type: 'observance', industry: 'education', emoji: '🍎' },
  { month: 9, day: 15, name: 'Engineer\'s Day', type: 'observance', industry: 'tech', emoji: '⚙️' },
  { month: 9, day: 27, name: 'World Tourism Day', type: 'observance', industry: 'travel', emoji: '✈️' },

  // October
  { month: 10, day: 1, name: 'Gandhi Jayanti', type: 'national', industry: 'general', emoji: '🕊️' },
  { month: 10, day: 2, name: 'International Day of Non-Violence', type: 'observance', industry: 'general', emoji: '☮️' },
  { month: 10, day: 5, name: 'Navratri begins', type: 'festival', industry: 'general', emoji: '💃' },
  { month: 10, day: 10, name: 'World Mental Health Day', type: 'observance', industry: 'health', emoji: '🧠' },
  { month: 10, day: 14, name: 'Dussehra / Vijayadashami', type: 'festival', industry: 'general', emoji: '🏹' },
  { month: 10, day: 20, name: 'Karwa Chauth', type: 'festival', industry: 'lifestyle', emoji: '🌙' },
  { month: 10, day: 27, name: 'World Day for Audiovisual Heritage', type: 'observance', industry: 'culture', emoji: '🎬' },
  { month: 10, day: 31, name: 'Halloween', type: 'observance', industry: 'fun', emoji: '🎃' },

  // November
  { month: 11, day: 1, name: 'World Vegan Day', type: 'observance', industry: 'food', emoji: '🥗' },
  { month: 11, day: 7, name: 'Diwali / Deepavali', type: 'festival', industry: 'general', emoji: '🪔' },
  { month: 11, day: 8, name: 'Govardhan Puja', type: 'festival', industry: 'general', emoji: '⛰️' },
  { month: 11, day: 9, name: 'Bhai Dooj', type: 'festival', industry: 'general', emoji: '🎊' },
  { month: 11, day: 14, name: 'Children\'s Day', type: 'observance', industry: 'education', emoji: '🧒' },
  { month: 11, day: 15, name: 'Guru Nanak Jayanti', type: 'festival', industry: 'general', emoji: '🙏' },
  { month: 11, day: 19, name: 'International Men\'s Day', type: 'observance', industry: 'lifestyle', emoji: '👨' },
  { month: 11, day: 25, name: 'International Day for Elimination of Violence against Women', type: 'observance', industry: 'social', emoji: '💜' },

  // December
  { month: 12, day: 1, name: 'World AIDS Day', type: 'observance', industry: 'health', emoji: '❤️' },
  { month: 12, day: 2, name: 'National Pollution Control Day', type: 'observance', industry: 'environment', emoji: '🌫️' },
  { month: 12, day: 10, name: 'Human Rights Day', type: 'observance', industry: 'social', emoji: '🤲' },
  { month: 12, day: 14, name: 'National Energy Conservation Day', type: 'observance', industry: 'environment', emoji: '💡' },
  { month: 12, day: 22, name: 'National Mathematics Day', type: 'observance', industry: 'education', emoji: '🔢' },
  { month: 12, day: 25, name: 'Christmas', type: 'festival', industry: 'general', emoji: '🎄' },
  { month: 12, day: 31, name: 'New Year\'s Eve', type: 'observance', industry: 'general', emoji: '🎆' },
]

const CAPTION_TEMPLATES = {
  festival: [
    'Wishing everyone a joyous {name}! May this {name} bring happiness, prosperity, and good fortune to all.',
    'Celebrating {name} today! How are you marking this special occasion? Share your traditions with us.',
    'Happy {name} to all who celebrate! May the festivities bring warmth and togetherness.',
  ],
  national: [
    'Proud to celebrate {name}. Let\'s honour the spirit of our nation today.',
    'On this {name}, let\'s remember the values that unite us.',
    'Celebrating {name} — a day to reflect on our heritage and look forward to a brighter future.',
  ],
  global: [
    'Marking {name} today. A great time to reflect and take action.',
    'It\'s {name}! Here\'s how you can participate and make a difference.',
    'On this {name}, let\'s spread awareness and drive positive change.',
  ],
  industry: [
    'Celebrating {name}! A key moment for professionals and enthusiasts alike.',
    'It\'s {name}! Here\'s what this means for the industry and how you can get involved.',
    'On {name}, we recognise the importance of this field and its impact on our world.',
  ],
  observance: [
    'Marking {name} today. A great time to reflect and take action.',
    'It\'s {name}! Here\'s how you can participate and make a difference.',
    'On this {name}, let\'s spread awareness and drive positive change.',
  ],
  health: [
    'On {name}, let\'s prioritise wellbeing and self-care.',
    'Raising awareness on {name}. Small steps lead to big changes.',
    'This {name}, take a moment for your health — mental and physical.',
  ],
  environment: [
    'On {name}, let\'s commit to protecting our planet. Every action counts.',
    'Celebrating {name} — what\'s one change you\'ll make for a greener future?',
    'This {name}, remember: we don\'t inherit the earth from our ancestors, we borrow it from our children.',
  ],
  marketing: [
    'On {name}, we celebrate the creativity that drives connection and commerce.',
    'Happy {name}! Here\'s how brands and creators are making an impact.',
    'Celebrating {name} — the intersection of strategy, creativity, and technology.',
  ],
  tech: [
    'Happy {name}! Celebrating the innovators and problem-solvers.',
    'On {name}, we salute the minds that build our future.',
    'Celebrating {name} — technology is best when it brings people together.',
  ],
  education: [
    'On {name}, we celebrate the power of knowledge and learning.',
    'Happy {name}! Education is the most powerful weapon to change the world.',
    'Celebrating {name} — never stop learning, never stop growing.',
  ],
  food: [
    'Celebrating {name}! What\'s your favourite way to enjoy this day?',
    'It\'s {name}! Time to indulge and share the goodness.',
    'On {name}, we celebrate the flavours that bring us together.',
  ],
  lifestyle: [
    'Happy {name}! Tag someone special and spread the love.',
    'Celebrating {name} today — who are you celebrating with?',
    'It\'s {name}! A perfect reminder to appreciate the people in our lives.',
  ],
  travel: [
    'Happy {name}! Time to explore, discover, and wander.',
    'On {name}, we celebrate the joy of travel and discovery.',
    'Travel broadens the mind. This {name}, where will you go next?',
  ],
  social: [
    'On {name}, let\'s stand together for equality, dignity, and justice.',
    'Raising awareness on {name}. Change begins with each of us.',
    'This {name}, let\'s amplify voices that need to be heard.',
  ],
  hr: [
    'On {name}, we celebrate the people who make organisations thrive.',
    'Happy {name}! Recognising the backbone of every great workplace.',
    'Celebrating {name} — because people are the greatest asset.',
  ],
  cybersecurity: [
    'On {name}, let\'s strengthen our digital defences together.',
    'Celebrating {name} — stay safe, stay secure, stay aware.',
    'This {name}, take a moment to review your security practices.',
  ],
  sales: [
    'Big {name} savings are live! Don\'t miss today\'s best deals.',
    '{name} is here! Limited-time offers you won\'t want to skip.',
    'Happy {name}! Grab the deal before it\u2019s gone.',
  ],
  startup: [
    'Celebrating {name} — where bold ideas meet relentless execution.',
    'On {name}, we back the builders and dreamers of tomorrow.',
    'Happy {name}! Every giant company started with one founder.',
  ],
  sports: [
    'On {name}, we celebrate the spirit of sport and dedication.',
    'Happy {name}! Champions are made in practice, not on the day.',
    'Celebrating {name} — push your limits today.',
  ],
  entertainment: [
    'Celebrating {name}! What\u2019s your favourite way to enjoy the day?',
    'It\u2019s {name}! Perfect excuse for a fun post.',
    'On {name}, let\u2019s add a little joy to the feed.',
  ],
  shopping: [
    '{name} is here! Deals you can\u2019t afford to miss.',
    'Happy {name}! The best offers drop today — act fast.',
    'It\u2019s {name}! Time to shop the season\u2019s best picks.',
  ],
  religion: [
    'Wishing peace and blessings on {name}.',
    'May {name} bring light, faith, and togetherness to all.',
    'Celebrating {name} with reverence and joy.',
  ],
}

export function getAllEvents() {
  return ALL_EVENTS
}

// Returns the next occurrence (handles year wrap) of a recurring event
export function nextOccurrence(e, from = new Date()) {
  const thisYear = new Date(from.getFullYear(), e.m - 1, e.d)
  const nextYear = new Date(from.getFullYear() + 1, e.m - 1, e.d)
  const now = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const t = now.getTime()
  const a = thisYear.getTime(), b = nextYear.getTime()
  if (a >= t) return { date: thisYear, daysUntil: Math.round((a - t) / 864e5) }
  return { date: nextYear, daysUntil: Math.round((b - t) / 864e5) }
}

function decorate(e, daysUntil, settings) {
  const matchCountry = !settings.countries || settings.countries.length === 0 ||
    settings.countries.includes(e.c) || e.c === 'Global'
  const matchIndustry = !settings.industries || settings.industries.length === 0 ||
    settings.industries.includes(e.i)
  if (!matchCountry || !matchIndustry) return null
  const seed = e.n.length + e.m * 13 + e.d * 7
  return {
    ...e,
    month: e.m, day: e.d, name: e.n, type: e.t, country: e.c, region: e.r, industry: e.i,
    emoji: e.e, description: e.d || '',
    popularity: e.p ?? 50 + (seed % 40),
    trend: e.tr ?? 50 + (seed % 40),
    difficulty: e.df ?? 1 + (seed % 5),
    contentTypes: e.ct || ['Thought Leadership', 'Educational', 'Storytelling'],
    daysUntil, date: `${e.m}/${e.d}`,
  }
}

export function getUpcomingEvents(daysAhead = 14, userSettings = {}) {
  const results = []
  for (const e of ALL_EVENTS) {
    const { daysUntil } = nextOccurrence(e)
    if (daysUntil >= 0 && daysUntil <= daysAhead) {
      const dec = decorate(e, daysUntil, userSettings)
      if (dec) results.push(dec)
    }
  }
  results.sort((a, b) => a.daysUntil - b.daysUntil)
  return results
}

// Complete discovery windows: today / tomorrow / week / month / 90 days + recent
export function getEventWindows(daysAhead = 90, userSettings = {}) {
  const windows = { today: [], tomorrow: [], week: [], month: [], ninetyDays: [], recent: [] }
  const milestones = { 30: [], 14: [], 7: [], 3: [], 1: [], 0: [] }
  const todayKey = new Date().toDateString()
  for (const e of ALL_EVENTS) {
    const { date, daysUntil } = nextOccurrence(e)
    const dec = decorate(e, daysUntil, userSettings)
    if (!dec) continue
    const isToday = date.toDateString() === todayKey
    if (daysUntil === 0 || isToday) windows.today.push(dec)
    if (daysUntil === 1) windows.tomorrow.push(dec)
    if (daysUntil >= 0 && daysUntil <= 7) windows.week.push(dec)
    if (daysUntil >= 0 && daysUntil <= 30) windows.month.push(dec)
    if (daysUntil >= 0 && daysUntil <= daysAhead) windows.ninetyDays.push(dec)
    // Recently finished (past 30 days) — keeps the radar alive even between windows
    if (daysUntil === -1) windows.recent.push({ ...dec, daysAgo: 1 })
    if (daysUntil < 0 && daysUntil >= -30) windows.recent.push({ ...dec, daysAgo: Math.abs(daysUntil) })
    if (milestones[daysUntil]) milestones[daysUntil].push(dec)
  }
  for (const k of Object.keys(windows)) windows[k].sort((a, b) => a.daysUntil - b.daysUntil)
  for (const k of Object.keys(milestones)) milestones[k].sort((a, b) => a.popularity - b.popularity).reverse()
  return { windows, milestones }
}

export function getUpcomingFestivals(daysAhead = 7) {
  const now = new Date()
  const today = { month: now.getMonth() + 1, day: now.getDate() }
  const results = []

  for (const f of FESTIVALS) {
    // Simple date comparison (handles month wrap-around)
    const festDate = new Date(2026, f.month - 1, f.day)
    const diffDays = Math.round((festDate - now) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays <= daysAhead) {
      results.push({ ...f, daysUntil: diffDays, date: `${f.month}/${f.day}` })
    }
  }

  // Sort by closest first
  results.sort((a, b) => a.daysUntil - b.daysUntil)
  return results
}

export function getAllFestivals() {
  return FESTIVALS
}

export function getTemplate(event) {
  const templates = CAPTION_TEMPLATES[event.industry] || CAPTION_TEMPLATES[event.type] || CAPTION_TEMPLATES.observance
  const tpl = templates[Math.floor(Math.random() * templates.length)]
  return tpl.replace(/\{name\}/g, event.name)
}

const HASHTAG_SUGGESTIONS = {
  general: ['#TrendingNow', '#SocialForge'],
  festival: ['#FestivalVibes', '#Celebration', '#IndianFestivals', '#Tradition'],
  national: ['#India', '#ProudIndian', '#UnityInDiversity'],
  health: ['#HealthIsWealth', '#Wellness', '#MentalHealthMatters'],
  environment: ['#SaveThePlanet', '#EcoFriendly', '#SustainableLiving'],
  food: ['#Foodie', '#TasteOfIndia', '#FoodLovers'],
  tech: ['#TechInnovation', '#DigitalIndia', '#FutureIsNow', '#AI'],
  education: ['#EducationForAll', '#LearningNeverStops', '#KnowledgeIsPower'],
  lifestyle: ['#Lifestyle', '#LoveAndLife', '#Relationships'],
  marketing: ['#DigitalMarketing', '#ContentStrategy', '#BrandBuilding'],
  travel: ['#TravelIndia', '#Wanderlust', '#ExploreMore'],
  social: ['#Equality', '#HumanRights', '#Justice'],
  hr: ['#HumanResources', '#WorkCulture', '#EmployeeExperience'],
  cybersecurity: ['#CyberSecurity', '#DataPrivacy', '#StaySafe'],
  startup: ['#StartupIndia', '#Entrepreneurship', '#Founders'],
  shopping: ['#Deals', '#ShoppingSeason', '#SaleAlert'],
  religion: ['#Faith', '#Blessings', '#Devotion'],
  sports: ['#SportsIndia', '#Champions', '#GameOn'],
  entertainment: ['#Entertainment', '#FunTimes', '#LightsCameraAction'],
  observance: ['#Awareness', '#MakeADifference', '#TakeAction'],
}

export function getHashtags(industry) {
  return HASHTAG_SUGGESTIONS[industry] || HASHTAG_SUGGESTIONS.general
}

export function getEventByName(name) {
  return ALL_EVENTS.find(e => e.n.toLowerCase() === name.toLowerCase())
}
