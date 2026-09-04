import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { translatePlanet, translateSign, translateSignPrepositional } from './astroTranslations';

// Using custom OpenAI API key provided by user
// the newest OpenAI model is "gpt-4o" which is the latest available model
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

export async function getImportantDateInterpretation(
  eventType: 'new_moon' | 'full_moon' | 'planet_transit',
  eventData: {
    date: string;
    sign: string;
    planet?: string;
    from_sign?: string;
    to_sign?: string;
    house_for_sun_sign?: number;
  },
  userData: {
    name?: string;
    sunSign: string;
    ascendantSign?: string;
    gender?: string;
  },
  locale: string = 'ru'
): Promise<string> {
  const languageInstruction = locale === 'ru' 
    ? 'ВАЖНО: Ответь полностью на русском языке.' 
    : 'Respond in English.';
  
  const toneInstruction = personalizeTone(userData.gender || 'other');
  
  const eventTypeText = locale === 'ru' 
    ? (eventType === 'new_moon' ? 'Новолуние' : eventType === 'full_moon' ? 'Полнолуние' : 'Транзит планеты')
    : (eventType === 'new_moon' ? 'New Moon' : eventType === 'full_moon' ? 'Full Moon' : 'Planet Transit');
  
  let eventDescription = '';
  if (eventType === 'new_moon' || eventType === 'full_moon') {
    const signName = translateSign(eventData.sign, locale);
    const signNamePrep = translateSignPrepositional(eventData.sign, locale);
    eventDescription = locale === 'ru'
      ? `${eventTypeText} в знаке ${signNamePrep}`
      : `${eventTypeText} in ${signName}`;
    
    if (eventData.house_for_sun_sign) {
      eventDescription += locale === 'ru'
        ? ` (${eventData.house_for_sun_sign}-й дом)`
        : ` (${eventData.house_for_sun_sign}${getOrdinalSuffix(eventData.house_for_sun_sign)} house)`;
    }
  } else if (eventType === 'planet_transit' && eventData.planet) {
    const planetName = translatePlanet(eventData.planet, locale);
    const toSignName = eventData.to_sign ? translateSign(eventData.to_sign, locale) : '';
    eventDescription = locale === 'ru'
      ? `${planetName} входит в ${toSignName}`
      : `${planetName} enters ${toSignName}`;
    
    if (eventData.house_for_sun_sign) {
      eventDescription += locale === 'ru'
        ? ` (${eventData.house_for_sun_sign}-й дом)`
        : ` (${eventData.house_for_sun_sign}${getOrdinalSuffix(eventData.house_for_sun_sign)} house)`;
    }
  }
  
  const userName = userData.name || (locale === 'ru' ? 'пользователя' : 'the user');
  
  const userContext = locale === 'ru'
    ? `${userData.name ? `Имя: ${userData.name}\n` : ''}Солнце в знаке ${translateSignPrepositional(userData.sunSign, locale)}${userData.ascendantSign ? `, Асцендент в ${translateSignPrepositional(userData.ascendantSign, locale)}` : ''}.`
    : `${userData.name ? `Name: ${userData.name}\n` : ''}Sun in ${translateSign(userData.sunSign, locale)}${userData.ascendantSign ? `, Ascendant in ${translateSign(userData.ascendantSign, locale)}` : ''}.`;
  
  const promptText = locale === 'ru'
    ? `Событие: ${eventDescription}
Дата: ${new Date(eventData.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}

${userContext}

Напиши персонализированную астрологическую интерпретацию этого события (${eventTypeText})${userData.name ? ` для ${userData.name}` : ' для этого человека'}:

1. Что означает это событие лично${userData.name ? ` для ${userData.name}` : ' для него/неё'} (с учетом положения Солнца${userData.ascendantSign ? ' и Асцендента' : ''})
2. Какие сферы жизни будут активированы (основываясь на доме, в который попадает событие)
3. Практические рекомендации: что делать, на что обратить внимание
4. Возможности и вызовы этого периода

ВАЖНО: НЕ начинай с формального обращения типа "Уважаемый(ая)" или подобных. Начни сразу с содержательной части интерпретации${userData.name ? `, используя имя ${userData.name} естественно по тексту, где это уместно` : ''}. Пиши конкретно, практично и с теплотой. Избегай общих фраз и абстракций. Дай реальные советы.

Объём: 200-300 слов.`
    : `Event: ${eventDescription}
Date: ${new Date(eventData.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}

${userContext}

Write a personalized astrological interpretation of this event (${eventTypeText})${userData.name ? ` for ${userData.name}` : ' for this person'}:

1. What this event means personally${userData.name ? ` for ${userData.name}` : ' for them'} (considering their Sun${userData.ascendantSign ? ' and Ascendant' : ''} positions)
2. Which life areas will be activated (based on the house the event falls in)
3. Practical recommendations: what to do, what to pay attention to
4. Opportunities and challenges of this period

IMPORTANT: Do NOT start with formal greetings like "Dear [Name]" or similar. Start directly with the substantive interpretation${userData.name ? `, using the name ${userData.name} naturally in the text where appropriate` : ''}. Write specifically, practically, and warmly. Avoid general phrases and abstractions. Give real advice.

Length: 200-300 words.`;
  
  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог, который предоставляет четкие, практичные и проницательные чтения без эзотерического жаргона. Твои советы конкретны, действенны и основаны на астрологических принципах. Всегда отвечай на русском языке. НИКОГДА не начинай ответ с формальных обращений типа 'Уважаемый(ая)', 'Дорогой(ая)' или подобных - сразу переходи к содержанию."
    : "You are an expert astrologer who provides clear, practical, and insightful readings without esoteric jargon. Your advice is specific, actionable, and based on astrological principles. NEVER start your response with formal greetings like 'Dear' or similar - go straight to the content.";
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "user",
        content: `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}`
      }
    ],
    max_completion_tokens: 1024
  });
  
  return completion.choices[0]?.message?.content || "";
}

