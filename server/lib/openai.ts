// Reference: blueprint:javascript_openai_ai_integrations
import OpenAI from "openai";
import fs from "fs";
import path from "path";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
export const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

/**
 * Персонализирует тональность текста в зависимости от пола пользователя
 */
export function personalizeTone(gender: string): string {
  switch (gender) {
    case "female":
      return "Пиши мягко, с теплотой и участием. Делай акцент на понимании, поддержке и внутренней гармонии. Избегай холодных оценок и сухих выводов. Создавай ощущение, что читателя действительно понимают.";
    case "male":
      return "Пиши конкретно и по делу, с уважительным и уверенным тоном. Сохраняй человеческое тепло, но без излишней эмоциональности. Помогай видеть суть и действовать, избегай пустых слов.";
    default:
      return "Пиши нейтрально, с балансом между теплом и конкретикой, избегай предположений о поле.";
  }
}

/**
 * Загружает и обрабатывает markdown промпт с заменой плейсхолдеров
 */
function loadPrompt(promptName: string, replacements: Record<string, string> = {}): string {
  const promptPath = path.join(process.cwd(), 'server', 'lib', 'prompts', `${promptName}.md`);
  let content = fs.readFileSync(promptPath, 'utf-8');
  
  // Заменяем плейсхолдеры
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return content;
}

export async function getAstrologyInterpretation(
  type: 'natal' | 'solar' | 'horoscope' | 'compatibility' | 'ask',
  data: any,
  locale: string = 'en',
  gender: string = 'other'
): Promise<string> {
  const languageInstruction = locale === 'ru' 
    ? 'ВАЖНО: Ответь полностью на русском языке.' 
    : 'Respond in English.';
  
  const toneInstruction = personalizeTone(gender);
  
  // Подготовка замен для каждого типа промпта
  const replacements: Record<string, Record<string, string>> = {
    natal: {
      planets: JSON.stringify(data.planets, null, 2),
      aspects: JSON.stringify(data.aspects, null, 2)
    },
    solar: {
      data: JSON.stringify(data, null, 2)
    },
    horoscope: {
      period: data.period,
      chart: JSON.stringify(data.chart, null, 2),
      period_text: data.period === 'day' ? 'day' : data.period === 'week' ? 'week' : 'month'
    },
    compatibility: {
      host_name: data.host_name || 'Person 1',
      partner_name: data.partner_name || 'Person 2',
      person1: JSON.stringify(data.person1, null, 2),
      person2: JSON.stringify(data.person2, null, 2)
    },
    ask: {
      chart: JSON.stringify(data.chart, null, 2),
      question: data.question
    }
  };

  const promptText = loadPrompt(type, replacements[type]);
  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}`;

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог, который предоставляет четкие, практичные и проницательные чтения без эзотерического жаргона. Твои советы конкретны, действенны и основаны на астрологических принципах. Всегда отвечай на русском языке."
    : "You are an expert astrologer who provides clear, practical, and insightful readings without esoteric jargon. Your advice is specific, actionable, and based on astrological principles.";

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    max_completion_tokens: 8192
  });

  const content = completion.choices[0]?.message?.content || "";
  
  // Для совместимости проверяем наличие имён в ответе
  if (type === 'compatibility' && content) {
    const hostName = data.host_name || '';
    const partnerName = data.partner_name || '';
    
    if (hostName && partnerName) {
      const hasHostName = content.toLowerCase().includes(hostName.toLowerCase());
      const hasPartnerName = content.toLowerCase().includes(partnerName.toLowerCase());
      
      if (!hasHostName || !hasPartnerName) {
        const missing = [];
        if (!hasHostName) missing.push(hostName);
        if (!hasPartnerName) missing.push(partnerName);
        console.error(`[Compatibility Personalization Failure] Missing names: ${missing.join(', ')}`, {
          host_name: hostName,
          partner_name: partnerName,
          has_host: hasHostName,
          has_partner: hasPartnerName,
          response_preview: content.substring(0, 200),
          locale,
          gender
        });
      } else {
        console.log(`[Compatibility Personalization Success] Both names present: ${hostName}, ${partnerName}`);
      }
    }
  }

  return content || "Unable to generate interpretation at this time.";
}

export interface PlanetInterpretationData {
  planet: {
    name: string;
    sign: string;
    house: number;
    aspects?: Array<{
      to: string;
      type: string;
      orb_deg: number;
    }>;
  };
  profile: {
    name: string;
    age?: number;
    gender?: string;
  };
}

export interface PlanetInterpretationResult {
  title: string;
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
  house_note: string;
}

export async function getPlanetInterpretation(
  data: PlanetInterpretationData,
  locale: string = 'ru'
): Promise<PlanetInterpretationResult> {
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(data.profile.gender || 'other');

  const aspectsText = data.planet.aspects && data.planet.aspects.length > 0 
    ? `Аспекты: ${JSON.stringify(data.planet.aspects)}`
    : '';
  
  const profileAge = data.profile.age ? `, ${data.profile.age} лет` : '';
  const profileGender = data.profile.gender ? `, ${data.profile.gender}` : '';

  const promptText = loadPrompt('planet', {
    planet_name: data.planet.name,
    planet_sign: data.planet.sign,
    planet_house: String(data.planet.house),
    planet_aspects: aspectsText,
    profile_name: data.profile.name,
    profile_age: profileAge,
    profile_gender: profileGender
  });

  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}`;

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик. Объясняешь положения планет конкретно и без воды. Возвращаешь только валидный JSON."
    : "You are a practical astrologer. You explain planetary positions concretely without fluff. Return only valid JSON.";

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate planet interpretation');
  }

  try {
    const result = JSON.parse(content);
    return {
      title: result.title || `${data.planet.name} в ${data.planet.sign}`,
      summary: result.summary || '',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      risks: Array.isArray(result.risks) ? result.risks : [],
      advice: Array.isArray(result.advice) ? result.advice : [],
      house_note: result.house_note || ''
    };
  } catch (e) {
    throw new Error('Failed to parse planet interpretation response');
  }
}

