// ============================================================================
// SocialForge Global Event Database — historical, current & future events
// maintained by the Seasonal Event Discovery Engine.
// Fields: month, day, name, type, country, region, industry, emoji,
//         popularity(1-100), trend(1-100), difficulty(1-10),
//         contentTypes (recommended content styles), description
// ============================================================================

export const EVENT_CATEGORIES = {
  festival: 'Festivals', national: 'National', global: 'Global', industry: 'Industry',
  health: 'Healthcare', tech: 'Technology', business: 'Business', marketing: 'Marketing',
  hr: 'HR', finance: 'Finance', education: 'Education', sports: 'Sports',
  entertainment: 'Entertainment', shopping: 'Shopping', social: 'Social Media',
  religion: 'Religion', govt: 'Government', regional: 'Regional', startup: 'Startup',
  observance: 'Awareness',
}

export const EVENTS = [
  // ===================== JANUARY =====================
  { m: 1, d: 1, n: "New Year's Day", t: 'global', c: 'Global', r: 'Global', i: 'general', e: '🎉', p: 98, tr: 97, df: 1, ct: ['Inspirational', 'Announcement', 'Storytelling'], d: 'First day of the Gregorian year — resolutions, fresh starts, brand greetings.' },
  { m: 1, d: 14, n: 'Makar Sankranti', t: 'festival', c: 'India', r: 'North India', i: 'general', e: '🪁', p: 82, tr: 84, df: 2, ct: ['Festive', 'Community', 'Storytelling'], d: 'Harvest festival with kite flying across North India.' },
  { m: 1, d: 14, n: 'Pongal', t: 'festival', c: 'India', r: 'Tamil Nadu', i: 'general', e: '🌾', p: 84, tr: 83, df: 2, ct: ['Festive', 'Educational', 'Community'], d: 'Four-day Tamil harvest festival.' },
  { m: 1, d: 15, n: 'Army Day', t: 'national', c: 'India', r: 'National', i: 'general', e: '🪖', p: 76, tr: 74, df: 3, ct: ['Thought Leadership', 'Storytelling'], d: 'Honouring the Indian Army.' },
  { m: 1, d: 15, n: 'National Startup Day', t: 'startup', c: 'India', r: 'National', i: 'tech', e: '🚀', p: 88, tr: 92, df: 2, ct: ['Thought Leadership', 'Educational', 'Inspirational'], d: 'Celebrating India\u2019s startup ecosystem.' },
  { m: 1, d: 25, n: 'National Voters Day', t: 'govt', c: 'India', r: 'National', i: 'general', e: '🗳️', p: 62, tr: 60, df: 4, ct: ['Educational', 'Announcement'], d: 'Encouraging voter participation.' },
  { m: 1, d: 26, n: 'Republic Day of India', t: 'national', c: 'India', r: 'National', i: 'general', e: '🇮🇳', p: 95, tr: 94, df: 2, ct: ['Thought Leadership', 'Inspirational', 'Storytelling'], d: 'India adopted its constitution in 1950.' },
  { m: 1, d: 28, n: 'Data Privacy Day', t: 'tech', c: 'Global', r: 'Global', i: 'cybersecurity', e: '🔒', p: 71, tr: 78, df: 3, ct: ['Educational', 'Thought Leadership', 'Research Style'], d: 'Global awareness of data privacy.' },
  { m: 1, d: 30, n: 'World Neglected Tropical Diseases Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🦟', p: 48, tr: 52, df: 5, ct: ['Educational', 'Research Style'], d: 'WHO awareness day.' },

  // ===================== FEBRUARY =====================
  { m: 2, d: 2, n: 'World Wetlands Day', t: 'observance', c: 'Global', r: 'Global', i: 'environment', e: '🦆', p: 55, tr: 58, df: 5, ct: ['Educational'], d: 'UN wetlands conservation day.' },
  { m: 2, d: 4, n: 'World Cancer Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🎗️', p: 80, tr: 82, df: 3, ct: ['Educational', 'Inspirational', 'Storytelling'], d: 'Global cancer awareness day.' },
  { m: 2, d: 13, n: 'World Radio Day', t: 'observance', c: 'Global', r: 'Global', i: 'entertainment', e: '📻', p: 50, tr: 52, df: 5, ct: ['Educational', 'Announcement'], d: 'UNESCO radio day.' },
  { m: 2, d: 14, n: "Valentine's Day", t: 'global', c: 'Global', r: 'Global', i: 'lifestyle', e: '💝', p: 97, tr: 96, df: 1, ct: ['Marketing', 'Community', 'Storytelling'], d: 'Global celebration of love.' },
  { m: 2, d: 26, n: 'Maha Shivaratri', t: 'festival', c: 'India', r: 'National', i: 'religion', e: '🕉️', p: 78, tr: 80, df: 2, ct: ['Festive', 'Educational'], d: 'Night of Lord Shiva.' },
  { m: 2, d: 28, n: 'National Science Day', t: 'national', c: 'India', r: 'National', i: 'education', e: '🔬', p: 72, tr: 75, df: 3, ct: ['Educational', 'Research Style'], d: 'Raman Effect discovery anniversary.' },

  // ===================== MARCH =====================
  { m: 3, d: 1, n: 'Zero Discrimination Day', t: 'global', c: 'Global', r: 'Global', i: 'social', e: '🕊️', p: 60, tr: 62, df: 4, ct: ['Thought Leadership'], d: 'UNAIDS equality day.' },
  { m: 3, d: 3, n: 'World Wildlife Day', t: 'observance', c: 'Global', r: 'Global', i: 'environment', e: '🦁', p: 68, tr: 72, df: 3, ct: ['Educational', 'Storytelling'], d: 'UN wildlife conservation day.' },
  { m: 3, d: 8, n: "International Women's Day", t: 'global', c: 'Global', r: 'Global', i: 'social', e: '👩‍💼', p: 96, tr: 97, df: 2, ct: ['Thought Leadership', 'Inspirational', 'Storytelling'], d: 'Global celebration of women\u2019s achievements.' },
  { m: 3, d: 15, n: 'Holi', t: 'festival', c: 'India', r: 'North India', i: 'general', e: '🎨', p: 94, tr: 95, df: 2, ct: ['Festive', 'Community', 'Marketing'], d: 'Festival of colours.' },
  { m: 3, d: 20, n: 'International Day of Happiness', t: 'global', c: 'Global', r: 'Global', i: 'lifestyle', e: '😊', p: 74, tr: 76, df: 3, ct: ['Inspirational', 'Community'], d: 'UN happiness day.' },
  { m: 3, d: 22, n: 'World Water Day', t: 'observance', c: 'Global', r: 'Global', i: 'environment', e: '💧', p: 72, tr: 74, df: 3, ct: ['Educational', 'Research Style'], d: 'UN water conservation day.' },
  { m: 3, d: 25, n: 'Ugadi', t: 'festival', c: 'India', r: 'Andhra & Karnataka', i: 'general', e: '🌺', p: 80, tr: 81, df: 2, ct: ['Festive', 'Storytelling'], d: 'Telugu & Kannada New Year.' },
  { m: 3, d: 31, n: 'World Backup Day', t: 'tech', c: 'Global', r: 'Global', i: 'tech', e: '💾', p: 64, tr: 70, df: 3, ct: ['Educational', 'Marketing'], d: 'Reminder to back up data.' },
  { m: 3, d: 31, n: 'Eid-ul-Fitr', t: 'festival', c: 'India', r: 'National', i: 'religion', e: '🌙', p: 90, tr: 91, df: 2, ct: ['Festive', 'Community'], d: 'End of Ramadan.' },

  // ===================== APRIL =====================
  { m: 4, d: 2, n: 'World Autism Awareness Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🧩', p: 70, tr: 72, df: 3, ct: ['Educational', 'Thought Leadership'], d: 'UN autism awareness day.' },
  { m: 4, d: 7, n: 'World Health Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🏥', p: 82, tr: 84, df: 3, ct: ['Educational', 'Research Style'], d: 'WHO global health day.' },
  { m: 4, d: 13, n: 'Baisakhi', t: 'festival', c: 'India', r: 'Punjab', i: 'general', e: '🌾', p: 81, tr: 82, df: 2, ct: ['Festive', 'Community'], d: 'Punjabi harvest & Sikh new year.' },
  { m: 4, d: 14, n: 'Ambedkar Jayanti', t: 'festival', c: 'India', r: 'National', i: 'general', e: '📚', p: 78, tr: 79, df: 2, ct: ['Thought Leadership', 'Storytelling'], d: 'Birth anniversary of Dr. B.R. Ambedkar.' },
  { m: 4, d: 14, n: 'Bihu (Rongali)', t: 'festival', c: 'India', r: 'Assam', i: 'general', e: '🌾', p: 70, tr: 71, df: 3, ct: ['Festive', 'Community'], d: 'Assamese new year festival.' },
  { m: 4, d: 21, n: 'World Creativity & Innovation Day', t: 'industry', c: 'Global', r: 'Global', i: 'marketing', e: '💡', p: 76, tr: 82, df: 3, ct: ['Thought Leadership', 'Educational'], d: 'UN creativity day.' },
  { m: 4, d: 22, n: 'Earth Day', t: 'global', c: 'Global', r: 'Global', i: 'environment', e: '🌍', p: 90, tr: 92, df: 2, ct: ['Educational', 'Thought Leadership', 'Storytelling'], d: 'Environmental protection day.' },
  { m: 4, d: 29, n: 'International Dance Day', t: 'entertainment', c: 'Global', r: 'Global', i: 'entertainment', e: '💃', p: 60, tr: 62, df: 4, ct: ['Community', 'Entertainment'], d: 'UNESCO dance day.' },

  // ===================== MAY =====================
  { m: 5, d: 1, n: 'Labour Day', t: 'global', c: 'Global', r: 'Global', i: 'general', e: '⚒️', p: 84, tr: 85, df: 2, ct: ['Thought Leadership', 'Community'], d: 'International Workers\u2019 Day.' },
  { m: 5, d: 3, n: 'World Press Freedom Day', t: 'observance', c: 'Global', r: 'Global', i: 'social', e: '📰', p: 62, tr: 64, df: 4, ct: ['Thought Leadership'], d: 'UN press freedom day.' },
  { m: 5, d: 7, n: 'World Password Day', t: 'tech', c: 'Global', r: 'Global', i: 'cybersecurity', e: '🔑', p: 66, tr: 72, df: 3, ct: ['Educational', 'Marketing'], d: 'Cybersecurity awareness day.' },
  { m: 5, d: 11, n: 'National Technology Day', t: 'national', c: 'India', r: 'National', i: 'tech', e: '🖥️', p: 78, tr: 84, df: 2, ct: ['Thought Leadership', 'Educational'], d: 'India\u2019s tech achievements day.' },
  { m: 5, d: 20, n: 'International HR Day', t: 'hr', c: 'Global', r: 'Global', i: 'hr', e: '🤝', p: 74, tr: 78, df: 3, ct: ['Thought Leadership', 'Educational'], d: 'Celebrating HR professionals.' },
  { m: 5, d: 25, n: 'National Memorial Day (US)', t: 'national', c: 'USA', r: 'National', i: 'general', e: '🎖️', p: 70, tr: 68, df: 3, ct: ['Storytelling', 'Thought Leadership'], d: 'US remembrance day.' },

  // ===================== JUNE =====================
  { m: 6, d: 5, n: 'World Environment Day', t: 'global', c: 'Global', r: 'Global', i: 'environment', e: '🌿', p: 86, tr: 90, df: 2, ct: ['Educational', 'Thought Leadership'], d: 'UN environment day.' },
  { m: 6, d: 16, n: "Father's Day", t: 'global', c: 'Global', r: 'Global', i: 'lifestyle', e: '👔', p: 83, tr: 84, df: 2, ct: ['Marketing', 'Storytelling'], d: 'Honouring fathers.' },
  { m: 6, d: 21, n: 'International Day of Yoga', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🧘', p: 84, tr: 86, df: 2, ct: ['Educational', 'Inspirational'], d: 'UN yoga day.' },
  { m: 6, d: 21, n: 'World Music Day', t: 'entertainment', c: 'Global', r: 'Global', i: 'entertainment', e: '🎵', p: 72, tr: 74, df: 3, ct: ['Community', 'Entertainment'], d: 'Global music celebration.' },
  { m: 6, d: 30, n: 'Social Media Day', t: 'social', c: 'Global', r: 'Global', i: 'marketing', e: '📱', p: 80, tr: 88, df: 2, ct: ['Marketing', 'Community', 'Educational'], d: 'Celebrating social media.' },

  // ===================== JULY =====================
  { m: 7, d: 16, n: 'AI Appreciation Day', t: 'tech', c: 'Global', r: 'Global', i: 'tech', e: '🤖', p: 78, tr: 92, df: 2, ct: ['Thought Leadership', 'Educational', 'Research Style'], d: 'Celebrating AI\u2019s impact.' },
  { m: 7, d: 17, n: 'World Emoji Day', t: 'social', c: 'Global', r: 'Global', i: 'social', e: '😀', p: 72, tr: 78, df: 3, ct: ['Marketing', 'Community', 'Fun'], d: 'Celebrating emojis.' },
  { m: 7, d: 30, n: 'International Friendship Day', t: 'global', c: 'Global', r: 'Global', i: 'lifestyle', e: '🧑‍🤝‍🧑', p: 82, tr: 84, df: 2, ct: ['Community', 'Marketing'], d: 'Celebrating friendship.' },

  // ===================== AUGUST =====================
  { m: 8, d: 1, n: 'Friendship Day', t: 'global', c: 'Global', r: 'Global', i: 'lifestyle', e: '🤝', p: 85, tr: 86, df: 2, ct: ['Community', 'Marketing', 'Storytelling'], d: 'Celebrating the bond of friendship.' },
  { m: 8, d: 7, n: 'Raksha Bandhan', t: 'festival', c: 'India', r: 'National', i: 'general', e: '🎀', p: 86, tr: 87, df: 2, ct: ['Festive', 'Community'], d: 'Sibling bond festival.' },
  { m: 8, d: 12, n: 'International Youth Day', t: 'global', c: 'Global', r: 'Global', i: 'social', e: '🧑‍🎓', p: 70, tr: 72, df: 3, ct: ['Thought Leadership', 'Inspirational'], d: 'UN youth day.' },
  { m: 8, d: 15, n: 'Independence Day of India', t: 'national', c: 'India', r: 'National', i: 'general', e: '🇮🇳', p: 97, tr: 96, df: 1, ct: ['Thought Leadership', 'Inspirational', 'Storytelling'], d: 'India\u2019s independence in 1947.' },
  { m: 8, d: 16, n: 'Janmashtami', t: 'festival', c: 'India', r: 'National', i: 'religion', e: '🦚', p: 80, tr: 81, df: 2, ct: ['Festive', 'Educational'], d: 'Birth of Lord Krishna.' },
  { m: 8, d: 19, n: 'World Photography Day', t: 'industry', c: 'Global', r: 'Global', i: 'marketing', e: '📸', p: 74, tr: 78, df: 3, ct: ['Community', 'Marketing'], d: 'Celebrating photography.' },
  { m: 8, d: 21, n: "World Entrepreneurs' Day", t: 'startup', c: 'Global', r: 'Global', i: 'tech', e: '💼', p: 76, tr: 82, df: 3, ct: ['Thought Leadership', 'Inspirational'], d: 'Honouring entrepreneurs.' },
  { m: 8, d: 23, n: 'International Hashtag Day', t: 'social', c: 'Global', r: 'Global', i: 'marketing', e: '#️⃣', p: 68, tr: 80, df: 2, ct: ['Marketing', 'Educational'], d: 'Celebrating the hashtag.' },
  { m: 8, d: 26, n: 'Ganesh Chaturthi', t: 'festival', c: 'India', r: 'Maharashtra', i: 'religion', e: '🐘', p: 88, tr: 89, df: 2, ct: ['Festive', 'Community'], d: 'Birth of Lord Ganesha.' },
  { m: 8, d: 29, n: 'National Sports Day', t: 'national', c: 'India', r: 'National', i: 'sports', e: '🏅', p: 76, tr: 78, df: 3, ct: ['Inspirational', 'Storytelling'], d: 'Honouring Dhyan Chand.' },

  // ===================== SEPTEMBER =====================
  { m: 9, d: 5, n: "Teachers' Day (India)", t: 'national', c: 'India', r: 'National', i: 'education', e: '🍎', p: 88, tr: 89, df: 2, ct: ['Inspirational', 'Storytelling'], d: 'Honouring Dr. Radhakrishnan.' },
  { m: 9, d: 8, n: 'International Literacy Day', t: 'education', c: 'Global', r: 'Global', i: 'education', e: '📖', p: 70, tr: 72, df: 3, ct: ['Educational', 'Research Style'], d: 'UNESCO literacy day.' },
  { m: 9, d: 8, n: 'Onam', t: 'festival', c: 'India', r: 'Kerala', i: 'general', e: '🌺', p: 82, tr: 83, df: 2, ct: ['Festive', 'Storytelling'], d: 'Kerala harvest festival.' },
  { m: 9, d: 8, n: 'Digital Marketing Day', t: 'marketing', c: 'Global', r: 'Global', i: 'marketing', e: '📊', p: 76, tr: 84, df: 2, ct: ['Marketing', 'Educational'], d: 'Digital marketing celebration.' },
  { m: 9, d: 13, n: 'International Programmers Day', t: 'tech', c: 'Global', r: 'Global', i: 'tech', e: '👨‍💻', p: 78, tr: 86, df: 2, ct: ['Community', 'Educational'], d: 'Celebrating developers.' },
  { m: 9, d: 14, n: 'Hindi Diwas', t: 'national', c: 'India', r: 'National', i: 'general', e: '🔤', p: 66, tr: 66, df: 4, ct: ['Educational', 'Community'], d: 'Celebrating Hindi language.' },
  { m: 9, d: 15, n: "Engineers' Day (India)", t: 'national', c: 'India', r: 'National', i: 'tech', e: '🛠️', p: 80, tr: 84, df: 2, ct: ['Inspirational', 'Educational'], d: 'Honouring M. Visvesvaraya.' },
  { m: 9, d: 27, n: 'World Tourism Day', t: 'global', c: 'Global', r: 'Global', i: 'travel', e: '✈️', p: 76, tr: 78, df: 3, ct: ['Marketing', 'Storytelling'], d: 'UNWTO tourism day.' },
  { m: 9, d: 29, n: 'World Heart Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '❤️', p: 74, tr: 76, df: 3, ct: ['Educational', 'Research Style'], d: 'Heart health awareness.' },
  { m: 9, d: 30, n: 'International Podcast Day', t: 'entertainment', c: 'Global', r: 'Global', i: 'entertainment', e: '🎙️', p: 66, tr: 72, df: 3, ct: ['Community', 'Announcement'], d: 'Celebrating podcasts.' },

  // ===================== OCTOBER =====================
  { m: 10, d: 1, n: 'Cybersecurity Awareness Month', t: 'tech', c: 'Global', r: 'Global', i: 'cybersecurity', e: '🛡️', p: 78, tr: 84, df: 2, ct: ['Educational', 'Thought Leadership'], d: 'Month-long security awareness.' },
  { m: 10, d: 1, n: 'International Coffee Day', t: 'lifestyle', c: 'Global', r: 'Global', i: 'lifestyle', e: '☕', p: 72, tr: 74, df: 3, ct: ['Community', 'Marketing'], d: 'Celebrating coffee.' },
  { m: 10, d: 2, n: 'Gandhi Jayanti', t: 'national', c: 'India', r: 'National', i: 'general', e: '🕊️', p: 86, tr: 87, df: 2, ct: ['Thought Leadership', 'Storytelling'], d: 'Birth anniversary of Mahatma Gandhi.' },
  { m: 10, d: 5, n: "World Teachers' Day", t: 'education', c: 'Global', r: 'Global', i: 'education', e: '👩‍🏫', p: 80, tr: 82, df: 2, ct: ['Inspirational', 'Storytelling'], d: 'UNESCO teachers day.' },
  { m: 10, d: 8, n: 'Indian Air Force Day', t: 'national', c: 'India', r: 'National', i: 'general', e: '🛩️', p: 68, tr: 70, df: 4, ct: ['Storytelling', 'Thought Leadership'], d: 'IAF foundation day.' },
  { m: 10, d: 10, n: 'World Mental Health Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🧠', p: 88, tr: 92, df: 2, ct: ['Educational', 'Thought Leadership', 'Storytelling'], d: 'WHO mental health day.' },
  { m: 10, d: 14, n: 'Dussehra / Vijayadashami', t: 'festival', c: 'India', r: 'National', i: 'religion', e: '🏹', p: 89, tr: 90, df: 2, ct: ['Festive', 'Storytelling'], d: 'Victory of good over evil.' },
  { m: 10, d: 16, n: 'World Food Day', t: 'global', c: 'Global', r: 'Global', i: 'food', e: '🍽️', p: 78, tr: 80, df: 3, ct: ['Educational', 'Community'], d: 'FAO food security day.' },
  { m: 10, d: 16, n: 'World AI Day', t: 'tech', c: 'Global', r: 'Global', i: 'tech', e: '🧠', p: 80, tr: 94, df: 2, ct: ['Thought Leadership', 'Educational', 'Research Style'], d: 'Celebrating artificial intelligence.' },
  { m: 10, d: 24, n: 'United Nations Day', t: 'observance', c: 'Global', r: 'Global', i: 'social', e: '🌐', p: 64, tr: 66, df: 4, ct: ['Thought Leadership'], d: 'UN founding anniversary.' },
  { m: 10, d: 29, n: 'World Internet Day', t: 'tech', c: 'Global', r: 'Global', i: 'tech', e: '🌍', p: 70, tr: 76, df: 3, ct: ['Educational', 'Thought Leadership'], d: 'Celebrating the internet.' },

  // ===================== NOVEMBER =====================
  { m: 11, d: 1, n: 'World Vegan Day', t: 'global', c: 'Global', r: 'Global', i: 'food', e: '🥗', p: 68, tr: 72, df: 3, ct: ['Educational', 'Community'], d: 'Celebrating vegan lifestyle.' },
  { m: 11, d: 7, n: 'Diwali / Deepavali', t: 'festival', c: 'India', r: 'National', i: 'general', e: '🪔', p: 98, tr: 97, df: 1, ct: ['Festive', 'Marketing', 'Storytelling'], d: 'Festival of lights — India\u2019s biggest festival.' },
  { m: 11, d: 10, n: 'World Science Day', t: 'education', c: 'Global', r: 'Global', i: 'education', e: '🔬', p: 68, tr: 70, df: 4, ct: ['Educational', 'Research Style'], d: 'UNESCO science day.' },
  { m: 11, d: 13, n: 'World Kindness Day', t: 'global', c: 'Global', r: 'Global', i: 'social', e: '💗', p: 72, tr: 74, df: 3, ct: ['Inspirational', 'Community'], d: 'Spreading kindness.' },
  { m: 11, d: 14, n: 'World Diabetes Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🩸', p: 74, tr: 76, df: 3, ct: ['Educational'], d: 'Diabetes awareness day.' },
  { m: 11, d: 14, n: "Children's Day (India)", t: 'national', c: 'India', r: 'National', i: 'education', e: '🧒', p: 82, tr: 83, df: 2, ct: ['Community', 'Storytelling'], d: 'Birthday of Nehru.' },
  { m: 11, d: 15, n: 'Guru Nanak Jayanti', t: 'festival', c: 'India', r: 'National', i: 'religion', e: '🙏', p: 78, tr: 79, df: 2, ct: ['Festive', 'Storytelling'], d: 'Birth of Guru Nanak.' },
  { m: 11, d: 21, n: 'World Television Day', t: 'entertainment', c: 'Global', r: 'Global', i: 'entertainment', e: '📺', p: 58, tr: 60, df: 5, ct: ['Announcement'], d: 'UN television day.' },
  { m: 11, d: 24, n: 'Black Friday', t: 'shopping', c: 'Global', r: 'Global', i: 'marketing', e: '🛍️', p: 95, tr: 96, df: 1, ct: ['Sales', 'Marketing', 'Announcement'], d: 'Biggest shopping day of the year.' },
  { m: 11, d: 26, n: 'Constitution Day (India)', t: 'national', c: 'India', r: 'National', i: 'general', e: '📜', p: 74, tr: 76, df: 3, ct: ['Thought Leadership', 'Educational'], d: 'Adoption of Indian constitution.' },
  { m: 11, d: 27, n: 'Cyber Monday', t: 'shopping', c: 'Global', r: 'Global', i: 'marketing', e: '💻', p: 92, tr: 94, df: 1, ct: ['Sales', 'Marketing'], d: 'Online shopping mega-day.' },

  // ===================== DECEMBER =====================
  { m: 12, d: 1, n: 'World AIDS Day', t: 'health', c: 'Global', r: 'Global', i: 'health', e: '🔴', p: 76, tr: 78, df: 3, ct: ['Educational', 'Thought Leadership'], d: 'HIV/AIDS awareness day.' },
  { m: 12, d: 3, n: 'International Day of Persons with Disabilities', t: 'observance', c: 'Global', r: 'Global', i: 'social', e: '♿', p: 64, tr: 66, df: 4, ct: ['Thought Leadership', 'Educational'], d: 'UN disability day.' },
  { m: 12, d: 4, n: 'Indian Navy Day', t: 'national', c: 'India', r: 'National', i: 'general', e: '⚓', p: 62, tr: 64, df: 4, ct: ['Storytelling', 'Thought Leadership'], d: 'Honouring the Indian Navy.' },
  { m: 12, d: 10, n: 'Human Rights Day', t: 'global', c: 'Global', r: 'Global', i: 'social', e: '🤲', p: 72, tr: 74, df: 3, ct: ['Thought Leadership'], d: 'Universal Declaration anniversary.' },
  { m: 12, d: 14, n: 'National Energy Conservation Day', t: 'observance', c: 'India', r: 'National', i: 'environment', e: '💡', p: 60, tr: 62, df: 4, ct: ['Educational'], d: 'Energy saving awareness.' },
  { m: 12, d: 25, n: 'Christmas', t: 'global', c: 'Global', r: 'Global', i: 'general', e: '🎄', p: 97, tr: 96, df: 1, ct: ['Festive', 'Marketing', 'Storytelling'], d: 'Celebration of Christmas.' },
  { m: 12, d: 31, n: "New Year's Eve", t: 'global', c: 'Global', r: 'Global', i: 'general', e: '🎆', p: 96, tr: 95, df: 1, ct: ['Inspirational', 'Announcement', 'Marketing'], d: 'Final day of the year.' },
]

// Fixed-date observances for shopping/tech seasons
export const SEASON_EVENTS = [
  { m: 10, d: 5, n: 'Great Indian Festival (Amazon)', t: 'shopping', c: 'India', r: 'National', i: 'marketing', e: '🛒', p: 88, tr: 92, df: 2, ct: ['Sales', 'Marketing'], d: 'Amazon\u2019s biggest Indian sale season.' },
  { m: 10, d: 5, n: 'Big Billion Days (Flipkart)', t: 'shopping', c: 'India', r: 'National', i: 'marketing', e: '💰', p: 86, tr: 91, df: 2, ct: ['Sales', 'Marketing'], d: 'Flipkart\u2019s mega sale.' },
  { m: 1, d: 10, n: 'New Year Shopping Season', t: 'shopping', c: 'Global', r: 'Global', i: 'marketing', e: '🛍️', p: 80, tr: 82, df: 2, ct: ['Sales', 'Marketing'], d: 'January clearance & new-year sales.' },
  { m: 7, d: 10, n: 'End of Season Sale', t: 'shopping', c: 'India', r: 'National', i: 'marketing', e: '🏷️', p: 74, tr: 78, df: 3, ct: ['Sales', 'Marketing'], d: 'Mid-year fashion sale season.' },
]
