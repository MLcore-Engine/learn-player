/**
 * 学习计划服务（S7 版）
 *
 * 数据源统一到 highlights：用 getHighlightsStats / getDueHighlights / getTodayHighlights
 * 收集学习上下文；支持两种生成方式：
 *   - ai      ：调用 StepFun 大模型生成个性化计划（JSON 输出，失败自动回退模板）
 *   - template：纯本地模板生成（无需 API Key，离线可用）
 * 结果统一保存到 study_plans 表。
 */
import { ipcClient } from './ipcClient';
import { resolveAiConfig } from './aiConfigService';
import type {
  GenerateStudyPlanOptions,
  GenerateStudyPlanResult,
  PlanSource,
  StructuredPlan,
  StudyPlanRow,
  SaveStudyPlanPayload
} from '../types/plan';
import type { Highlight, HighlightsStats } from '../types/highlight';

interface ChatCompletionResponse {
  message?: { content?: string };
  choices?: { message?: { content?: string } }[];
}

/** AI 计划的结构化输出（模型返回的 JSON 形态） */
interface AiPlanPayload {
  weekly_goal?: string;
  daily_focus?: string[];
  recommendations?: string[];
  encouragement?: string;
}

const FOCUS_LABEL: Record<string, string> = {
  comprehensive: '综合提升',
  vocabulary: '词汇积累',
  listening: '听力理解',
  review: '复习巩固'
};

const DEFAULT_MODEL = 'step-2-mini';

class StudyPlanService {
  /** 收集生成计划所需的学习上下文 */
  private async collectContext(): Promise<{
    stats: Partial<HighlightsStats>;
    dueCount: number;
    recentWords: string[];
  }> {
    const stats: Partial<HighlightsStats> = {};
    let dueCount = 0;
    let recentWords: string[] = [];

    try {
      const result = await ipcClient.getHighlightsStats();
      if (result && !result.error) Object.assign(stats, result);
    } catch {
      /* ignore */
    }

    try {
      const due = await ipcClient.getDueHighlights({ limit: 100 });
      if (Array.isArray(due)) dueCount = due.length;
    } catch {
      /* ignore */
    }

    try {
      const today = await ipcClient.getTodayHighlights();
      if (Array.isArray(today)) {
        recentWords = (today as Highlight[])
          .map((h) => (h.original_text || '').trim())
          .filter((w) => w.length > 0 && w.length <= 40)
          .slice(0, 30);
      }
    } catch {
      /* ignore */
    }

    return { stats, dueCount, recentWords };
  }

  /** 纯本地模板生成（无 AI 调用，离线可用） */
  private buildTemplatePlan(
    days: number,
    focus: string,
    stats: Partial<HighlightsStats>,
    dueCount: number,
    recentWords: string[] = []
  ): { planText: string; structuredPlan: StructuredPlan } {
    const total = stats.totalHighlights ?? 0;
    const reviewed = stats.reviewedHighlights ?? 0;
    const mastered = stats.masteredHighlights ?? 0;
    const todayReviewed = stats.todayReviewed ?? 0;
    const streak = stats.streakDays ?? 0;
    const pending = stats.pendingHighlights ?? Math.max(total - reviewed, 0);

    const lines = [
      `**学习周期**: ${days} 天`,
      `**学习重点**: ${FOCUS_LABEL[focus] ?? focus}`,
      `**总词数**: ${total}`,
      `**已复习**: ${reviewed}`,
      `**已掌握**: ${mastered}`,
      `**待复习**: ${pending}`,
      `**今日到期**: ${dueCount}`,
      `**今日已复习**: ${todayReviewed}`,
      `**连续天数**: ${streak}`,
      '',
      '**建议行动**',
      `- 每天先完成「复习」Tab 中到期的单词（当前约 ${dueCount} 个）`,
      '- 保持每天至少新增 5-10 个生词',
      '- 一周内完成连续复习以提升记忆曲线'
    ];

    const structuredPlan: StructuredPlan = {
      days,
      focus,
      stats,
      source: 'template',
      dueCount,
      recentWords,
      weeklyGoal: `在 ${days} 天内完成当前到期单词的复习，并保持每日新增 5-10 个生词`,
      dailyFocus: Array.from({ length: days }, () => '完成到期复习 + 新增 5-10 个生词'),
      recommendations: [
        '优先复习「快要忘记」的单词，而不是新词',
        '把反复查询的单词加入重点关注',
        '用「故事」Tab 把生词编成故事加深记忆'
      ]
    };

    return { planText: lines.join('\n'), structuredPlan };
  }