export interface ImportantDateInterpretationInput {
  profile: {
    name: string;
    age: number;
    gender: string;
    timezone: string;
  };
  event: {
    kind: string;
    planet: string;
    date: string;
    sign?: string;
    natalTarget?: {
      planet: string;
      aspect?: string;
    };
    brief: string;
  };
  natalSummary: any;
}

export interface ImportantDateInterpretationResult {
  title: string;
  window: string;
  whatItMeans: string[];
  risks: string[];
  do: string[];
  dont: string[];
  timingTips: string[];
}

export async function interpretImportantDate(
  input: ImportantDateInterpretationInput,
  locale: string = 'ru'
): Promise<ImportantDateInterpretationResult> {
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(input.profile.gender);

  const promptText = loadPrompt('important_dates', {
    EVENT_DATA: JSON.stringify(input.event, null, 2),
    NAME: input.profile.name,
    AGE: String(input.profile.age),
    GENDER: input.profile.gender,
    TIMEZONE: input.profile.timezone,
    NATAL_SUMMARY: JSON.stringify(input.natalSummary, null, 2),
    TONE_INSTRUCTION: toneInstruction,
    LOCALE: locale
  });

  const finalPrompt = `${languageInstruction}\n\n${promptText}`;

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик. Даёшь конкретные, полезные советы по важным датам. Возвращаешь только валидный JSON."
    : "You are a practical astrologer. You provide concrete, useful advice for important dates. Return only valid JSON.";

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 3000
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate important date interpretation');
  }

  try {
    const result = JSON.parse(content);
    return {
      title: result.title || `Важное событие: ${input.event.brief}`,
      window: result.window || 'Период влияния: 3-7 дней вокруг даты',
      whatItMeans: Array.isArray(result.whatItMeans) ? result.whatItMeans : [],
      risks: Array.isArray(result.risks) ? result.risks : [],
      do: Array.isArray(result.do) ? result.do : [],
      dont: Array.isArray(result.dont) ? result.dont : [],
      timingTips: Array.isArray(result.timingTips) ? result.timingTips : []
    };
  } catch (e) {
    throw new Error('Failed to parse important date interpretation response');
  }
}

