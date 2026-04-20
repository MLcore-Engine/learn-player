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

    try {
      const analytics = await learningAnalyticsService.getLearningOverview();
      const pattern = await ipcClient.analyzeLearningPattern();
      const wordStats = await ipcClient.getWordFrequencyStats({ limit: 20 });

      const structuredPlan = {
        analytics,
        pattern,
        wordStats,
        ...options
      };

      const planText = [
        `**学习周期**: ${options.days || 7} 天`,
        `**学习重点**: ${options.focus || 'comprehensive'}`,
        `**总高亮数**: ${analytics?.totalHighlights || 0}`,
        `**已复习数**: ${analytics?.reviewedHighlights || 0}`,
        `**待处理数**: ${analytics?.pendingHighlights || 0}`,
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
    } catch (error) {
      console.error('生成学习计划失败:', error);
      throw error;
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
