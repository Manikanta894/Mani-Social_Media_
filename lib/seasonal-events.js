const EVENTS = [
  // ===== January =====
  { month: 1, day: 1, name: "New Year's Day", type: 'global', country: 'Global', industry: 'general', emoji: '🎉', description: 'First day of the Gregorian calendar year.' },
  { month: 1, day: 14, name: 'Makar Sankranti', type: 'festival', country: 'India', industry: 'general', emoji: '🪁', description: 'Harvest festival marking the sun\'s transit into Capricorn.' },
  { month: 1, day: 14, name: 'Pongal', type: 'festival', country: 'India', industry: 'general', emoji: '🌾', description: 'Tamil harvest festival celebrated over four days.' },
  { month: 1, day: 15, name: 'Startup Day', type: 'industry', country: 'India', industry: 'tech', emoji: '🚀', description: 'Celebrating India\'s startup ecosystem and entrepreneurs.' },
  { month: 1, day: 26, name: 'Republic Day of India', type: 'national', country: 'India', industry: 'general', emoji: '🇮🇳', description: 'India became a sovereign republic in 1950.' },
  { month: 1, day: 28, name: 'Data Privacy Day', type: 'industry', country: 'Global', industry: 'tech', emoji: '🔒', description: 'International day to raise awareness about data privacy.' },

  // ===== February =====
  { month: 2, day: 14, name: "Valentine's Day", type: 'global', country: 'Global', industry: 'lifestyle', emoji: '💝', description: 'Celebration of love and romance worldwide.' },
  { month: 2, day: 26, name: 'Maha Shivaratri', type: 'festival', country: 'India', industry: 'general', emoji: '🕉️', description: 'Hindu festival honouring Lord Shiva.' },

  // ===== March =====
  { month: 3, day: 8, name: "International Women's Day", type: 'global', country: 'Global', industry: 'general', emoji: '👩', description: 'Global day celebrating women\'s achievements and advocating for equality.' },
  { month: 3, day: 15, name: 'Holi', type: 'festival', country: 'India', industry: 'general', emoji: '🎨', description: 'Festival of colours celebrating the arrival of spring.' },
  { month: 3, day: 25, name: 'Ugadi', type: 'festival', country: 'India', industry: 'general', emoji: '🌺', description: 'Telugu and Kannada New Year.' },
  { month: 3, day: 31, name: 'World Backup Day', type: 'industry', country: 'Global', industry: 'tech', emoji: '💾', description: 'Annual reminder to back up your important data.' },
  { month: 3, day: 31, name: 'Eid-ul-Fitr', type: 'festival', country: 'India', industry: 'general', emoji: '🌙', description: 'Islamic festival marking the end of Ramadan.' },

  // ===== April =====
  { month: 4, day: 7, name: 'World Health Day', type: 'global', country: 'Global', industry: 'health', emoji: '🏥', description: 'WHO-led global health awareness day.' },
  { month: 4, day: 14, name: 'Ambedkar Jayanti', type: 'festival', country: 'India', industry: 'general', emoji: '📚', description: 'Birth anniversary of Dr. B.R. Ambedkar.' },
  { month: 4, day: 21, name: 'World Creativity & Innovation Day', type: 'industry', country: 'Global', industry: 'marketing', emoji: '💡', description: 'Encouraging creative thinking and innovation.' },
  { month: 4, day: 22, name: 'Earth Day', type: 'global', country: 'Global', industry: 'environment', emoji: '🌍', description: 'Annual environmental protection awareness day.' },

  // ===== May =====
  { month: 5, day: 1, name: "Labour Day / International Workers' Day", type: 'global', country: 'Global', industry: 'general', emoji: '⚒️', description: 'Celebration of workers\' rights and labour movement.' },
  { month: 5, day: 20, name: 'International HR Day', type: 'industry', country: 'Global', industry: 'hr', emoji: '🤝', description: 'Recognizing the role of HR professionals worldwide.' },

  // ===== June =====
  { month: 6, day: 5, name: 'World Environment Day', type: 'global', country: 'Global', industry: 'environment', emoji: '🌿', description: 'UN-led global platform for environmental action.' },
  { month: 6, day: 16, name: "Father's Day", type: 'global', country: 'Global', industry: 'lifestyle', emoji: '👔', description: 'Honouring fathers and father figures.' },
  { month: 6, day: 21, name: 'International Day of Yoga', type: 'global', country: 'Global', industry: 'health', emoji: '🧘', description: 'UN-recognized day promoting yoga for health and wellbeing.' },
  { month: 6, day: 30, name: 'Social Media Day', type: 'industry', country: 'Global', industry: 'marketing', emoji: '📱', description: 'Celebrating the impact of social media on global communication.' },

  // ===== July =====
  { month: 7, day: 16, name: 'AI Appreciation Day', type: 'industry', country: 'Global', industry: 'tech', emoji: '🤖', description: 'Celebrating artificial intelligence and its impact on society.' },

  // ===== August =====
  { month: 8, day: 1, name: 'Friendship Day', type: 'global', country: 'Global', industry: 'lifestyle', emoji: '🤝', description: 'Celebrating the bond of friendship.' },
  { month: 8, day: 7, name: 'Raksha Bandhan', type: 'festival', country: 'India', industry: 'general', emoji: '🎀', description: 'Hindu festival celebrating the bond between siblings.' },
  { month: 8, day: 15, name: 'Independence Day of India', type: 'national', country: 'India', industry: 'general', emoji: '🇮🇳', description: 'India gained independence from British rule in 1947.' },
  { month: 8, day: 16, name: 'Janmashtami', type: 'festival', country: 'India', industry: 'general', emoji: '🦚', description: 'Celebrating the birth of Lord Krishna.' },
  { month: 8, day: 19, name: 'World Photography Day', type: 'industry', country: 'Global', industry: 'marketing', emoji: '📸', description: 'Celebrating the art and science of photography.' },
  { month: 8, day: 21, name: "World Entrepreneurs' Day", type: 'industry', country: 'Global', industry: 'tech', emoji: '💼', description: 'Honouring entrepreneurs and their contributions.' },
  { month: 8, day: 26, name: 'Ganesh Chaturthi', type: 'festival', country: 'India', industry: 'general', emoji: '🐘', description: 'Hindu festival honouring Lord Ganesha.' },

  // ===== September =====
  { month: 9, day: 5, name: "Teacher's Day", type: 'global', country: 'Global', industry: 'education', emoji: '🍎', description: 'Honouring teachers and educators worldwide.' },
  { month: 9, day: 8, name: 'International Literacy Day', type: 'industry', country: 'Global', industry: 'education', emoji: '📖', description: 'UNESCO-led day promoting literacy as a human right.' },
  { month: 9, day: 8, name: 'Onam', type: 'festival', country: 'India', industry: 'general', emoji: '🌺', description: 'Kerala harvest festival celebrating King Mahabali.' },
  { month: 9, day: 8, name: 'Digital Marketing Day', type: 'industry', country: 'Global', industry: 'marketing', emoji: '📊', description: 'Celebrating innovation in digital marketing.' },
  { month: 9, day: 27, name: 'World Tourism Day', type: 'global', country: 'Global', industry: 'travel', emoji: '✈️', description: 'UNWTO-led day promoting sustainable tourism.' },

  // ===== October =====
  { month: 10, day: 1, name: 'Cybersecurity Awareness Month', type: 'industry', country: 'Global', industry: 'cybersecurity', emoji: '🛡️', description: 'Month-long global effort to raise cybersecurity awareness.' },
  { month: 10, day: 1, name: 'Customer Service Week', type: 'industry', country: 'Global', industry: 'marketing', emoji: '🎧', description: 'Celebrating customer service excellence.' },
  { month: 10, day: 2, name: 'Gandhi Jayanti', type: 'national', country: 'India', industry: 'general', emoji: '🕊️', description: 'Birth anniversary of Mahatma Gandhi.' },
  { month: 10, day: 10, name: 'World Mental Health Day', type: 'global', country: 'Global', industry: 'health', emoji: '🧠', description: 'WHO-led day for global mental health education and advocacy.' },
  { month: 10, day: 14, name: 'Dussehra / Vijayadashami', type: 'festival', country: 'India', industry: 'general', emoji: '🏹', description: 'Hindu festival celebrating the victory of good over evil.' },
  { month: 10, day: 16, name: 'World Food Day', type: 'global', country: 'Global', industry: 'food', emoji: '🍽️', description: 'FAO-led day promoting global food security.' },

  // ===== November =====
  { month: 11, day: 1, name: 'World Vegan Day', type: 'global', country: 'Global', industry: 'food', emoji: '🥗', description: 'Celebrating the benefits of a vegan lifestyle.' },
  { month: 11, day: 7, name: 'Diwali / Deepavali', type: 'festival', country: 'India', industry: 'general', emoji: '🪔', description: 'Festival of lights — the most prominent Indian festival.' },
  { month: 11, day: 10, name: 'World Science Day', type: 'industry', country: 'Global', industry: 'education', emoji: '🔬', description: 'UNESCO-led day highlighting the role of science in society.' },
  { month: 11, day: 15, name: 'Guru Nanak Jayanti', type: 'festival', country: 'India', industry: 'general', emoji: '🙏', description: 'Birth anniversary of Guru Nanak, founder of Sikhism.' },
  { month: 11, day: 21, name: 'World Television Day', type: 'industry', country: 'Global', industry: 'general', emoji: '📺', description: 'UN-recognized day celebrating the impact of television.' },

  // ===== December =====
  { month: 12, day: 10, name: 'Human Rights Day', type: 'global', country: 'Global', industry: 'social', emoji: '🤲', description: 'UN-led day commemorating the Universal Declaration of Human Rights.' },
  { month: 12, day: 25, name: 'Christmas', type: 'global', country: 'Global', industry: 'general', emoji: '🎄', description: 'Annual Christian festival celebrating the birth of Jesus Christ.' },
  { month: 12, day: 31, name: "New Year's Eve", type: 'global', country: 'Global', industry: 'general', emoji: '🎆', description: 'The final day of the Gregorian calendar year.' },
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
}

export function getAllEvents() {
  return EVENTS
}

export function getUpcomingEvents(daysAhead = 14, userSettings = {}) {
  const now = new Date()
  const results = []

  for (const e of EVENTS) {
    const eventDate = new Date(now.getFullYear(), e.month - 1, e.day)
    const diffDays = Math.round((eventDate - now) / (1000 * 60 * 60 * 24))

    if (diffDays >= 0 && diffDays <= daysAhead) {
      const matchCountry = !userSettings.countries || userSettings.countries.length === 0 ||
        userSettings.countries.includes(e.country) || e.country === 'Global'
      const matchIndustry = !userSettings.industries || userSettings.industries.length === 0 ||
        userSettings.industries.includes(e.industry)

      if (matchCountry && matchIndustry) {
        results.push({ ...e, daysUntil: diffDays, date: `${e.month}/${e.day}` })
      }
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil)
  return results
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
}

export function getHashtags(industry) {
  return HASHTAG_SUGGESTIONS[industry] || HASHTAG_SUGGESTIONS.general
}

export function getEventByName(name) {
  return EVENTS.find(e => e.name.toLowerCase() === name.toLowerCase())
}
