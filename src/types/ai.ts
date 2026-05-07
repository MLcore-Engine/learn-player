/**
 * AI 服务相关类型。
 * 对应 src/services/aiService.js 的 getExplanation / streamExplanation 接口。
 */
import type { Language } from './highlight';

/** AI 配置解析结果 */
export interface AiConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

/** 解释请求的附加上下文 */
export interface ExplanationOptions {
  language?: Language;
  videoPath?: string;
  currentTime?: number | null;
}

/** 流式解释的 handler 回调 */
export interface StreamHandlers {
  onDelta?: (piece: string, full: string) => void;
  onDone?: (fullText: string, meta?: unknown) => void;
  onError?: (error: unknown) => void;
}

/** 保存 AI 查询的 payload —— 历史遗留，ai_queries 表已废弃但形态保留 */
export interface SaveAiQueryPayload {
  query: string;
  explanation: string;
  timestamp: string;
}