function getOrdinalSuffix(num: number): string {
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
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
      angles: JSON.stringify(data.angles, null, 2),
      houses: JSON.stringify(data.houses?.cusps || [], null, 2),
      houseSystem: data.houses?.system || 'Placidus',
      aspects: JSON.stringify(data.aspects, null, 2)
    },
    solar: {
      chart: JSON.stringify(data.chart, null, 2),
      date: data.date?.toISOString() || '',
      location: data.location || '',
      targetYear: data.targetYear?.toString() || ''
    },
    horoscope: {
      period: data.period,
      chart: JSON.stringify(data.chart, null, 2),
      period_text: data.period === 'day' ? 'day' : data.period === 'week' ? 'week' : 'month'
    },
    compatibility: {
      host_name: data.host_name || 'Person 1',
      host_gender: data.host_gender || 'other',
      partner_name: data.partner_name || 'Person 2',
      partner_gender: data.partner_gender || 'other',
      relationship_type: data.relationship_type || 'romantic',
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
    model: "gpt-4o",
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
}

// Short interpretation for free users (without subscription)
export interface PlanetShortInterpretation {
  title: string;
  summary: string;
}

export async function getPlanetShortInterpretation(
  data: PlanetInterpretationData,
  locale: string = 'ru'
): Promise<PlanetShortInterpretation> {
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const profileGender = data.profile.gender ? `, ${data.profile.gender}` : '';

  const localizedPlanetName = translatePlanet(data.planet.name, locale);
  const localizedSign = translateSign(data.planet.sign, locale);

  const localizedSignPrep = translateSignPrepositional(data.planet.sign, locale);
  const promptText = loadPrompt('planet_short', {
    planet_name: localizedPlanetName,
    planet_sign: localizedSign,
    planet_sign_prep: localizedSignPrep,
    profile_name: data.profile.name,
    profile_gender: profileGender
  });

  const finalPrompt = `${languageInstruction}\n\n${promptText}`;

  const systemMessage = locale === 'ru'
    ? "Ты астролог. Даёшь краткие характеристики планет. Возвращаешь только валидный JSON."
    : "You are an astrologer. You give brief planet characteristics. Return only valid JSON.";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: finalPrompt }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 300
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate short planet interpretation');
  }

  try {
    const result = JSON.parse(content);
    const localizedSignPrep = translateSignPrepositional(data.planet.sign, locale);
    const fallbackTitle = locale === 'ru' 
      ? `${localizedPlanetName} в ${localizedSignPrep}`
      : `${localizedPlanetName} in ${localizedSign}`;
    
    return {
      title: result.title || fallbackTitle,
      summary: result.summary || ''
    };
  } catch (e) {
    throw new Error('Failed to parse short planet interpretation');
  }
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

  // Локализуем названия планет и знаков перед отправкой в GPT
  const localizedPlanetName = translatePlanet(data.planet.name, locale);
  const localizedSign = translateSign(data.planet.sign, locale);

  const localizedSignPrep = translateSignPrepositional(data.planet.sign, locale);
  const promptText = loadPrompt('planet', {
    planet_name: localizedPlanetName,
    planet_sign: localizedSign,
    planet_sign_prep: localizedSignPrep,
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
    model: "gpt-4o",
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
    const localizedPlanetName = translatePlanet(data.planet.name, locale);
    const localizedSignPrep = translateSignPrepositional(data.planet.sign, locale);
    const localizedSign = translateSign(data.planet.sign, locale);
    const fallbackTitle = locale === 'ru' 
      ? `${localizedPlanetName} в ${localizedSignPrep}`
      : `${localizedPlanetName} in ${localizedSign}`;
    
    return {
      title: result.title || fallbackTitle,
      summary: result.summary || '',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      risks: Array.isArray(result.risks) ? result.risks : [],
      advice: Array.isArray(result.advice) ? result.advice : []
    };
  } catch (e) {
    throw new Error('Failed to parse planet interpretation response');
  }
}