  /** 从模型输出中提取第一个完整 JSON 对象 */
  private extractJsonObject(text: string): string {
    const start = text.indexOf('{');
    if (start < 0) return text;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) return text.slice(start, i + 1);
        }
      }
    }
    return text.slice(start);
  }

  private buildAiPrompt(
    days: number,
    focus: string,
    stats: Partial<HighlightsStats>,
    dueCount: number,
    recentWords: string[]
  ): { system: string; user: string } {
    const system = [
      '你是一位资深的英语学习规划师，擅长根据学习数据制定可执行的个性化学习计划。',
      '你的建议必须具体、可量化、可执行，避免空话。',
      'CRITICAL: 只输出一个合法的 JSON 对象，不要输出任何其他文字、markdown 代码块或注释。',
      'JSON 结构：{"weekly_goal": string, "daily_focus": string[], "recommendations": string[], "encouragement": string}',
      `daily_focus 必须是长度恰好为 ${days} 的数组，每一项是某一天的具体学习重点（一句话）。`,
      'recommendations 是 2-4 条针对该用户薄弱环节的专项建议。',
      '全部使用简体中文。'
    ].join('\n');

    const statsLine = [
      `总生词数: ${stats.totalHighlights ?? 0}`,
      `已复习: ${stats.reviewedHighlights ?? 0}`,
      `已掌握: ${stats.masteredHighlights ?? 0}`,
      `待复习: ${stats.pendingHighlights ?? 0}`,
      `当前到期待复习: ${dueCount}`,
      `今日已复习: ${stats.todayReviewed ?? 0}`,
      `连续学习天数: ${stats.streakDays ?? 0}`,
      `涉及视频数: ${stats.totalVideos ?? 0}`
    ].join('；');

    const user = [
      `请为我制定一个 ${days} 天的英语学习计划，学习重点是「${FOCUS_LABEL[focus] ?? focus}」。`,
      '',
      '我的学习数据：',
      statsLine,
      recentWords.length ? `\n最近学过的单词（样本）：${recentWords.join(', ')}` : '',
      '',
      '请根据数据给出：周期总目标、每日重点、专项建议和一句鼓励。'
    ]
      .filter(Boolean)
      .join('\n');

    return { system, user };
  }

  /** 调用大模型生成计划；任何一步失败都抛错，由调用方决定回退 */
  private async generatePlanWithAI(
    days: number,
    focus: string,
    stats: Partial<HighlightsStats>,
    dueCount: number,
    recentWords: string[],
    modelOverride?: string
  ): Promise<{ planText: string; structuredPlan: StructuredPlan; model: string }> {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API 不可用');
    }

    const { apiKey, apiUrl } = await resolveAiConfig({ requireApiKey: true });
    const model = modelOverride || DEFAULT_MODEL;
    const { system, user } = this.buildAiPrompt(days, focus, stats, dueCount, recentWords);

    const requestData = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.6,
      max_tokens: 1500,
      stream: false
    };

    const result = await ipcClient.performAIRequest(requestData, apiUrl, apiKey);
    if (!result.success) {
      throw new Error(result.error || '主进程 AI 请求失败');
    }

    const data = result.data as ChatCompletionResponse | undefined;
    const raw =
      data?.message?.content ??
      data?.choices?.[0]?.message?.content ??
      '';
    if (!raw.trim()) {
      throw new Error('模型返回为空');
    }

    let parsed: AiPlanPayload;
    try {
      parsed = JSON.parse(this.extractJsonObject(raw)) as AiPlanPayload;
    } catch (e) {
      throw new Error(`解析模型 JSON 失败: ${(e as Error).message}`);
    }

    const dailyFocus = Array.isArray(parsed.daily_focus)
      ? parsed.daily_focus.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];
    const weeklyGoal = typeof parsed.weekly_goal === 'string' ? parsed.weekly_goal.trim() : '';
    const encouragement = typeof parsed.encouragement === 'string' ? parsed.encouragement.trim() : '';

    if (!weeklyGoal && dailyFocus.length === 0) {
      throw new Error('模型未返回有效计划内容');
    }

    // 渲染成 markdown，复用 PlanTab 现有的 **bold** 渲染逻辑
    const lines: string[] = [
      `**学习周期**: ${days} 天`,
      `**学习重点**: ${FOCUS_LABEL[focus] ?? focus}`,
      `**生成方式**: AI 智能生成（${model}）`,
      ''
    ];
    if (weeklyGoal) lines.push(`**周期目标**`, weeklyGoal, '');
    if (dailyFocus.length) {
      lines.push('**每日重点**');
      dailyFocus.slice(0, days).forEach((item, idx) => {
        lines.push(`- Day ${idx + 1}: ${item}`);
      });
      lines.push('');
    }
    if (recommendations.length) {
      lines.push('**专项建议**');
      recommendations.forEach((r) => lines.push(`- ${r}`));
      lines.push('');
    }
    lines.push(
      '**学习数据**',
      `- 总生词 ${stats.totalHighlights ?? 0} / 已掌握 ${stats.masteredHighlights ?? 0} / 当前到期 ${dueCount}`
    );
    if (encouragement) lines.push('', `> ${encouragement}`);

    const structuredPlan: StructuredPlan = {
      days,
      focus,
      stats,
      source: 'ai',
      model,
      dueCount,
      recentWords,
      weeklyGoal,
      dailyFocus: dailyFocus.slice(0, days),
      recommendations
    };

    return { planText: lines.join('\n'), structuredPlan, model };
  }

  /**
   * 生成学习计划。
   * 默认行为：请求 AI，失败时自动回退到本地模板（结果中通过 source / fallbackReason 体现）。
   */
  async generateStudyPlan(options: GenerateStudyPlanOptions = {}): Promise<GenerateStudyPlanResult> {
    const days = Math.min(Math.max(options.days ?? 7, 1), 90);
    const focus = options.focus ?? 'comprehensive';
    const createdAt = new Date().toISOString();

    const { stats, dueCount, recentWords } = await this.collectContext();

    let planText: string;
    let structuredPlan: StructuredPlan;
    let source: PlanSource = 'template';
    let fallbackReason: string | undefined;

    if (options.source === 'template') {
      const tpl = this.buildTemplatePlan(days, focus, stats, dueCount, recentWords);
      planText = tpl.planText;
      structuredPlan = tpl.structuredPlan;
    } else {
      try {
        const ai = await this.generatePlanWithAI(days, focus, stats, dueCount, recentWords, options.model);
        planText = ai.planText;
        structuredPlan = ai.structuredPlan;
        source = 'ai';
      } catch (e) {
        const tpl = this.buildTemplatePlan(days, focus, stats, dueCount, recentWords);
        planText = tpl.planText;
        structuredPlan = tpl.structuredPlan;
        source = 'template';
        fallbackReason = (e as Error).message || 'AI 生成失败';
        console.warn('AI 生成学习计划失败，已回退模板:', fallbackReason);
      }
    }

    try {
      const payload: SaveStudyPlanPayload = { planData: planText, structuredPlan, days, createdAt };
      await ipcClient.saveStudyPlan(payload);
    } catch (e) {
      console.error('saveStudyPlan 失败:', e);
    }

    return { planText, plan: structuredPlan, days, createdAt, source, fallbackReason };
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

