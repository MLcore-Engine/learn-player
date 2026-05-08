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
}

export interface GeneratedStoryText {
  title: string;
  bodyEn: string;
  bodyZh: string;
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
    'Output strictly valid JSON, no markdown fences, no commentary.',
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
    'Return JSON only.'
  ].join('\n');
  return { system, user };
};

const stripJsonFences = (s: string): string => {
  const trimmed = s.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
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
    stream: false,
    response_format: { type: 'json_object' }
  };
  const result = await ipcClient.performAIRequest(requestData, apiUrl, apiKey);
  if (!result.success) throw new Error(result.error || '生成故事失败');
  const data = result.data as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('模型返回为空');
  let parsed: { title?: string; body_en?: string; body_zh?: string };
  try {
    parsed = JSON.parse(stripJsonFences(content));
  } catch (e) {
    throw new Error(`解析模型 JSON 失败: ${(e as Error).message}`);
  }
  if (!parsed.body_en) throw new Error('模型未返回 body_en');
  return {
    title: parsed.title || '',
    bodyEn: parsed.body_en,
    bodyZh: parsed.body_zh || ''
  };
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