export interface HouseInfluenceData {
  planet: {
    name: string;
    sign: string;
    house: number;
  };
  profile: {
    name: string;
    age?: number;
    gender?: string;
  };
}

export interface HouseInfluenceResult {
  title: string;
  life_sphere: string;
  manifestation: string;
  key_themes: string[];
  opportunities: string[];
  challenges: string[];
  practical_work: string[];
}

export async function getHouseInfluence(
  data: HouseInfluenceData,
  locale: string = 'ru'
): Promise<HouseInfluenceResult> {
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(data.profile.gender || 'other');

  // Локализуем названия планет и знаков перед отправкой в GPT
  const localizedPlanetName = translatePlanet(data.planet.name, locale);
  const localizedSign = translateSign(data.planet.sign, locale);

  const shortTheme = locale === 'ru' ? 'сфера проявления' : 'area of manifestation';

  const profileAge = data.profile.age ? `, ${data.profile.age} ${locale === 'ru' ? 'лет' : 'years old'}` : '';
  const profileGender = data.profile.gender ? `, ${data.profile.gender}` : '';

  const localizedSignPrep = translateSignPrepositional(data.planet.sign, locale);
  const promptText = loadPrompt('house_influence', {
    planet_name: localizedPlanetName,
    planet_sign: localizedSign,
    planet_sign_prep: localizedSignPrep,
    planet_house: String(data.planet.house),
    short_theme: shortTheme,
    profile_name: data.profile.name,
    profile_age: profileAge,
    profile_gender: profileGender
  });

  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}`;

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик, специализирующийся на домах. Объясняешь влияние домов конкретно и без воды. Возвращаешь только валидный JSON."
    : "You are a practical astrologer specializing in houses. You explain house influences concretely without fluff. Return only valid JSON.";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
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
    max_completion_tokens: 2500
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate house influence interpretation');
  }

  try {
    const result = JSON.parse(content);
    const fallbackTitle = locale === 'ru'
      ? `${localizedPlanetName} в ${data.planet.house}-м доме`
      : `${localizedPlanetName} in House ${data.planet.house}`;

    return {
      title: result.title || fallbackTitle,
      life_sphere: result.life_sphere || '',
      manifestation: result.manifestation || '',
      key_themes: Array.isArray(result.key_themes) ? result.key_themes : [],
      opportunities: Array.isArray(result.opportunities) ? result.opportunities : [],
      challenges: Array.isArray(result.challenges) ? result.challenges : [],
      practical_work: Array.isArray(result.practical_work) ? result.practical_work : []
    };
  } catch (e) {
    throw new Error('Failed to parse house influence response');
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
    model: "gpt-4o",
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
    model: "gpt-4o",
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
  transits?: any[] | Record<string, { sign: string; natalHouse: number; longitude: number }>;
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
  money?: string;
  work?: string;
  study?: string;
  love?: string;
  health?: string;
  self_care?: string;
  overview?: string;
  advice?: string;
}

export async function interpretHoroscope(
  input: HoroscopeInterpretationInput,
  locale: string = 'ru',
  period: 'daily' | 'monthly' = 'daily',
  monthName?: string
): Promise<HoroscopeInterpretationResult> {
  console.log(`[INTERPRET_HOROSCOPE] Starting ${period} horoscope generation, locale:`, locale);
  
  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке. Весь текст должен быть на русском.'
    : 'IMPORTANT: Respond STRICTLY in English. All text must be in English.';

  const toneInstruction = personalizeTone(input.profile.gender);

  const today = new Date().toISOString().split('T')[0];

  // Use compact planet positions instead of full natal chart
  const planetPositions = extractKeyPlanetPositions(input.natal, locale);
  
  // Localized labels
  const isMonthly = period === 'monthly';
  const labels = {
    period: locale === 'ru' ? 'Период' : 'Period',
    date: locale === 'ru' ? (isMonthly ? 'Месяц' : 'Дата') : (isMonthly ? 'Month' : 'Date'),
    name: locale === 'ru' ? 'Имя' : 'Name',
    gender: locale === 'ru' ? 'Пол' : 'Gender',
    timezone: locale === 'ru' ? 'Часовой пояс' : 'Timezone',
    planets: locale === 'ru' ? 'Основные позиции планет' : 'Key planet positions',
    transits: locale === 'ru' ? (isMonthly ? 'Транзиты месяца' : 'Транзиты дня') : (isMonthly ? 'Month transits' : 'Day transits')
  };
  
  // Include transits if available (compact summary without data loss)
  // Support both formats: array (old) and object (new transits in natal houses)
  let transitsInfo = '';
  if (input.transits) {
    if (Array.isArray(input.transits) && input.transits.length > 0) {
      // Old format: array of transits
      transitsInfo = `\n${labels.transits}: ${summarizeTransits(input.transits, locale)}`;
    } else if (typeof input.transits === 'object' && Object.keys(input.transits).length > 0) {
      // New format: transits mapped to natal houses
      transitsInfo = `\n${labels.transits}: ${formatTransitsInNatalHouses(input.transits as any, locale)}`;
    }
  }

  const periodValue = isMonthly ? 'month' : 'day';
  const dateValue = isMonthly && monthName ? monthName : today;

  const promptData = `
