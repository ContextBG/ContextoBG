import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GuessResult {
  word: string;
  rank: number;
  score: number; // 0 to 100
}

export async function transcribeAudio(base64Audio: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          mimeType: "audio/wav",
          data: base64Audio,
        },
      },
      { text: "Транскрибирай това аудио на български език. Върни само едната дума, която чуваш. Ако са повече, върни само първата." },
    ],
  });
  return response.text?.trim() || "";
}

export async function validateWord(word: string): Promise<{ isValid: boolean; error?: string }> {
  // Check for Cyrillic only
  const cyrillicRegex = /^[а-яА-ЯёЁ]+$/;
  if (!cyrillicRegex.test(word)) {
    return { isValid: false, error: "Моля, използвайте само кирилица." };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Съществува ли думата "${word}" в българския език като съществително, прилагателно или глагол? Отговори само с "ДА" или "НЕ".`,
  });

  const text = response.text?.trim().toUpperCase();
  if (text?.includes("ДА")) {
    return { isValid: true };
  }
  return { isValid: false, error: "Тази дума не съществува в българския речник." };
}

export async function getSimilarityRank(guess: string, secretWord: string): Promise<GuessResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Ти си двигател за семантична близост. Тайната дума е "${secretWord}". 
    Оцени думата "${guess}" спрямо тайната дума.
    Върни JSON обект със следните полета:
    - score: число от 0 до 100 (където 100 е идентична дума, а 0 е напълно несвързана).
    - rank: приблизителен ранг от 1 до 50000 (където 1 е тайната дума). 
    Ако думата е много близка (синоним), рангът трябва да е под 100.
    Ако е свързана по тема, рангът трябва да е под 1000.
    Ако е далечна, рангът трябва да е над 5000.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          rank: { type: Type.INTEGER },
        },
        required: ["score", "rank"],
      },
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      word: guess,
      rank: data.rank || 50000,
      score: data.score || 0,
    };
  } catch (e) {
    return {
      word: guess,
      rank: 50000,
      score: 0,
    };
  }
}

export async function getHint(guesses: GuessResult[], secretWord: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Дай една много кратка подсказка за думата "${secretWord}". Не я казвай. Използвай само 5-6 думи.`,
  });
  return response.text?.trim() || "Опитай пак след малко.";
}

export const COMMON_BULGARIAN_WORDS = [
  "къща", "дърво", "слънце", "кола", "книга", "вода", "хляб", "планина", "море", "град",
  "човек", "дете", "време", "работа", "училище", "приятел", "любов", "живот", "свят", "път",
  "ръка", "око", "глава", "сърце", "ден", "нощ", "небе", "земя", "огън", "въздух",
  "цвете", "птица", "куче", "котка", "риба", "вятър", "дъжд", "сняг", "облак", "звезда",
  "луна", "река", "езеро", "гора", "поле", "село", "улица", "сграда", "прозорец", "врата",
  "маса", "стол", "легло", "кухня", "храна", "плод", "зеленчук", "ябълка", "хляб", "мляко",
  "кафе", "чай", "захар", "сол", "пари", "карта", "телефон", "компютър", "книга", "вестник",
  "списание", "филм", "музика", "песен", "танц", "театър", "музей", "изкуство", "история", "наука",
  "език", "дума", "буква", "число", "цвят", "форма", "звук", "светлина", "сянка", "мечта"
];

export function getDailySecretWord() {
  const today = new Date().toISOString().split('T')[0];
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COMMON_BULGARIAN_WORDS.length;
  return COMMON_BULGARIAN_WORDS[index];
}
