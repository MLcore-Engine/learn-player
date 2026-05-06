/**
 * 学习计划类型。
 * 对应 DB 表 study_plans 和 main/ipc/index.js saveStudyPlan/getCurrentStudyPlan handlers。
 */
import type { HighlightsStats } from './highlight';

export type PlanStatus = 'active' | 'completed';

/** 结构化计划体，JSON 存在 study_plans.structured_plan 字段 */
export interface StructuredPlan {
  days: number;
  focus: string;
  stats: HighlightsStats | Record<string, never>;
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
}

export interface GenerateStudyPlanResult {
  planText: string;
  plan: StructuredPlan;
  days: number;
  createdAt: string;
}

export interface SaveStudyPlanPayload {
  planData: string;
  structuredPlan: StructuredPlan;
  days: number;
  createdAt: string;
}