export async function getProfessionalCompatibilityInterpretation(
  compatibilityData: {
    person1: { planets: any; houses: any; angles: any };
    person2: { planets: any; houses: any; angles: any };
    houseOverlays: any;
    host_name?: string;
    partner_name?: string;
  },
  locale: string = 'ru'
): Promise<any> {
  const hostName = compatibilityData.host_name || (locale === 'ru' ? 'Персона 1' : 'Person 1');
  const partnerName = compatibilityData.partner_name || (locale === 'ru' ? 'Персона 2' : 'Person 2');

  const systemMessage = locale === 'ru'
    ? "Ты профессиональный астролог уровня ISAR/NCGR. Анализируешь синастрию с учетом оверлеев домов, межпланетных аспектов и весов факторов. Возвращаешь только валидный JSON."
    : "You are a professional ISAR/NCGR level astrologer. You analyze synastry considering house overlays, interplanetary aspects, and factor weights. Return only valid JSON.";

  const promptText = locale === 'ru' ? `
ПРОФЕССИОНАЛЬНЫЙ АНАЛИЗ СИНАСТРИИ

ПЕРСОНАЛИЗАЦИЯ:
- Имя первого человека: ${hostName}
- Имя партнёра: ${partnerName}
- ОБЯЗАТЕЛЬНО используй эти имена в анализе (минимум 1 имя на раздел)
- Пиши уважительно, в 3-м лице («${hostName} ощущает...» / «${partnerName} склонен...»)

Данные ${hostName}:
${JSON.stringify(compatibilityData.person1, null, 2)}

Данные ${partnerName}:
${JSON.stringify(compatibilityData.person2, null, 2)}

Оверлеи домов (планеты ${partnerName} в домах ${hostName}):
${JSON.stringify(compatibilityData.houseOverlays, null, 2)}

Проанализируй синастрию с учетом:
1. Оверлеи домов - какие планеты ${partnerName} попадают в какие дома ${hostName}
2. Межпланетные аспекты между картами (соединения, трины, квадраты, оппозиции)
3. Веса факторов (угловые дома важнее, Солнце/Луна/ASC/MC имеют больший вес)
4. Управители знаков и их взаимодействие

Верни структурированный JSON с именами ${hostName} и ${partnerName} в текстах:
{
  "summary": "Краткое резюме (используй имена ${hostName} и ${partnerName})",
  "key_connections": ["Ключевое взаимодействие с именами", "..."],
  "house_overlays_analysis": "Анализ оверлеев (упоминай ${hostName} и ${partnerName})",
  "strengths": ["Сила пары (с именами)", "..."],
  "challenges": ["Вызов (с именами)", "..."],
  "recommendations": ["Рекомендация для ${hostName} и ${partnerName}", "..."]
}
` : `
PROFESSIONAL SYNASTRY ANALYSIS

PERSONALIZATION:
- First person's name: ${hostName}
- Partner's name: ${partnerName}
- MANDATORY: Use these names throughout the analysis (minimum 1 name per section)
- Write respectfully in 3rd person ("${hostName} feels..." / "${partnerName} tends to...")

${hostName}'s Data:
${JSON.stringify(compatibilityData.person1, null, 2)}

${partnerName}'s Data:
${JSON.stringify(compatibilityData.person2, null, 2)}

House Overlays (${partnerName}'s planets in ${hostName}'s houses):
${JSON.stringify(compatibilityData.houseOverlays, null, 2)}

Analyze the synastry considering:
1. House overlays - which of ${partnerName}'s planets fall in ${hostName}'s houses
2. Interplanetary aspects between charts (conjunctions, trines, squares, oppositions)
3. Factor weights (angular houses more important, Sun/Moon/ASC/MC have greater weight)
4. Sign rulers and their interactions

Return structured JSON with ${hostName} and ${partnerName} names in texts:
{
  "summary": "Brief summary (use ${hostName} and ${partnerName} names)",
  "key_connections": ["Key connection with names", "..."],
  "house_overlays_analysis": "Overlays analysis (mention ${hostName} and ${partnerName})",
  "strengths": ["Strength (with names)", "..."],
  "challenges": ["Challenge (with names)", "..."],
  "recommendations": ["Recommendation for ${hostName} and ${partnerName}", "..."]
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: promptText
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2500
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate professional compatibility interpretation');
  }

  const result = JSON.parse(content);
  
  // Валидация наличия имён в ответе
  if (hostName && partnerName) {
    const summaryText = result.summary || '';
    const hasHostName = summaryText.toLowerCase().includes(hostName.toLowerCase());
    const hasPartnerName = summaryText.toLowerCase().includes(partnerName.toLowerCase());
    
    if (!hasHostName || !hasPartnerName) {
      const missing = [];
      if (!hasHostName) missing.push(hostName);
      if (!hasPartnerName) missing.push(partnerName);
      console.error(`[Professional Compatibility Personalization Failure] Missing names in summary: ${missing.join(', ')}`, {
        host_name: hostName,
        partner_name: partnerName,
        has_host: hasHostName,
        has_partner: hasPartnerName,
        summary_preview: summaryText.substring(0, 200),
        locale
      });
    } else {
      console.log(`[Professional Compatibility Personalization Success] Both names present in summary: ${hostName}, ${partnerName}`);
    }
  }

  return result;
}

export interface HoroscopeInterpretationInput {
  profile: { name: string; gender: string; timezone: string };
  natal: any;
  transits?: any[];
}

export interface HoroscopeInterpretationResult {
  morning?: {
    money: string;
    work: string;
    study: string;
    love: string;
    health: string;
  };
  day?: {
    money: string;
    work: string;
    study: string;
    love: string;
    health: string;
  };
  evening?: {
    money: string;
    work: string;
    study: string;
    love: string;
    health: string;
    self_care?: string;
  };
}

export async function interpretHoroscope(
  input: HoroscopeInterpretationInput,
  locale: string = 'ru'
): Promise<HoroscopeInterpretationResult> {
  console.log('[INTERPRET_HOROSCOPE] Starting daily horoscope generation, locale:', locale);
  
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(input.profile.gender);

  const today = new Date().toISOString().split('T')[0];

  const promptData = `
Период: day
Дата: ${today}
Имя: ${input.profile.name}
Пол: ${input.profile.gender}
Часовой пояс: ${input.profile.timezone}

Натальная карта:
${JSON.stringify(input.natal, null, 2)}

${input.transits && input.transits.length > 0 ? `Транзиты: ${JSON.stringify(input.transits, null, 2)}` : ''}
  `.trim();

  const promptText = loadPrompt('horoscope', {});
  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}\n\n${promptData}`;

  console.log('[INTERPRET_HOROSCOPE] Prompt length:', finalPrompt.length);

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик. Даёшь структурированные гороскопы с практичными советами. Возвращаешь только валидный JSON."
    : "You are a practical astrologer. You provide structured horoscopes with practical advice. Return only valid JSON.";

  console.log('[INTERPRET_HOROSCOPE] Calling OpenAI...');
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: finalPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000
    });

    console.log('[INTERPRET_HOROSCOPE] OpenAI response received');
    
    const content = completion.choices[0]?.message?.content;
    console.log('[INTERPRET_HOROSCOPE] Content length:', content?.length || 0);
    
    if (!content) {
      console.error('[INTERPRET_HOROSCOPE] No content in response');
      throw new Error('Failed to generate horoscope interpretation');
    }

    try {
      const result = JSON.parse(content);
      console.log('[INTERPRET_HOROSCOPE] Successfully parsed JSON');
      return result;
    } catch (e) {
      console.error('[INTERPRET_HOROSCOPE] Failed to parse JSON:', e);
      console.error('[INTERPRET_HOROSCOPE] Content was:', content.substring(0, 500));
      throw new Error('Failed to parse horoscope interpretation response');
    }
  } catch (error: any) {
    console.error('[INTERPRET_HOROSCOPE] OpenAI error:', error.message);
    console.error('[INTERPRET_HOROSCOPE] Error details:', error);
    throw error;
  }
}

