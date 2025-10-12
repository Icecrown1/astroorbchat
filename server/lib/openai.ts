// Reference: blueprint:javascript_openai_ai_integrations
import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
export const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export async function getAstrologyInterpretation(
  type: 'natal' | 'solar' | 'horoscope' | 'compatibility' | 'ask',
  data: any,
  locale: string = 'en'
): Promise<string> {
  const languageInstruction = locale === 'ru' 
    ? 'ВАЖНО: Ответь полностью на русском языке.' 
    : 'Respond in English.';
  
  const prompts = {
    natal: `${languageInstruction}

You are an expert astrologer. Based on the following natal chart data, provide a comprehensive interpretation in 250-400 words. Be specific, practical, and insightful without esoteric jargon.

Planetary Positions:
${JSON.stringify(data.planets, null, 2)}

Aspects:
${JSON.stringify(data.aspects, null, 2)}

Provide clear insights about personality, strengths, challenges, and life themes.`,

    solar: `${languageInstruction}

You are an expert astrologer. Based on the solar return position for today, provide practical daily guidance in 200-300 words.

Solar Data:
${JSON.stringify(data, null, 2)}

Focus on today's energy, opportunities, and practical advice.`,

    horoscope: `${languageInstruction}

You are an expert astrologer. Create a ${data.period} horoscope based on the user's chart. Provide 200-300 words of practical guidance.

Chart Data:
${JSON.stringify(data.chart, null, 2)}

Be specific and actionable. Focus on the ${data.period === 'day' ? 'day' : data.period === 'week' ? 'week' : 'month'} ahead.`,

    compatibility: `${languageInstruction}

You are an expert relationship astrologer. Analyze compatibility between two people based on their charts. Provide 250-400 words covering strengths and challenges.

Person 1:
${JSON.stringify(data.person1, null, 2)}

Person 2:
${JSON.stringify(data.person2, null, 2)}

Be balanced, practical, and insightful about relationship dynamics.`,

    ask: `${languageInstruction}

You are an expert astrologer. Answer the following question based on the user's natal chart. Provide 200-350 words of clear, practical guidance.

User's Chart:
${JSON.stringify(data.chart, null, 2)}

Question: ${data.question}

Provide insightful, actionable advice grounded in astrological wisdom.`
  };

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
        content: prompts[type]
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

  const prompt = `${languageInstruction}

Ты — строгий прикладной астролог. На входе данные:

Планета: ${data.planet.name}
Знак: ${data.planet.sign}
Дом: ${data.planet.house}
${data.planet.aspects && data.planet.aspects.length > 0 ? `Аспекты: ${JSON.stringify(data.planet.aspects)}` : ''}

Профиль: ${data.profile.name}${data.profile.age ? `, ${data.profile.age} лет` : ''}${data.profile.gender ? `, ${data.profile.gender}` : ''}

ЗАДАЧА: Кратко и прикладно объясни, что значит это положение планеты ДЛЯ КОНКРЕТНОГО ЧЕЛОВЕКА.

Верни ТОЛЬКО валидный JSON в формате:
{
  "title": "${data.planet.name} в ${data.planet.sign}",
  "summary": "3-4 предложения по сути без воды",
  "strengths": ["пункт 1", "пункт 2", "пункт 3"],
  "risks": ["пункт 1", "пункт 2"],
  "advice": ["конкретный шаг 1", "конкретный шаг 2", "конкретный шаг 3"],
  "house_note": "1 короткая фраза, как ${data.planet.house}-й дом модифицирует значение"
}

Правила:
- Ни единой эзотерической воды, только практическая польза
- Пиши на ${locale === 'ru' ? 'русском' : 'английском'}, просто и по делу
- Только JSON, никакого дополнительного текста`;

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
        content: prompt
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
