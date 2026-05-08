export type StoryStyle = 'short_story' | 'dialogue' | 'scene';
export type StoryDifficulty = 'A2' | 'B1' | 'B2';
export type StoryLength = 'short' | 'medium' | 'long';

export interface StoryRow {
  id: number;
  title: string | null;
  body_en: string;
  body_zh: string | null;
  vocab_words: string[];
  style: string | null;
  difficulty: string | null;
  /** TTS 模型（转语音时用的） */
  model: string | null;
  /** 对话/文本模型（生成故事文本时用的） */
  chat_model: string | null;
  voice: string | null;
  audio_path: string | null;
  audio_size: number | null;
  created_at: string;
}

export interface GenerateTTSPayload {
  text: string;
  voice?: string;
  model?: string;
  apiKey: string;
  format?: 'mp3' | 'wav' | 'flac' | 'opus';
  speed?: number;
  /** Only used by stepaudio-2.5-tts. ≤200 chars guidance string. */
  instruction?: string;
}

export interface GenerateTTSResult {
  success: boolean;
  filePath?: string;
  size?: number;
  format?: string;
  error?: string;
}

export interface ReadAudioFileResult {
  success: boolean;
  base64?: string;
  size?: number;
  error?: string;
}

export interface SaveStoryPayload {
  title?: string;
  bodyEn: string;
  bodyZh?: string;
  vocabWords?: string[];
  style?: string;
  difficulty?: string;
  /** TTS 模型 */
  model?: string;
  /** 对话/文本模型 */
  chatModel?: string;
  voice?: string;
  audioPath?: string | null;
  audioSize?: number | null;
}

export interface SaveStoryResult {
  success?: boolean;
  id?: number;
  error?: string;
}

export interface UpdateStoryAudioPayload {
  id: number;
  audioPath: string;
  audioSize: number;
  voice?: string;
  model?: string;
}

export interface DownloadStoryFilePayload {
  suggestedName: string;
  content?: string;
  sourcePath?: string;
  mimeFilters?: Array<{ name: string; extensions: string[] }>;
}

export interface DownloadStoryFileResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

/** StepFun TTS voices — IDs verified against the official voice list. */
export type EnglishFitness = 'best' | 'good' | 'ok';

export interface VoiceOption {
  id: string;
  label: string;
  language: 'zh' | 'en' | 'mixed';
  /** 主观英文朗读清晰度等级，用于 UI 给学习者参考。 */
  englishFitness: EnglishFitness;
  /** 短描述，作为 UI 的一行注释。 */
  hint?: string;
}

/** 排序原则：英文朗读清晰度 best → good → ok。 */
export const STEP_TTS_VOICES: VoiceOption[] = [
  { id: 'boyinnansheng', label: '播音男声', language: 'mixed', englishFitness: 'best', hint: '英文优 · 新闻播报腔，元音清晰' },
  { id: 'jingdiannvsheng', label: '经典女声', language: 'mixed', englishFitness: 'best', hint: '英文优 · 节奏稳，配听力材料佳' },
  { id: 'ruyananshi', label: '儒雅男士', language: 'mixed', englishFitness: 'good', hint: '英文较好 · 慢速，字正腔圆' },
  { id: 'youyanvsheng', label: '优雅女声', language: 'mixed', englishFitness: 'good', hint: '英文较好 · 适合双人对话女角' },
  { id: 'zhengpaiqingnian', label: '正派青年', language: 'mixed', englishFitness: 'good', hint: '英文较好 · 年轻男生，连读自然' },
  { id: 'shenchennanyin', label: '深沉男音', language: 'mixed', englishFitness: 'ok', hint: '英文一般 · 低音磁性，更适合中文' },
  { id: 'cixingnansheng', label: '磁性男声', language: 'mixed', englishFitness: 'ok', hint: '英文一般 · 角色化磁性' },
  { id: 'wenrounvsheng', label: '温柔女声', language: 'mixed', englishFitness: 'ok', hint: '英文一般 · 偏柔' },
  { id: 'qinqienvsheng', label: '亲切女声', language: 'mixed', englishFitness: 'ok' },
  { id: 'linjiajiejie', label: '邻家姐姐', language: 'mixed', englishFitness: 'ok' },
  { id: 'qingchunshaonv', label: '清纯少女', language: 'mixed', englishFitness: 'ok' }
];

export interface ModelOption {
  id: string;
  label: string;
  hint?: string;
  supportsInstruction?: boolean;
}

/** StepFun 对话/文本生成模型 — 用来生成故事文本（与 TTS 模型无关）。 */
export const STEP_CHAT_MODELS: ModelOption[] = [
  { id: 'step-3.5-flash', label: 'step-3.5-flash', hint: '默认 · 快且质量好，适合短/中故事' },
  { id: 'step-2-mini', label: 'step-2-mini', hint: '更便宜、速度更快，质量略低' },
  { id: 'step-2-16k', label: 'step-2-16k', hint: '更长上下文，适合长故事/多轮对话' },
  { id: 'step-1-8k', label: 'step-1-8k', hint: '稳定但较旧' }
];

/** StepFun TTS 模型 — 用来把文本转语音（与对话模型无关）。 */
export const STEP_TTS_MODELS: ModelOption[] = [
  { id: 'step-tts-mini', label: 'step-tts-mini', hint: '轻量、快速、便宜（默认）' },
  { id: 'step-tts-2', label: 'step-tts-2', hint: '英文重音/连读更接近母语，质量更高' },
  { id: 'stepaudio-2.5-tts', label: 'stepaudio-2.5-tts', hint: '支持 instruction 文本指令，可控更细', supportsInstruction: true }
];

export const DEFAULT_CHAT_MODEL = 'step-3.5-flash';
export const DEFAULT_TTS_VOICE = 'boyinnansheng';
export const DEFAULT_TTS_MODEL = 'step-tts-mini';
export const DEFAULT_INSTRUCTION = 'Speak in a clear, neutral American English accent with natural intonation.';