${labels.period}: ${periodValue}
${labels.date}: ${dateValue}
${labels.name}: ${input.profile.name}
${labels.gender}: ${input.profile.gender}
${labels.timezone}: ${input.profile.timezone}

${labels.planets}: ${planetPositions}${transitsInfo}
  `.trim();

  // Use different prompt for monthly vs daily
  const promptFile = isMonthly ? 'horoscope_monthly' : 'horoscope';
  const promptText = loadPrompt(promptFile, {});
  const finalPrompt = `${languageInstruction}\n\n${toneInstruction}\n\n${promptText}\n\n${promptData}`;

  console.log('[INTERPRET_HOROSCOPE] Prompt length:', finalPrompt.length);

  const systemMessage = locale === 'ru'
    ? "Ты опытный астролог-практик. Даёшь структурированные гороскопы с практичными советами. Возвращаешь только валидный JSON."
    : "You are a practical astrologer. You provide structured horoscopes with practical advice. Return only valid JSON.";

  console.log('[INTERPRET_HOROSCOPE] Calling OpenAI...');
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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
      max_completion_tokens: 15000
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

// Format transits mapped to natal houses for horoscope interpretation
function formatTransitsInNatalHouses(
  transitsInHouses: Record<string, { sign: string; natalHouse: number; longitude: number }>,
  locale: string = 'ru'
): string {
  if (!transitsInHouses || Object.keys(transitsInHouses).length === 0) return '';
  
  const planetTranslations: Record<string, string> = {
    'Sun': 'Солнце', 'Moon': 'Луна', 'Mercury': 'Меркурий', 'Venus': 'Венера',
    'Mars': 'Марс', 'Jupiter': 'Юпитер', 'Saturn': 'Сатурн', 'Uranus': 'Уран',
    'Neptune': 'Нептун', 'Pluto': 'Плутон', 'North Node': 'Северный Узел', 'South Node': 'Южный Узел'
  };
  
  const houseLabel = locale === 'ru' ? 'дом' : 'house';
  const inLabel = locale === 'ru' ? 'в' : 'in';
  
  const transitLines = Object.entries(transitsInHouses).map(([planetName, data]) => {
    const planet = locale === 'ru' ? (planetTranslations[planetName] || planetName) : planetName;
    return `${planet} ${inLabel} ${data.sign} (${data.natalHouse}-й ${houseLabel})`;
  });
  
  return transitLines.join(', ');
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

  console.log('[generateWeeklyPlan] Calling OpenAI with model: gpt-4o');
  console.log('[generateWeeklyPlan] Prompt length:', finalPrompt.length);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
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
    max_completion_tokens: 15000
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
    model: "gpt-4o",
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
    max_completion_tokens: 15000
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

// ============================================================
// Generic per-sign daily horoscope for the SEO website
// (public, non-personalized; cached per sign per day)
// ============================================================

export interface SignDayHoroscope {
  intro: string;
  work: string;
  love: string;
  care: string;
  advice: string;
  lucky: number;
}

const signHoroscopeCache = new Map<string, { date: string; data: SignDayHoroscope }>();

/**
 * Generates (or returns cached) generic daily horoscope for a sun sign.
 * Cache key = sign slug; invalidated when the Moscow date changes.
 * Max 12 GPT calls per day across all signs.
 */
export async function generateSignHoroscope(
  signSlug: string,
  signRu: string,
  locale: string = 'ru'
): Promise<SignDayHoroscope> {
  const todayMsk = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }); // YYYY-MM-DD

  // Кэш раздельный по локалям: до 24 GPT-вызовов в сутки (12 знаков × 2 языка)
  const cacheKey = `${signSlug}:${locale}`;
  const cached = signHoroscopeCache.get(cacheKey);
  if (cached && cached.date === todayMsk) {
    return cached.data;
  }

  const SIGN_EN: Record<string, string> = {
    aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer',
    leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio',
    sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces',
  };
  const signName = locale === 'en' ? (SIGN_EN[signSlug] || signRu) : signRu;
  const dateStr = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  });

  const promptText = loadPrompt('horoscope_sign', {
    sign: signName,
    date: dateStr,
  });

  const languageInstruction = locale === 'ru'
    ? 'ВАЖНО: Ответь СТРОГО на русском языке.'
    : 'IMPORTANT: Respond STRICTLY in English.';

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Ты опытный астролог-практик. Даёшь структурированные гороскопы с практичными советами. Возвращаешь только валидный JSON."
      },
      {
        role: "user",
        content: `${languageInstruction}\n\n${promptText}`
      }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1200
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to generate sign horoscope');
  }

  const parsed = JSON.parse(content);
  const data: SignDayHoroscope = {
    intro: String(parsed.intro || ''),
    work: String(parsed.work || ''),
    love: String(parsed.love || ''),
    care: String(parsed.care || ''),
    advice: String(parsed.advice || ''),
    lucky: Math.min(99, Math.max(1, parseInt(parsed.lucky, 10) || 7)),
  };

  signHoroscopeCache.set(cacheKey, { date: todayMsk, data });
  return data;
}

// ===== Матрица судьбы: генерация разбора секции =====
import { MATRIX_KB_VERSION, arcanaByN, type ArcanaKnowledge } from './matrixKb.js';
import type { MatrixSectionId } from '@shared/matrix';

const MATRIX_SECTION_TITLES: Record<string, { ru: string; en: string; posKey: keyof ArcanaKnowledge['pos'] }> = {
  comfort: { ru: 'Зона комфорта (центр матрицы)', en: 'Comfort zone (matrix center)', posKey: 'personality' },
  persona: { ru: 'Визитная карточка (как вас считывают)', en: 'Calling card (how people read you)', posKey: 'personality' },
  karmic_tail: { ru: 'Кармический хвост', en: 'Karmic tail', posKey: 'karma' },
  money: { ru: 'Денежный канал', en: 'Money channel', posKey: 'money' },
  love: { ru: 'Канал отношений', en: 'Relationships channel', posKey: 'relationships' },
  purpose: { ru: 'Предназначение (4 уровня)', en: 'Life purpose (4 levels)', posKey: 'spirit' },
  rod: { ru: 'Родовой квадрат', en: 'Ancestral square', posKey: 'karma' },
};

export async function generateMatrixSection(params: {
  section: MatrixSectionId;
  arcana: number[];
  name: string;
  gender: string;
  birthDate: string; // YYYY-MM-DD
  locale: string;
}): Promise<string> {
  const { section, arcana, name, gender, birthDate, locale } = params;
  const meta = MATRIX_SECTION_TITLES[section];

  const knowledge = arcana
    .map((n) => {
      const a = arcanaByN(n);
      return [
        `Аркан ${a.n} «${a.name}» (${a.keywords.join(', ')})`,
        `  В плюсе: ${a.plus}`,
        `  В минусе: ${a.minus}`,
        `  Задача: ${a.task}`,
        `  В этой позиции: ${a.pos[meta.posKey]}`,
      ].join('\n');
    })
    .join('\n\n');

  const languageInstruction =
    locale === 'en'
      ? 'IMPORTANT: Respond STRICTLY in English (arcana names may be translated naturally).'
      : 'ВАЖНО: Ответь СТРОГО на русском языке.';

  const promptText = loadPrompt('matrix_section', {
    name,
    birthDate,
    sectionTitle: locale === 'en' ? meta.en : meta.ru,
    arcanaList: arcana.join(', '),
    knowledge,
    toneInstruction: personalizeTone(gender || 'other'),
    languageInstruction,
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'Ты — тёплый и практичный консультант по Матрице судьбы. Пишешь связные персональные разборы без эзотерических клише, строго по переданной базе знаний.',
      },
      { role: 'user', content: promptText },
    ],
    max_completion_tokens: 700,
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('Failed to generate matrix section');
  return content;
}

export { MATRIX_KB_VERSION };

// ============ ТАРО ============
export interface TarotInterpretationInput {
  spread: 'daily' | 'yesno' | 'three' | 'celtic';
  question?: string | null;
  name: string;
  gender: string;
  locale: 'ru' | 'en';
  cards: Array<{
    name: string;
    position: string;
    reversed: boolean;
    keywordsUpright: string;
    keywordsReversed: string;
  }>;
}

export interface TarotInterpretationResult {
  intro: string;
  cards: Array<{ title: string; text: string }>;
  synthesis: string;
  advice: string;
  /** только для yesno: yes | no | maybe */
  verdict?: string;
}

export async function generateTarotReading(input: TarotInterpretationInput): Promise<TarotInterpretationResult> {
  const ru = input.locale !== 'en';
  const languageInstruction = ru
    ? 'ВАЖНО: Ответь СТРОГО на русском языке, обращение на «ты».'
    : 'IMPORTANT: Respond STRICTLY in English, address the person as "you".';

  const spreadNote: Record<string, string> = {
    daily: ru
      ? 'Это «Карта дня»: одна карта как фокус и настроение дня. intro 1 предложение, текст карты 2-3 абзаца, advice — на сегодня.'
      : 'This is a "Card of the day": one card as the focus of the day. One-sentence intro, 2-3 paragraphs for the card, advice for today.',
    yesno: ru
      ? 'Это расклад «Да/Нет». Дай поле verdict: "yes" | "no" | "maybe" по духу карты (прямая позитивная → yes и т.п.), а в тексте объясни оттенки: при каких условиях да, что может помешать.'
      : 'This is a Yes/No spread. Provide verdict: "yes" | "no" | "maybe" by the card\'s spirit, and explain nuances in the text.',
    three: ru
      ? 'Это расклад из 3 карт НА ВОПРОС: карты — не прошлое/настоящее/будущее, а три грани ответа. Сам реши по выпавшим картам, какую грань вопроса освещает каждая (корень ситуации, скрытый фактор, ресурс, препятствие, вероятное развитие — что уместно), и назови эту грань в title карты после её имени.'
      : 'A 3-card spread ABOUT THE QUESTION: the cards are not past/present/future but three facets of the answer. Decide from the drawn cards which facet each illuminates (the root, a hidden factor, a resource, an obstacle, the likely direction — whichever fits) and name that facet in the card title after its name.',
    celtic: ru
      ? 'Это Кельтский крест из 10 позиций. Разбор каждой позиции короче (2-3 предложения), синтез — развёрнутый.'
      : 'A 10-position Celtic Cross. Keep each position brief (2-3 sentences); make the synthesis substantial.',
  };

  const systemMessage = ru
    ? `Ты — тёплый, эмпатичный проводник по картам Таро в приложении Astro Orb. Таро — зеркало для саморефлексии, а не предсказание судьбы.
