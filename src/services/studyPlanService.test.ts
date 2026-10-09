/**
 * studyPlanService 单元测试
 *
 * 覆盖两种生成路径：
 *  1. template —— 本地模板，离线可用
 *  2. ai       —— 调用大模型，失败时自动回退模板
 *
 * 运行：CI=true npm test -- --testPathPattern=studyPlanService
 */
jest.mock('./ipcClient', () => ({
  ipcClient: {
    isAvailable: jest.fn(),
    getHighlightsStats: jest.fn(),
    getDueHighlights: jest.fn(),
    getTodayHighlights: jest.fn(),
    saveStudyPlan: jest.fn(),
    performAIRequest: jest.fn()
  }
}));

jest.mock('./aiConfigService', () => ({
  resolveAiConfig: jest.fn()
}));

import { ipcClient } from './ipcClient';
import { resolveAiConfig } from './aiConfigService';
import studyPlanService from './studyPlanService';

const mockIpc = ipcClient as unknown as {
  isAvailable: jest.Mock;
  getHighlightsStats: jest.Mock;
  getDueHighlights: jest.Mock;
  getTodayHighlights: jest.Mock;
  saveStudyPlan: jest.Mock;
  performAIRequest: jest.Mock;
};

const mockResolve = resolveAiConfig as unknown as jest.Mock;

const STATS = {
  totalHighlights: 42,
  pendingHighlights: 12,
  reviewedHighlights: 30,
  archivedHighlights: 0,
  masteredHighlights: 8,
  totalVideos: 3,
  todayReviewed: 5,
  streakDays: 4
};

/** 构造一次成功的主进程 AI 响应 */
const aiOk = (payload: unknown) => ({
  success: true,
  data: { choices: [{ message: { content: JSON.stringify(payload) } }] }
});

const VALID_AI_PAYLOAD = {
  weekly_goal: '7 天内清空到期单词并新增 35 个生词',
  daily_focus: ['Day1 复习', 'Day2 新增', 'Day3 复习', 'Day4 新增', 'Day5 复习', 'Day6 新增', 'Day7 复盘'],
  recommendations: ['优先复习易忘词', '用故事 Tab 巩固'],
  encouragement: '坚持就是胜利'
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIpc.isAvailable.mockReturnValue(true);
  mockIpc.getHighlightsStats.mockResolvedValue(STATS);
  mockIpc.getDueHighlights.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  mockIpc.getTodayHighlights.mockResolvedValue([
    { original_text: 'glimpse' },
    { original_text: 'detailed' },
    { original_text: 'nucleus' }
  ]);
  mockIpc.saveStudyPlan.mockResolvedValue({ success: true });
  mockResolve.mockResolvedValue({ apiKey: 'k', apiUrl: 'https://api.stepfun.com/v1/chat/completions', model: 'step-2-mini', source: { apiKey: 'store', modelUrl: 'store' } });
});

