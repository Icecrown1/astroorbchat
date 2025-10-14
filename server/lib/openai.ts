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

  return completion.choices[0]?.message?.content || "Unable to generate interpretation at this time.";
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
