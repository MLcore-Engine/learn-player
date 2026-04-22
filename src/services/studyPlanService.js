import { ipcClient } from './ipcClient';
import learningAnalyticsService from './learningAnalyticsService';

/**
 * 学习计划服务
 * 负责生成和管理学习计划
 */

class StudyPlanService {
  /**
   * 生成学习计划
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 生成的学习计划
   */
  async generateStudyPlan(options = {}) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    // 并行获取所有数据，个别失败不影响整体
    const [analyticsResult, patternResult, wordStatsResult] = await Promise.allSettled([
      learningAnalyticsService.getLearningOverview(),
      this._safeAnalyzeLearningPattern(),
      this._safeGetWordFrequencyStats(20)
    ]);

    // 提取成功的结果，失败时使用空对象
    const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : {};
    const pattern = patternResult.status === 'fulfilled' ? patternResult.value : {};
    const wordStats = wordStatsResult.status === 'fulfilled' ? wordStatsResult.value : [];

    // 处理 pattern 和 wordStats 可能返回的 error 对象
    const safePattern = pattern?.error ? {} : pattern;
    const safeWordStats = Array.isArray(wordStats) ? wordStats : [];

    const structuredPlan = {
      analytics,
      pattern: safePattern,
      wordStats: safeWordStats,
      ...options
    };

    const planText = [
      `**学习周期**: ${options.days || 7} 天`,
      `**学习重点**: ${options.focus || 'comprehensive'}`,
      `**总高亮数**: ${analytics?.totalHighlights || 0}`,
      `**已复习数**: ${analytics?.reviewedCount || 0}`,
      `**待处理数**: ${analytics?.pendingCount || 0}`,
      `**复习率**: ${analytics?.reviewRate || 0}%`,
      '',
      '**建议行动**',
      '- 优先复习已到期或未复习的高亮',
      '- 结合高频词结果安排每日复习任务',
      '- 先完成当天复习，再继续新增高亮'
    ].join('\n');

    await ipcClient.saveStudyPlan({
      planData: planText,
      structuredPlan,
      days: options.days || 7,
      createdAt: new Date().toISOString()
    });

    return {
      planText,
      plan: structuredPlan,
      days: options.days || 7,
      createdAt: new Date().toISOString()
    };
  }

  // 安全调用 analyzeLearningPattern，失败时返回空对象
  async _safeAnalyzeLearningPattern() {
    try {
      const result = await ipcClient.analyzeLearningPattern();
      if (result?.error) return {};
      return result;
    } catch {
      return {};
    }
  }

  // 安全调用 getWordFrequencyStats，失败时返回空数组
  async _safeGetWordFrequencyStats(limit) {
    try {
      const result = await ipcClient.getWordFrequencyStats({ limit });
      if (result?.error) return [];
      return result;
    } catch {
      return [];
    }
  }

  /**
   * 获取当前学习计划
   * @returns {Promise<Object>} 当前计划
   */
  async getCurrentStudyPlan() {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const plan = await ipcClient.getCurrentStudyPlan();
      return plan;
    } catch (error) {
      console.error('获取学习计划失败:', error);
      throw error;
    }
  }

  /**
   * 更新计划进度
   * @param {Object} progress - 进度数据
   * @returns {Promise<Object>} 更新结果
   */
  async updatePlanProgress(progress) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const result = await ipcClient.updatePlanProgress(progress);
      return result;
    } catch (error) {
      console.error('更新学习计划进度失败:', error);
      throw error;
    }
  }
}

const studyPlanService = new StudyPlanService();
export default studyPlanService;
