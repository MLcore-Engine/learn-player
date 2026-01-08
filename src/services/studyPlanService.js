import aiService from '../utils/aiService';

/**
 * 学习计划服务
 * 使用大模型生成个性化学习计划
 */

class StudyPlanService {
  /**
   * 生成学习计划
   * @param {Function} electronAPI - Electron API 函数
   * @param {Object} options - 选项 { days: 7, focus: 'vocabulary' }
   * @returns {Promise<Object>} 学习计划
   */
  async generateStudyPlan(electronAPI, options = {}) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      // 先获取学习分析数据
      const analytics = await electronAPI.invoke('getLearningOverview');
      const pattern = await electronAPI.invoke('analyzeLearningPattern');
      const wordStats = await electronAPI.invoke('getWordFrequencyStats', { limit: 20 });

      // 构建提示词
      const prompt = this.buildStudyPlanPrompt(analytics, pattern, wordStats, options);

      // 调用AI生成学习计划
      const planText = await aiService.getExplanation(prompt, { language: 'zh' });

      // 解析学习计划（尝试提取结构化数据）
      const plan = this.parseStudyPlan(planText, options);

      // 保存学习计划到数据库
      await electronAPI.invoke('saveStudyPlan', {
        planData: planText,
        structuredPlan: plan,
        days: options.days || 7,
        createdAt: new Date().toISOString()
      });

      return { planText, plan };
    } catch (error) {
      console.error('生成学习计划失败:', error);
      throw error;
    }
  }

  /**
   * 构建学习计划提示词
   */
  buildStudyPlanPrompt(analytics, pattern, wordStats, options) {
    const days = options.days || 7;
    const focus = options.focus || 'comprehensive';

    return `你是一位专业的英语学习规划师。请根据以下学习数据，为用户制定一个${days}天的个性化英语学习计划。

## 用户学习概况：
- 总学习时长：${Math.floor(analytics.totalTime / 3600)}小时${Math.floor((analytics.totalTime % 3600) / 60)}分钟
- 总查询单词数：${analytics.totalQueries}个
- 学习天数：${analytics.activeDays}天
- 平均每日学习时长：${Math.floor(analytics.avgDailyTime / 60)}分钟

## 学习模式分析：
- 最活跃时段：${pattern.mostActiveHour || '不明确'}
- 学习频率：${pattern.frequency || '不明确'}
- 最近学习趋势：${pattern.recentTrend || '不明确'}

## 高频学习单词（前10个）：
${wordStats.slice(0, 10).map((w, i) => `${i + 1}. ${w.word} (查询${w.count}次)`).join('\n')}

## 学习重点：
${focus === 'vocabulary' ? '重点提升词汇量' : focus === 'listening' ? '重点提升听力理解' : '全面提升英语能力'}

请制定一个详细的学习计划，包括：
1. **每日学习目标**：具体的学习任务和目标
2. **单词学习计划**：每天学习的新单词和复习的旧单词
3. **视频学习计划**：推荐的视频学习内容
4. **复习安排**：如何安排复习时间
5. **学习建议**：个性化的学习建议和注意事项

请使用清晰的结构和格式，便于用户理解和执行。`;
  }

  /**
   * 解析学习计划文本，提取结构化数据
   */
  parseStudyPlan(planText, options) {
    // 简单的解析逻辑，可以从计划文本中提取结构化信息
    // 更复杂的解析可以使用正则表达式或AI辅助解析
    const plan = {
      days: options.days || 7,
      focus: options.focus || 'comprehensive',
      dailyGoals: [],
      wordPlan: [],
      videoPlan: [],
      reviewSchedule: []
    };

    // 尝试提取每日目标
    const dailyGoalsMatch = planText.match(/每日学习目标[：:]\s*([^]+?)(?=\d+\.|单词学习|视频学习|复习安排|学习建议|$)/s);
    if (dailyGoalsMatch) {
      plan.dailyGoals = dailyGoalsMatch[1].split('\n').filter(line => line.trim());
    }

    // 尝试提取单词计划
    const wordPlanMatch = planText.match(/单词学习计划[：:]\s*([^]+?)(?=\d+\.|视频学习|复习安排|学习建议|$)/s);
    if (wordPlanMatch) {
      plan.wordPlan = wordPlanMatch[1].split('\n').filter(line => line.trim());
    }

    return plan;
  }

  /**
   * 获取当前学习计划
   * @param {Function} electronAPI - Electron API 函数
   * @returns {Promise<Object>} 当前学习计划
   */
  async getCurrentStudyPlan(electronAPI) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const plan = await electronAPI.invoke('getCurrentStudyPlan');
      return plan;
    } catch (error) {
      console.error('获取学习计划失败:', error);
      throw error;
    }
  }

  /**
   * 更新学习计划进度
   * @param {Function} electronAPI - Electron API 函数
   * @param {Object} progress - 进度数据
   * @returns {Promise<boolean>} 是否成功
   */
  async updatePlanProgress(electronAPI, progress) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const result = await electronAPI.invoke('updatePlanProgress', progress);
      return result;
    } catch (error) {
      console.error('更新学习计划进度失败:', error);
      throw error;
    }
  }
}

export default new StudyPlanService();
