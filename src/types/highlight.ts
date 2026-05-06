/**
 * Highlight 是学习对象的单一数据模型。
 * 对应 DB 表 highlights（见 main.js S1 CREATE TABLE）和 main/ipc/index.js 的 createHighlight handler。
 */

export type HighlightStatus = 'learning' | 'mastered' | 'archived' | 'pending' | 'reviewed';

export type Language = 'zh' | 'en';

export interface Highlight {
  id: string;
  video_path: string;
  video_title: string | null;
  start_time: number | null;
  end_time: number | null;
  original_text: string;
  context_before: string | null;
  context_after: string | null;
  explanation: string | null;
  user_note: string | null;
  language: Language | null;
  status: HighlightStatus;
  ease: number;
  interval: number;
  repetitions: number;
  next_review: string | null;
  last_review: string | null;
  query_count: number;
  last_queried_at: string | null;
  created_at: string;
  updated_at: string;
}

/** createHighlight 入参：所有字段可选（后端会填默认值和 UUID） */
export interface CreateHighlightInput {
  video_path?: string;
  video_title?: string | null;
  start_time?: number | null;
  end_time?: number | null;
  original_text: string;
  context_before?: string | null;
  context_after?: string | null;
  explanation?: string | null;
  user_note?: string | null;
  language?: Language | null;
  status?: HighlightStatus;
  ease?: number;
  interval?: number;
  repetitions?: number;
  next_review?: string | null;
  last_review?: string | null;
}

export interface CreateHighlightResult {
  success?: true;
  id?: string;
  highlight?: Highlight;
  error?: string;
}

export interface GetHighlightsOptions {
  videoPath?: string;
  status?: HighlightStatus;
  limit?: number;
  offset?: number;
}

export interface GetDueHighlightsOptions {
  limit?: number;
  status?: HighlightStatus;
}

/** SM-2 复习结果评分 0-3 */
export type ReviewQuality = 0 | 1 | 2 | 3;

export interface SubmitReviewOptions {
  id: string;
  quality: ReviewQuality;
}

export interface SubmitReviewResult {
  success?: true;
  srs_data?: {
    ease: number;
    interval: number;
    repetitions: number;
    next_review: string | null;
  };
  error?: string;
}

/** 对应 getHighlightsStats handler 返回形态 */
export interface HighlightsStats {
  totalHighlights: number;
  pendingHighlights: number;
  reviewedHighlights: number;
  archivedHighlights: number;
  masteredHighlights: number;
  totalVideos: number;
  todayReviewed: number;
  streakDays: number;
  error?: string;
}

/** 对应 getHighlightsDailyCount handler 返回形态 */
export interface HighlightDailyCount {
  date: string;  // YYYY-MM-DD
  count: number;
}
