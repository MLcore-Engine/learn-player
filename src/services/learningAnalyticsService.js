import { ipcClient } from './ipcClient';

/**
 * 学习分析服务
 * 分析用户的学习数据，包括学习时长、单词查询频率、学习进度等
 */

class LearningAnalyticsService {
  /**
   * 获取用户学习概况
   * @returns {Promise<Object>} 学习概况数据
   */
  async getLearningOverview() {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const overview = await ipcClient.getLearningOverview();
      return overview;
    } catch (error) {
      console.error('获取学习概况失败:', error);
      throw error;
    }
  }

  /**
   * 分析用户学习模式
   * @returns {Promise<Object>} 学习模式分析结果
   */
  async analyzeLearningPattern() {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const pattern = await ipcClient.analyzeLearningPattern();
      return pattern;
    } catch (error) {
      console.error('分析学习模式失败:', error);
      throw error;
    }
  }

  /**
   * 获取学习统计报告
   * @param {Object} options - 选项 { days: 7, includeDetails: true }
   * @returns {Promise<Object>} 统计报告
   */
  async getLearningReport(options = {}) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const report = await ipcClient.getLearningReport(options);
      return report;
    } catch (error) {
      console.error('获取学习报告失败:', error);
      throw error;
    }
  }

  /**
   * 获取单词学习频率统计
   * @param {number} limit - 返回单词数量限制
   * @returns {Promise<Array>} 单词频率列表
   */
  async getWordFrequencyStats(limit = 50) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const stats = await ipcClient.getWordFrequencyStats({ limit });
      return stats;
    } catch (error) {
      console.error('获取单词频率统计失败:', error);
      throw error;
    }
  }
}

const learningAnalyticsService = new LearningAnalyticsService();
export default learningAnalyticsService;