describe('studyPlanService.generateStudyPlan', () => {
  it('template 模式：不调用 AI，返回模板计划并落库', async () => {
    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'template' });

    expect(result.source).toBe('template');
    expect(result.fallbackReason).toBeUndefined();
    expect(result.planText).toContain('学习周期');
    expect(result.planText).toContain('**今日到期**: 3');
    expect(result.plan.source).toBe('template');
    expect(result.plan.days).toBe(7);
    expect(mockIpc.performAIRequest).not.toHaveBeenCalled();
    expect(mockIpc.saveStudyPlan).toHaveBeenCalledTimes(1);
    expect(mockIpc.saveStudyPlan.mock.calls[0][0]).toMatchObject({
      days: 7,
      structuredPlan: expect.objectContaining({ source: 'template', dueCount: 3 })
    });
  });

  it('ai 模式：解析模型 JSON，返回 AI 计划并落库', async () => {
    mockIpc.performAIRequest.mockResolvedValue(aiOk(VALID_AI_PAYLOAD));

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'ai' });

    expect(result.source).toBe('ai');
    expect(result.plan.source).toBe('ai');
    expect(result.plan.model).toBe('step-2-mini');
    expect(result.plan.dailyFocus).toHaveLength(7);
    expect(result.plan.recommendations).toHaveLength(2);
    expect(result.planText).toContain('AI 智能生成');
    expect(result.planText).toContain('周期目标');
    expect(result.planText).toContain('Day 1: Day1 复习');
    expect(result.planText).toContain('坚持就是胜利');
    // 上下文应被采集并传给模型
    const request = mockIpc.performAIRequest.mock.calls[0][0];
    expect(request.model).toBe('step-2-mini');
    expect(request.messages[1].content).toContain('当前到期待复习: 3');
    expect(request.messages[1].content).toContain('glimpse');
    expect(mockIpc.saveStudyPlan).toHaveBeenCalledTimes(1);
  });

  it('ai 模式：模型输出带 markdown 代码围栏时仍能解析', async () => {
    mockIpc.performAIRequest.mockResolvedValue({
      success: true,
      data: { choices: [{ message: { content: '```json\n' + JSON.stringify(VALID_AI_PAYLOAD) + '\n```' } }] }
    });

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'ai' });
    expect(result.source).toBe('ai');
    expect(result.plan.weeklyGoal).toContain('7 天内');
  });

  it('ai 模式：未配置 API Key 时回退模板并给出原因', async () => {
    mockResolve.mockRejectedValue(new Error('未设置API Key'));

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'ai' });

    expect(result.source).toBe('template');
    expect(result.fallbackReason).toContain('未设置API Key');
    expect(result.plan.source).toBe('template');
    expect(mockIpc.performAIRequest).not.toHaveBeenCalled();
  });

  it('ai 模式：模型返回非法 JSON 时回退模板', async () => {
    mockIpc.performAIRequest.mockResolvedValue({ success: true, data: { choices: [{ message: { content: '抱歉，我无法生成。' } }] } });

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'ai' });

    expect(result.source).toBe('template');
    expect(result.fallbackReason).toContain('解析模型 JSON 失败');
    expect(result.planText).toContain('建议行动');
  });

  it('ai 模式：模型返回空内容时回退模板', async () => {
    mockIpc.performAIRequest.mockResolvedValue({ success: true, data: { choices: [{ message: { content: '   ' } }] } });

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'ai' });

    expect(result.source).toBe('template');
    expect(result.fallbackReason).toContain('模型返回为空');
  });

  it('ai 模式：主进程请求失败时回退模板', async () => {
    mockIpc.performAIRequest.mockResolvedValue({ success: false, error: '401 Unauthorized' });

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'ai' });

    expect(result.source).toBe('template');
    expect(result.fallbackReason).toContain('401');
  });

  it('days 会被限制在 1..90 之间', async () => {
    const tooMany = await studyPlanService.generateStudyPlan({ days: 999, source: 'template' });
    expect(tooMany.days).toBe(90);
    expect(tooMany.plan.dailyFocus).toHaveLength(90);

    const tooFew = await studyPlanService.generateStudyPlan({ days: 0, source: 'template' });
    expect(tooFew.days).toBe(1);
  });

  it('AI 返回的 daily_focus 超出 days 时被截断', async () => {
    mockIpc.performAIRequest.mockResolvedValue(
      aiOk({ ...VALID_AI_PAYLOAD, daily_focus: Array.from({ length: 20 }, (_, i) => `focus-${i}`) })
    );

    const result = await studyPlanService.generateStudyPlan({ days: 3, source: 'ai' });

    expect(result.plan.dailyFocus).toHaveLength(3);
    expect(result.planText).toContain('Day 1: focus-0');
    expect(result.planText).not.toContain('Day 4:');
  });

  it('上下文采集失败时仍能生成计划', async () => {
    mockIpc.getHighlightsStats.mockRejectedValue(new Error('db error'));
    mockIpc.getDueHighlights.mockRejectedValue(new Error('db error'));
    mockIpc.getTodayHighlights.mockRejectedValue(new Error('db error'));

    const result = await studyPlanService.generateStudyPlan({ days: 7, source: 'template' });

    expect(result.planText).toContain('**总词数**: 0');
    expect(result.plan.dueCount).toBe(0);
    expect(result.plan.recentWords).toEqual([]);
  });
});