export interface WeeklyPlanInput {
  profile: { name: string; gender: string; timezone: string };
  natal: any;
  week_start_iso: string;
  transits?: any[];
}

export interface WeeklyPlanResult {
  week_start: string;
  week_end: string;
  days: Array<{
    date: string;
    day_of_week: string;
    money: string;
    work: string;
    study: string;
    love: string;
    health: string;
  }>;
}

// Determine which house a planet is in based on longitude
function findHouseForPlanet(longitude: number, cusps: number[]): number {
  if (!cusps || cusps.length < 12) return 1;
  
  for (let i = 0; i < 12; i++) {
    const houseStart = cusps[i];
    const nextHouseStart = cusps[(i + 1) % 12];
    
    if (houseStart > nextHouseStart) {
      if (longitude >= houseStart || longitude < nextHouseStart) {
        return i + 1;
      }
    } else {
      if (longitude >= houseStart && longitude < nextHouseStart) {
        return i + 1;
      }
    }
  }
  return 1;
}

// Summarize transits compactly without losing data
function summarizeTransits(transits: any[], locale: string = 'ru'): string {
  if (!transits || transits.length === 0) return '';
  
  // Planet and aspect translations for Russian
  const planetTranslations: Record<string, string> = {
    'Sun': 'Солнце', 'Moon': 'Луна', 'Mercury': 'Меркурий', 'Venus': 'Венера',
    'Mars': 'Марс', 'Jupiter': 'Юпитер', 'Saturn': 'Сатурн', 'Uranus': 'Уран',
    'Neptune': 'Нептун', 'Pluto': 'Плутон'
  };
  
  const aspectTranslations: Record<string, string> = {
    'conjunction': 'соединение', 'opposition': 'оппозиция', 'square': 'квадрат',
    'trine': 'трин', 'sextile': 'секстиль'
  };
  
  const translateTerm = (term: string): string => {
    if (locale !== 'ru') return term;
    return planetTranslations[term] || aspectTranslations[term] || term;
  };
  
  const transitSummaries = transits.map((t: any) => {
    const date = t.date || t.start_date || '?';
    const planet = translateTerm(t.planet || t.transiting_planet || '?');
    const aspect = translateTerm(t.aspect || '?');
    const target = translateTerm(t.natal_planet || t.target || '?');
    return `${date}: ${planet} ${aspect} ${target}`;
  }).join('; ');
  
  return transitSummaries;
}

