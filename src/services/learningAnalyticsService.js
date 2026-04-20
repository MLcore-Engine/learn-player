import { ipcClient } from './ipcClient';
import { getHighlights } from './highlightService';

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
      // 统计总高亮数
      const allHighlights = await getHighlights({ limit: 10000 });
      if (allHighlights.error) {
        throw new Error(allHighlights.error);
      }
      // reviewed 数量
      const reviewedHighlights = allHighlights.filter(h => h.status !== 'pending');
      // pending 数量
      const pendingHighlights = allHighlights.filter(h => h.status === 'pending');
      // 计算复习率
      const reviewRate = allHighlights.length > 0
        ? Math.round((reviewedHighlights.length / allHighlights.length) * 100)
        : 0;

      return {
        totalHighlights: allHighlights.length,
        reviewedCount: reviewedHighlights.length,
        pendingCount: pendingHighlights.length,
        reviewRate
      };
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
      const allHighlights = await getHighlights({ limit: 1000 });
      if (allHighlights.error) {
        throw new Error(allHighlights.error);
      }

      // 聚合学习报告数据
      const report = {
        totalHighlights: allHighlights.length,
        byStatus: {},
        byVideo: {}
      };

      for (const h of allHighlights) {
        // by status
        report.byStatus[h.status] = (report.byStatus[h.status] || 0) + 1;
        // by video
        if (h.video_path) {
          report.byVideo[h.video_path] = (report.byVideo[h.video_path] || 0) + 1;
        }
      }

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
      const allHighlights = await getHighlights({ limit: 500 });
      if (allHighlights.error) {
        throw new Error(allHighlights.error);
      }

      // 在 JS 侧聚合词频
      const wordFreq = {};
      for (const h of allHighlights) {
        if (h.original_text) {
          const words = h.original_text.toLowerCase().split(/\s+/);
          for (const word of words) {
            if (word.length > 2) {
              wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
          }
        }
      }

      // 排序并返回 top N
      const sorted = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word, count]) => ({ word, count }));

      return sorted;
    } catch (error) {
      console.error('获取单词频率统计失败:', error);
      throw error;
    }
  }
}

const learningAnalyticsService = new LearningAnalyticsService();
export default learningAnalyticsService;