Названия карт пиши на английском, при первом упоминании добавь русское название в скобках — например «The Fool (Шут)», дальше используй английское.
ЖЁСТКИЕ ЗАПРЕТЫ: не предсказывай болезни, смерть, диагнозы, беременность и точные даты; не давай медицинских/юридических/финансовых гарантий; не обещай «100% сбудется»; не пугай — «тяжёлые» карты (Смерть, Башня, 10 Мечей) трактуй как процесс трансформации; про здоровье и чужую волю — мягко возвращай фокус на самого человека.
Перевёрнутая карта = энергия заблокирована, направлена внутрь, на спаде или высвобождается — не «плохо».
КОНКРЕТИКА ОБЯЗАТЕЛЬНА: каждый разбор карты строится из трёх ходов — (1) живой образ карты в одном предложении, (2) как именно этот образ отвечает на вопрос человека — с деталями ИЗ ЕГО вопроса (если спросил про деньги и море — говори про деньги и море, а не «твои цели»), (3) один конкретный шаг или пример поведения на этой неделе. Слова «возможно», «может быть», «вероятно» — максимум одно на весь ответ: карты говорят утверждениями. advice — 2-3 конкретных действия, а не пожелания.
Запрещены клише («вас ждут перемены», «всё будет хорошо», «внутренняя работа», «сфокусируйся на себе») — говори конкретно, через образы карты и вопрос человека. Возвращай только валидный JSON.`
    : `You are a warm, empathetic Tarot guide in the Astro Orb app. Tarot is a mirror for self-reflection, not fortune-telling.