// Extract key planet positions from natal chart for compact prompt
function extractKeyPlanetPositions(natal: any, locale: string = 'ru'): string {
  if (!natal || !natal.planets) return '';
  
  const cusps = natal.houses?.cusps || [];
  const planetEntries = Object.entries(natal.planets as Record<string, any>);
  
  const inHouse = locale === 'ru' ? 'в доме' : 'in house';
  const inSign = locale === 'ru' ? 'в' : 'in';
  
  const planetInfo = planetEntries.map(([name, data]: [string, any]) => {
    const house = cusps.length > 0 ? findHouseForPlanet(data.longitude, cusps) : '?';
    return `${name} ${inSign} ${data.sign || '?'} ${inHouse} ${house}`;
  }).join(', ');
  
  return planetInfo;
}

export async function generateWeeklyPlan(
  input: WeeklyPlanInput,
  locale: string = 'ru'
): Promise<WeeklyPlanResult> {
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(input.profile.gender);

  const weekEnd = new Date(input.week_start_iso);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRange = `${input.week_start_iso}..${weekEnd.toISOString().split('T')[0]}`;

  // Use compact planet positions instead of full natal chart
  const planetPositions = extractKeyPlanetPositions(input.natal, locale);
  
  // Localized labels
  const labels = {
    week: locale === 'ru' ? 'Неделя' : 'Week',
    name: locale === 'ru' ? 'Имя' : 'Name',
    gender: locale === 'ru' ? 'Пол' : 'Gender',
    timezone: locale === 'ru' ? 'Часовой пояс' : 'Timezone',
    planets: locale === 'ru' ? 'Основные позиции планет' : 'Key planet positions',
    transits: locale === 'ru' ? 'Транзиты недели' : 'Week transits'
  };
  
  // Include transits if available (compact summary without data loss)
  const transitsInfo = input.transits && input.transits.length > 0 
    ? `\n${labels.transits}: ${summarizeTransits(input.transits, locale)}` 
    : '';

  const promptData = `
${labels.week}: ${weekRange}
${labels.name}: ${input.profile.name}
${labels.gender}: ${input.profile.gender}
${labels.timezone}: ${input.profile.timezone}

${labels.planets}: ${planetPositions}${transitsInfo}
  `.trim();

  const promptText = loadPrompt('weekly_plan', {});
  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}\n\n${promptData}`;

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик. Составляешь недельные планы с конкретными рекомендациями. Возвращаешь только валидный JSON."
    : "You are a practical astrologer. You create weekly plans with concrete recommendations. Return only valid JSON.";

  console.log('[generateWeeklyPlan] Calling OpenAI with model: gpt-5');
  console.log('[generateWeeklyPlan] Prompt length:', finalPrompt.length);

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 5000
  });

  console.log('[generateWeeklyPlan] OpenAI response received');
  console.log('[generateWeeklyPlan] Completion object:', JSON.stringify(completion, null, 2));

  const content = completion.choices[0]?.message?.content;
  console.log('[generateWeeklyPlan] Content extracted:', content ? 'YES' : 'NO');
  console.log('[generateWeeklyPlan] Content length:', content?.length || 0);

  if (!content) {
    console.error('[generateWeeklyPlan] No content in response. Full completion:', JSON.stringify(completion, null, 2));
    throw new Error('Failed to generate weekly plan');
  }

  try {
    const result = JSON.parse(content);
    return result;
  } catch (e) {
    throw new Error('Failed to parse weekly plan response');
  }
}

export interface MonthlyPlanInput {
  profile: { name: string; gender: string; timezone: string };
  natal: any;
  month_iso: string;
  transits?: any[];
}

export interface MonthlyPlanResult {
  month: string;
  overview: string;
  weeks: Array<{
    week_number: number;
    dates: string;
    summary: string;
    key_themes: string[];
  }>;
}

export async function generateMonthlyPlan(
  input: MonthlyPlanInput,
  locale: string = 'ru'
): Promise<MonthlyPlanResult> {
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(input.profile.gender);

  const monthStart = new Date(input.month_iso);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const month = input.month_iso.substring(0, 7);

  // Use compact planet positions instead of full natal chart
  const planetPositions = extractKeyPlanetPositions(input.natal, locale);
  
  // Localized labels
  const labels = {
    month: locale === 'ru' ? 'Месяц' : 'Month',
    period: locale === 'ru' ? 'Период' : 'Period',
    name: locale === 'ru' ? 'Имя' : 'Name',
    gender: locale === 'ru' ? 'Пол' : 'Gender',
    timezone: locale === 'ru' ? 'Часовой пояс' : 'Timezone',
    planets: locale === 'ru' ? 'Основные позиции планет' : 'Key planet positions',
    transits: locale === 'ru' ? 'Транзиты месяца' : 'Month transits'
  };
  
  // Include transits if available (compact summary without data loss)
  const transitsInfo = input.transits && input.transits.length > 0 
    ? `\n${labels.transits}: ${summarizeTransits(input.transits, locale)}` 
    : '';

  const promptData = `
${labels.month}: ${month}
${labels.period}: ${input.month_iso}..${monthEnd.toISOString().split('T')[0]}
${labels.name}: ${input.profile.name}
${labels.gender}: ${input.profile.gender}
${labels.timezone}: ${input.profile.timezone}

${labels.planets}: ${planetPositions}${transitsInfo}
  `.trim();

  const promptText = loadPrompt('monthly_plan', {});
  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}\n\n${promptData}`;

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик. Составляешь месячные планы с учётом недель и ключевых дат. Возвращаешь только валидный JSON."
    : "You are a practical astrologer. You create monthly plans considering weeks and key dates. Return only valid JSON.";

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: finalPrompt
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 5000
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate monthly plan');
  }

  try {
    const result = JSON.parse(content);
    return result;
  } catch (e) {
    throw new Error('Failed to parse monthly plan response');
  }
}
