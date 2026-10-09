/**
 * 学习计划类型。
 * 对应 DB 表 study_plans 和 main/ipc/index.js saveStudyPlan/getCurrentStudyPlan handlers。
 */
import type { HighlightsStats } from './highlight';

export type PlanStatus = 'active' | 'completed';

/** 计划生成方式：ai = 大模型生成，template = 本地模板 */
export type PlanSource = 'ai' | 'template';

/** 结构化计划体，JSON 存在 study_plans.structured_plan 字段 */
export interface StructuredPlan {
  days: number;
  focus: string;
  stats: Partial<HighlightsStats> | Record<string, never>;
  /** 生成方式。旧数据没有该字段时按 template 处理 */
  source?: PlanSource;
  /** AI 生成时实际使用的模型 */
  model?: string;
  /** AI 生成的周期总目标 */
  weeklyGoal?: string;
  /** AI 生成的每日重点（长度 = days） */
  dailyFocus?: string[];
  /** AI 生成的专项建议 */
  recommendations?: string[];
  /** 生成时到期的复习数量 */
  dueCount?: number;
  /** 生成时最近学过的单词样本 */
  recentWords?: string[];
}

/** getCurrentStudyPlan 返回（JOIN 后展开 structuredPlan） */
export interface StudyPlanRow {
  id: number;
  plan_data: string;
  structured_plan: string | null;  // JSON string
  structuredPlan?: StructuredPlan | null;  // frontend 解析后字段
  days: number;
  status: PlanStatus;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateStudyPlanOptions {
  days?: number;
  focus?: string;
  /** ai = 强制 AI 生成（失败时回退模板）；template = 只用本地模板 */
  source?: PlanSource;
  /** 指定模型，默认走 aiConfigService 解析出的模型 */
  model?: string;
}

export interface GenerateStudyPlanResult {
  planText: string;
  plan: StructuredPlan;
  days: number;
  createdAt: string;
  /** 实际使用的生成方式 */
  source: PlanSource;
  /** 当请求了 AI 但回退到模板时的原因 */
  fallbackReason?: string;
}

export interface SaveStudyPlanPayload {
  planData: string;
  structuredPlan: StructuredPlan;
  days: number;
  createdAt: string;
}