HARD RULES: never predict illness, death, diagnoses, pregnancy or exact dates; no medical/legal/financial guarantees; never promise certainty; never frighten — treat "heavy" cards (Death, The Tower, Ten of Swords) as transformation; on health or other people's will, gently return focus to the person themselves.
A reversed card = energy blocked, turned inward, waning or releasing — not "bad".
SPECIFICITY IS MANDATORY: every card reading has three moves — (1) the card's living image in one sentence, (2) how exactly that image answers THIS question, using the person's own details (if they asked about money and the sea — talk about money and the sea, not "your goals"), (3) one concrete step or behavioral example for this week. Hedging words ("perhaps", "maybe", "possibly") — at most one in the whole reply: the cards speak in statements. advice = 2-3 concrete actions, not wishes.
No clichés ("changes await you", "everything will be fine", "inner work") — be specific, through the card's imagery and the person's question. Return only valid JSON.`;

  const cardsBlock = input.cards.map((c, i) =>
    `${i + 1}. ${ru ? 'Позиция' : 'Position'} «${c.position}»: ${c.name}${c.reversed ? (ru ? ' (перевёрнутая)' : ' (reversed)') : ''}. ${ru ? 'Ключи прямой' : 'Upright keys'}: ${c.keywordsUpright}. ${ru ? 'Ключи перевёрнутой' : 'Reversed keys'}: ${c.keywordsReversed}.`
  ).join('\n');

  const userPrompt = `${languageInstruction}

${spreadNote[input.spread]}

${ru ? 'Человек' : 'Person'}: ${input.name} (${input.gender}).
${input.question ? `${ru ? 'Вопрос' : 'Question'}: «${input.question}»` : (ru ? 'Вопрос не задан — читай про общее состояние и ближайший фокус.' : 'No question — read the general state and near focus.')}

${ru ? 'Выпавшие карты' : 'Cards drawn'}:
${cardsBlock}

${ru ? 'Верни JSON' : 'Return JSON'}: {
  "intro": string,
  "cards": [{ "title": string, "text": string }] (${ru ? 'ровно' : 'exactly'} ${input.cards.length}),
  "synthesis": string,
  "advice": string${input.spread === 'yesno' ? ',\n  "verdict": "yes" | "no" | "maybe"' : ''}
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
    max_completion_tokens: input.spread === 'celtic' ? 4000 : 2200,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Failed to generate tarot reading');
  const result = JSON.parse(content);
  return {
    intro: result.intro || '',
    cards: Array.isArray(result.cards) ? result.cards.slice(0, input.cards.length) : [],
    synthesis: result.synthesis || '',
    advice: result.advice || '',
    verdict: result.verdict,
  };
}
