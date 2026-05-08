import { ipcClient } from './ipcClient';
import { resolveAiConfig } from './aiConfigService';
import type {
  StoryStyle,
  StoryDifficulty,
  StoryLength,
  StoryRow,
  SaveStoryPayload,
  GenerateTTSResult
} from '../types/story';
import { DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from '../types/story';

export interface GenerateStoryTextOptions {
  words: string[];
  style: StoryStyle;
  difficulty: StoryDifficulty;
  length: StoryLength;
  bilingual: boolean;
  model?: string;
  /** Progressive text callback (receives the accumulated raw string so far). */
  onProgress?: (accumulated: string) => void;
}

export interface GeneratedStoryText {
  title: string;
  bodyEn: string;
  bodyZh: string;
}

interface StreamEvent {
  requestId?: string;
  type?: 'delta' | 'complete' | 'error';
  content?: string;
  message?: string;
}

const LENGTH_HINT: Record<StoryLength, string> = {
  short: 'about 120 English words',
  medium: 'about 250 English words',
  long: 'about 400 English words'
};

const STYLE_HINT: Record<StoryStyle, string> = {
  short_story: 'a short story with a clear plot',
  dialogue: 'a two-person dialogue (label speakers as A: / B:)',
  scene: 'a vivid scene description with one or two characters'
};

const buildPrompt = (opts: GenerateStoryTextOptions): { system: string; user: string } => {
  const wordsLine = opts.words.map((w) => `"${w}"`).join(', ');
  const system = [
    'You are an English teacher writing engaging learning material for Chinese learners.',
    'Use the target words naturally — every target word MUST appear at least once.',
    'Keep grammar at the requested CEFR level.',
    'CRITICAL: Output a single valid JSON object and NOTHING else.',
    'No markdown fences, no prose before or after, no comments.',
    'The JSON MUST start with { and end with }.',
    'JSON shape: {"title": string, "body_en": string, "body_zh": string}.',
    opts.bilingual
      ? '"body_zh" must be a faithful Chinese translation of "body_en", paragraph-aligned.'
      : '"body_zh" can be an empty string.'
  ].join('\n');
  const user = [
    `Target words: ${wordsLine}.`,
    `Form: ${STYLE_HINT[opts.style]}.`,
    `CEFR level: ${opts.difficulty}.`,
    `Length: ${LENGTH_HINT[opts.length]}.`,
    'Wrap each target word in **double asterisks** in body_en the first time it appears.',
    'Return one JSON object, no other output.'
  ].join('\n');
  return { system, user };
};

const stripJsonFences = (s: string): string => {
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
};

/** 从任意文本里抽第一段看起来是 JSON 对象的片段，容错模型在 JSON 前后加了描述文字。 */
const extractFirstJsonObject = (s: string): string => {
  const cleaned = stripJsonFences(s);
  const start = cleaned.indexOf('{');
  if (start < 0) return cleaned;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return cleaned.slice(start, i + 1);
      }
    }
  }
  return cleaned.slice(start);
};

export const generateStoryText = async (opts: GenerateStoryTextOptions): Promise<GeneratedStoryText> => {
  if (!opts.words.length) throw new Error('请至少选择一个生词');
  const { apiKey, apiUrl } = await resolveAiConfig({ requireApiKey: true });
  const { system, user } = buildPrompt(opts);
  const requestData = {
    model: opts.model || 'step-3.5-flash',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.8,
    max_tokens: 1500,
    stream: true
  };

  return new Promise<GeneratedStoryText>((resolve, reject) => {
    let accumulated = '';
    let unsubscribe: (() => void) | null = null;
    let settled = false;

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      if (unsubscribe) unsubscribe();
      fn();
    };

    (async () => {
      try {
        const result = await ipcClient.performAIStream(requestData, apiUrl, apiKey);
        if (!result || result.success !== true) {
          throw new Error(result?.error || '主进程 AI 流式请求失败');
        }
        const { requestId } = result;

        unsubscribe = ipcClient.onAiStream((...args: unknown[]) => {
          const payload = args[0] as StreamEvent | undefined;
          if (!payload || payload.requestId !== requestId) return;
          if (payload.type === 'delta') {
            accumulated += payload.content || '';
            opts.onProgress?.(accumulated);
          } else if (payload.type === 'complete') {
            finish(() => {
              if (!accumulated) {
                reject(new Error('模型返回为空'));
                return;
              }
              let parsed: { title?: string; body_en?: string; body_zh?: string };
              try {
                parsed = JSON.parse(extractFirstJsonObject(accumulated));
              } catch (e) {
                reject(new Error(`解析模型 JSON 失败: ${(e as Error).message}`));
                return;
              }
              if (!parsed.body_en) {
                reject(new Error('模型未返回 body_en'));
                return;
              }
              resolve({
                title: parsed.title || '',
                bodyEn: parsed.body_en,
                bodyZh: parsed.body_zh || ''
              });
            });
          } else if (payload.type === 'error') {
            finish(() => reject(new Error(payload.message || '流式错误')));
          }
        });
      } catch (error) {
        finish(() => reject(error as Error));
      }
    })();
  });
};

export interface GenerateAudioOptions {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  /** Only honored when model = stepaudio-2.5-tts. */
  instruction?: string;
}

export const generateAudio = async (opts: GenerateAudioOptions): Promise<GenerateTTSResult> => {
  const { apiKey } = await resolveAiConfig({ requireApiKey: true });
  return ipcClient.generateTTS({
    text: opts.text,
    voice: opts.voice || DEFAULT_TTS_VOICE,
    model: opts.model || DEFAULT_TTS_MODEL,
    speed: opts.speed ?? 1.0,
    instruction: opts.instruction,
    apiKey,
    format: 'mp3'
  });
};

export const saveStory = async (payload: SaveStoryPayload): Promise<number | null> => {
  const r = await ipcClient.saveStory(payload);
  if (r.error) throw new Error(r.error);
  return r.id ?? null;
};

export const updateStoryAudio = async (
  id: number,
  audioPath: string,
  audioSize: number,
  voice?: string,
  model?: string
): Promise<void> => {
  const r = await ipcClient.updateStoryAudio({ id, audioPath, audioSize, voice, model });
  if (r.error) throw new Error(r.error);
};

export const listStories = async (limit = 50): Promise<StoryRow[]> => {
  const r = await ipcClient.getStories({ limit });
  if (Array.isArray(r)) return r;
  throw new Error(r.error || '加载历史失败');
};

export const deleteStory = async (id: number): Promise<void> => {
  const r = await ipcClient.deleteStory({ id });
  if (r.error) throw new Error(r.error);
};

export const loadAudioDataUrl = async (filePath: string): Promise<string> => {
  const r = await ipcClient.readAudioFile(filePath);
  if (!r.success || !r.base64) throw new Error(r.error || '读取音频失败');
  return `data:audio/mpeg;base64,${r.base64}`;
};

export const downloadAudio = async (sourcePath: string, suggestedName: string): Promise<string | null> => {
  const r = await ipcClient.downloadStoryFile({
    sourcePath,
    suggestedName,
    mimeFilters: [{ name: 'Audio', extensions: ['mp3'] }]
  });
  if (r.canceled) return null;
  if (!r.success) throw new Error(r.error || '下载失败');
  return r.filePath || null;
};

export const downloadText = async (content: string, suggestedName: string): Promise<string | null> => {
  const r = await ipcClient.downloadStoryFile({
    content,
    suggestedName,
    mimeFilters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
  });
  if (r.canceled) return null;
  if (!r.success) throw new Error(r.error || '下载失败');
  return r.filePath || null;
};
