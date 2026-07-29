// Indian festivals & observances — approximate dates (many are lunar, marked ≈).
// Month is 1-12, day is approximate (window ±2 days for lunar festivals).
// Used by observance auto-draft feature.

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

// Caption templates per festival type — used when no AI provider is active
const CAPTION_TEMPLATES = {
  festival: [
    'Wishing everyone a joyous {name}! May this {name} bring happiness, prosperity, and good fortune to all. 🎉',
    'Celebrating {name} today! How are you marking this special occasion? Share your traditions with us. 🙏',
    'Happy {name} to all who celebrate! May the festivities bring warmth and togetherness. ✨',
  ],
  national: [
    'Proud to celebrate {name}. Let\'s honor the spirit of our nation today. 🇮🇳',
    'On this {name}, let\'s remember the values that unite us. Jai Hind! 🇮🇳',
    'Celebrating {name} — a day to reflect on our heritage and look forward to a brighter future. ✨',
  ],
  observance: [
    'Marking {name} today. A great time to reflect and take action. 💡',
    'It\'s {name}! Here\'s how you can participate and make a difference. 🌟',
    'On this {name}, let\'s spread awareness and drive positive change. 🤝',
  ],
  lifestyle: [
    'Happy {name}! Tag someone special and spread the love. 💝',
    'Celebrating {name} today — who are you celebrating with? 🎉',
    'It\'s {name}! A perfect reminder to appreciate the people in our lives. ✨',
  ],
  health: [
    'On {name}, let\'s prioritize wellbeing and self-care. 🏥',
    'Raising awareness on {name}. Small steps lead to big changes. 💪',
    'This {name}, take a moment for your health — mental and physical. 🧠❤️',
  ],
  environment: [
    'On {name}, let\'s commit to protecting our planet. Every action counts. 🌍',
    'Celebrating {name} — what\'s one change you\'ll make for a greener future? 🌿',
    'This {name}, remember: we don\'t inherit the earth from our ancestors, we borrow it from our children. 🌎',
  ],
  fun: [
    'It\'s {name}! Time to have some fun and share a smile. 😊',
    'Happy {name}! Don\'t take life too seriously today. 🎉',
    'Celebrating {name} — join in the fun! 🥳',
  ],
  food: [
    'Celebrating {name}! What\'s your favorite way to enjoy this day? 🍽️',
    'It\'s {name}! Time to indulge and share the goodness. 🍫',
    'On {name}, we celebrate the flavors that bring us together. Bon appétit! 🥗',
  ],
  education: [
    'On {name}, we celebrate the power of knowledge and learning. 📚',
    'Happy {name}! Education is the most powerful weapon to change the world. 🍎',
    'Celebrating {name} — never stop learning, never stop growing. 🌱',
  ],
  culture: [
    'Celebrating {name} today! Let\'s honor our rich cultural heritage. 🎭',
    'On {name}, we celebrate the arts and the artists who inspire us. 🎨',
    'Happy {name}! Culture is the heartbeat of a society. 🎵',
  ],
  tech: [
    'Happy {name}! Celebrating the innovators and problem-solvers. ⚙️',
    'On {name}, we salute the minds that build our future. 🚀',
    'Celebrating {name} — technology is best when it brings people together. 💻',
  ],
  sports: [
    'On {name}, celebrating the spirit of sportsmanship and excellence. 🏅',
    'Happy {name}! Let\'s celebrate the athletes who inspire us every day. ⚽',
    'Sports teach us life lessons. On this {name}, get out and play! 🏃',
  ],
  travel: [
    'Happy {name}! Time to explore, discover, and wander. ✈️',
    'On {name}, we celebrate the joy of travel and discovery. 🌍',
    'Travel broadens the mind. This {name}, where will you go next? 🗺️',
  ],
  social: [
    'On {name}, let\'s stand together for equality, dignity, and justice. 🤲',
    'Raising awareness on {name}. Change begins with each of us. 💜',
    'This {name}, let\'s amplify voices that need to be heard. 🗣️',
  ],
  regional: [
    'Celebrating {name} today! Rich traditions, timeless values. 🛡️',
    'Happy {name}! Let\'s honor our regional heritage and pride. 🌺',
  ],
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

export function getTemplate(festival) {
  const templates = CAPTION_TEMPLATES[festival.industry] || CAPTION_TEMPLATES.observance
  const tpl = templates[Math.floor(Math.random() * templates.length)]
  return tpl.replace(/\{name\}/g, festival.name)
}

export function getAllFestivals() {
  return FESTIVALS
}

// Suggested hashtags per industry
const HASHTAG_SUGGESTIONS = {
  festival: ['#FestivalVibes', '#Celebration', '#IndianFestivals', '#Tradition'],
  national: ['#India', '#ProudIndian', '#IndianFlag', '#UnityInDiversity'],
  general: ['#DailyInspiration', '#TrendingNow', '#SocialForge'],
  health: ['#HealthIsWealth', '#Wellness', '#MentalHealthMatters'],
  environment: ['#SaveThePlanet', '#EcoFriendly', '#SustainableLiving'],
  food: ['#Foodie', '#TasteOfIndia', '#FoodLovers'],
  tech: ['#TechInnovation', '#DigitalIndia', '#FutureIsNow'],
  education: ['#EducationForAll', '#LearningNeverStops', '#KnowledgeIsPower'],
  lifestyle: ['#Lifestyle', '#LoveAndLife', '#Relationships'],
  culture: ['#ArtAndCulture', '#Heritage', '#IndianArt'],
  fun: ['#FunTimes', '#JoyfulMoments', '#Smile'],
  sports: ['#SportsIndia', '#FitIndia', '#AthleteLife'],
  travel: ['#TravelIndia', '#Wanderlust', '#ExploreMore'],
  social: ['#Equality', '#HumanRights', '#Justice'],
  regional: ['#RegionalPride', '#LocalHeritage'],
}

export function getHashtags(industry) {
  return HASHTAG_SUGGESTIONS[industry] || HASHTAG_SUGGESTIONS.general
}
