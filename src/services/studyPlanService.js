import { ipcClient } from './ipcClient';

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
      const analytics = await ipcClient.getLearningOverview();
      const pattern = await ipcClient.analyzeLearningPattern();
      const wordStats = await ipcClient.getWordFrequencyStats({ limit: 20 });

      const plan = {
        analytics,
        pattern,
        wordStats,
        ...options
      };

      await ipcClient.saveStudyPlan({
        plan,
        createdAt: new Date().toISOString()
      });

      return plan;
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

export default new StudyPlanService();
