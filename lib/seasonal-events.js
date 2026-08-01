import { EVENTS as DB_EVENTS, SEASON_EVENTS, EVENT_CATEGORIES } from './seasonal-db'

export const ALL_EVENTS = [...DB_EVENTS, ...SEASON_EVENTS]
export const CATEGORY_META = EVENT_CATEGORIES

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

// Complete discovery windows: today / tomorrow / week / month / 90 days
export function getEventWindows(daysAhead = 90, userSettings = {}) {
  const windows = { today: [], tomorrow: [], week: [], month: [], ninetyDays: [] }
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
    if (milestones[daysUntil]) milestones[daysUntil].push(dec)
  }
  for (const k of Object.keys(windows)) windows[k].sort((a, b) => a.daysUntil - b.daysUntil)
  for (const k of Object.keys(milestones)) milestones[k].sort((a, b) => a.popularity - b.popularity).reverse()
  return { windows, milestones }
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
