/**
 * 学习分析服务
 * 分析用户的学习数据，包括学习时长、单词查询频率、学习进度等
 */

class LearningAnalyticsService {
  /**
   * 获取用户学习概况
   * @param {Function} electronAPI - Electron API 函数
   * @returns {Promise<Object>} 学习概况数据
   */
  async getLearningOverview(electronAPI) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const overview = await electronAPI.invoke('getLearningOverview');
      return overview;
    } catch (error) {
      console.error('获取学习概况失败:', error);
      throw error;
    }
  }

  /**
   * 分析用户学习模式
   * @param {Function} electronAPI - Electron API 函数
   * @returns {Promise<Object>} 学习模式分析结果
   */
  async analyzeLearningPattern(electronAPI) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const pattern = await electronAPI.invoke('analyzeLearningPattern');
      return pattern;
    } catch (error) {
      console.error('分析学习模式失败:', error);
      throw error;
    }
  }

  /**
   * 获取学习统计报告
   * @param {Function} electronAPI - Electron API 函数
   * @param {Object} options - 选项 { days: 7, includeDetails: true }
   * @returns {Promise<Object>} 统计报告
   */
  async getLearningReport(electronAPI, options = {}) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const report = await electronAPI.invoke('getLearningReport', options);
      return report;
    } catch (error) {
      console.error('获取学习报告失败:', error);
      throw error;
    }
  }

  /**
   * 获取单词学习频率统计
   * @param {Function} electronAPI - Electron API 函数
   * @param {number} limit - 返回单词数量限制
   * @returns {Promise<Array>} 单词频率列表
   */
  async getWordFrequencyStats(electronAPI, limit = 50) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const stats = await electronAPI.invoke('getWordFrequencyStats', { limit });
      return stats;
    } catch (error) {
      console.error('获取单词频率统计失败:', error);
      throw error;
    }
  }
}

export default new LearningAnalyticsService();
