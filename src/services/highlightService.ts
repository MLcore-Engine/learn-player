/**
 * highlightService.ts - 统一高亮服务
 * 封装所有 highlights 相关的 IPC 调用
 */
import { ipcClient } from './ipcClient';
import type {
  Highlight,
  CreateHighlightInput,
  CreateHighlightResult,
  GetHighlightsOptions,
  GetDueHighlightsOptions,
  SubmitReviewResult,
  ReviewQuality
} from '../types/highlight';

type ErrorResult = { error: string };
type HighlightListResult = Highlight[] | ErrorResult;
type HighlightResult = Highlight | ErrorResult;

export async function createHighlight(
  highlightData: CreateHighlightInput
): Promise<CreateHighlightResult> {
  try {
    return await ipcClient.createHighlight(highlightData);
  } catch (error) {
    console.error('createHighlight error:', error);
    return { error: (error as Error).message };
  }
}

export async function getHighlights({
  videoPath,
  status,
  limit = 50,
  offset = 0
}: GetHighlightsOptions = {}): Promise<HighlightListResult> {
  try {
    return await ipcClient.getHighlights({ videoPath, status, limit, offset });
  } catch (error) {
    console.error('getHighlights error:', error);
    return { error: (error as Error).message };
  }
}

export async function getHighlight(id: string): Promise<HighlightResult> {
  try {
    return await ipcClient.getHighlight({ id });
  } catch (error) {
    console.error('getHighlight error:', error);
    return { error: (error as Error).message };
  }
}

/**
 * 按 (videoPath, text) 精确查找已有讲解。
 *
 * highlights 的 UNIQUE(video_path, original_text) 保证同一视频下同一文本只有一行，
 * 因此命中即可直接复用 explanation，不必再打一次 LLM。
 * 任何失败都返回 null（缓存未命中），由调用方继续走正常 AI 流程。
 */
export async function findCachedExplanation(
  videoPath: string,
  text: string
): Promise<string | null> {
  if (!text || !text.trim()) return null;
  try {
    const r = await ipcClient.findHighlight({ videoPath: videoPath || '', text });
    if (!r || 'error' in r) return null;
    const explanation = (r as Highlight).explanation;
    return explanation && explanation.trim() ? explanation : null;
  } catch (error) {
    console.error('findCachedExplanation error:', error);
    return null;
  }
}

export interface UpdateHighlightInput extends Partial<Highlight> {
  id: string;
}

export async function updateHighlight({
  id,
  ...fields
}: UpdateHighlightInput): Promise<{ success?: boolean; error?: string }> {
  try {
    return await ipcClient.updateHighlight({ id, ...fields });
  } catch (error) {
    console.error('updateHighlight error:', error);
    return { error: (error as Error).message };
  }
}

export async function deleteHighlight(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    return await ipcClient.deleteHighlight({ id });
  } catch (error) {
    console.error('deleteHighlight error:', error);
    return { error: (error as Error).message };
  }
}

export async function getDueHighlights({
  limit = 20,
  status,
  excludeStatus
}: GetDueHighlightsOptions = {}): Promise<HighlightListResult> {
  try {
    return await ipcClient.getDueHighlights({ limit, status, excludeStatus });
  } catch (error) {
    console.error('getDueHighlights error:', error);
    return { error: (error as Error).message };
  }
}

export async function submitReview(
  id: string,
  quality: ReviewQuality
): Promise<SubmitReviewResult> {
  try {
    return await ipcClient.submitReview({ id, quality });
  } catch (error) {
    console.error('submitReview error:', error);
    return { error: (error as Error).message };
  }
}
