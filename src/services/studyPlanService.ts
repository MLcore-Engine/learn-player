/**
 * 学习计划服务（S6 重写版）
 *
 * 数据源统一到 highlights：用 getHighlightsStats 拿统计；
 * 计划是模板生成（无 AI 调用）；保存到 study_plans 表。
 */
import { ipcClient } from './ipcClient';
import type {
  GenerateStudyPlanOptions,
  GenerateStudyPlanResult,
  StructuredPlan,
  StudyPlanRow,
  SaveStudyPlanPayload
} from '../types/plan';
import type { HighlightsStats } from '../types/highlight';

class StudyPlanService {
  async generateStudyPlan(options: GenerateStudyPlanOptions = {}): Promise<GenerateStudyPlanResult> {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API 不可用');
    }

    const days = options.days ?? 7;
    const focus = options.focus ?? 'comprehensive';

    let stats: HighlightsStats | Record<string, never> = {};
    try {
      const result = await ipcClient.getHighlightsStats();
      if (result && !result.error) stats = result;
    } catch {
      /* ignore */
    }

    const statsRef = stats as Partial<HighlightsStats>;
    const total = statsRef.totalHighlights ?? 0;
    const reviewed = statsRef.reviewedHighlights ?? 0;
    const mastered = statsRef.masteredHighlights ?? 0;
    const todayReviewed = statsRef.todayReviewed ?? 0;
    const streak = statsRef.streakDays ?? 0;

    const lines = [
      `**学习周期**: ${days} 天`,
      `**学习重点**: ${focus}`,
      `**总词数**: ${total}`,
      `**已复习**: ${reviewed}`,
      `**已掌握**: ${mastered}`,
      `**今日已复习**: ${todayReviewed}`,
      `**连续天数**: ${streak}`,
      '',
      '**建议行动**',
      '- 每日打开"复习"Tab 完成到期单词',
      '- 保持每天至少新增 5-10 个生词',
      '- 一周内完成连续复习以提升记忆曲线'
    ];
    const planText = lines.join('\n');

    const structuredPlan: StructuredPlan = { days, focus, stats };
    const createdAt = new Date().toISOString();

    try {
      const payload: SaveStudyPlanPayload = { planData: planText, structuredPlan, days, createdAt };
      await ipcClient.saveStudyPlan(payload);
    } catch (e) {
      console.error('saveStudyPlan 失败:', e);
    }

    return { planText, plan: structuredPlan, days, createdAt };
  }

  async getCurrentStudyPlan(): Promise<StudyPlanRow | null> {
    if (!ipcClient.isAvailable()) throw new Error('Electron API 不可用');
    try {
      return await ipcClient.getCurrentStudyPlan();
    } catch (error) {
      console.error('getCurrentStudyPlan 失败:', error);
      throw error;
    }
  }

  async updatePlanProgress(progress: { progress: number }): Promise<{ success?: boolean; error?: string }> {
    if (!ipcClient.isAvailable()) throw new Error('Electron API 不可用');
    try {
      return await ipcClient.updatePlanProgress(progress);
    } catch (error) {
      console.error('updatePlanProgress 失败:', error);
      throw error;
    }
  }
}

const studyPlanService = new StudyPlanService();
export default studyPlanService;
