import { ipcClient } from './ipcClient';

/**
 * 学习计划服务（S6 重写）
 *
 * 数据源统一到 highlights：用 getHighlightsStats 拿统计；
 * 计划是模板生成（无 AI 调用）；保存到 study_plans 表。
 */
class StudyPlanService {
  /**
   * 生成新计划
   * @param {Object} options - { days, focus }
   */
  async generateStudyPlan(options = {}) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API 不可用');
    }

    const days = options.days || 7;
    const focus = options.focus || 'comprehensive';

    let stats = {};
    try {
      const result = await ipcClient.getHighlightsStats();
      if (result && !result.error) stats = result;
    } catch (_) {}

    const total = stats.totalHighlights ?? 0;
    const reviewed = stats.reviewedHighlights ?? 0;
    const mastered = stats.masteredHighlights ?? 0;
    const todayReviewed = stats.todayReviewed ?? 0;
    const streak = stats.streakDays ?? 0;

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

    const structuredPlan = { days, focus, stats };
    const createdAt = new Date().toISOString();

    try {
      await ipcClient.saveStudyPlan({ planData: planText, structuredPlan, days, createdAt });
    } catch (e) {
      console.error('saveStudyPlan 失败:', e);
    }

    return { planText, plan: structuredPlan, days, createdAt };
  }

  async getCurrentStudyPlan() {
    if (!ipcClient.isAvailable()) throw new Error('Electron API 不可用');
    try {
      return await ipcClient.getCurrentStudyPlan();
    } catch (error) {
      console.error('getCurrentStudyPlan 失败:', error);
      throw error;
    }
  }

  async updatePlanProgress(progress) {
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
