/**
 * PlanTab 组件测试：验证生成方式切换、来源徽标、AI 失败回退提示与进度打卡。
 *
 * 运行：CI=true npm test -- --testPathPattern=PlanTab
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../services/studyPlanService', () => ({
  __esModule: true,
  default: {
    getCurrentStudyPlan: jest.fn(),
    generateStudyPlan: jest.fn(),
    updatePlanProgress: jest.fn()
  }
}));

jest.mock('../../services/ipcClient', () => ({
  ipcClient: { isAvailable: () => true }
}));

import studyPlanService from '../../services/studyPlanService';
import PlanTab from './PlanTab';

const mockService = studyPlanService as unknown as {
  getCurrentStudyPlan: jest.Mock;
  generateStudyPlan: jest.Mock;
  updatePlanProgress: jest.Mock;
};

const AI_RESULT = {
  planText: '**周期目标**\n7 天内清空到期单词',
  plan: { days: 7, focus: 'comprehensive', stats: {}, source: 'ai' as const },
  days: 7,
  createdAt: new Date().toISOString(),
  source: 'ai' as const
};

beforeEach(() => {
  jest.clearAllMocks();
  mockService.getCurrentStudyPlan.mockResolvedValue(null);
  mockService.generateStudyPlan.mockResolvedValue(AI_RESULT);
  mockService.updatePlanProgress.mockResolvedValue({ success: true });
});

describe('PlanTab', () => {
  it('无历史计划时展示「生成 7 天计划」入口', async () => {
    render(<PlanTab />);
    expect(await screen.findByText('还没有学习计划')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成 7 天计划/ })).toBeInTheDocument();
  });

  it('默认走 AI 生成，成功后显示「AI 生成」徽标', async () => {
    const user = userEvent.setup();
    render(<PlanTab />);

    await user.click(await screen.findByRole('button', { name: /生成 7 天计划/ }));

    await waitFor(() => expect(mockService.generateStudyPlan).toHaveBeenCalledWith({ days: 7, focus: 'comprehensive', source: 'ai' }));
    expect(await screen.findByTestId('plan-source-chip')).toHaveTextContent('AI 生成');
    expect(screen.getByText(/第 1 \/ 7 天/)).toBeInTheDocument();
  });

  it('可切换到「快速模板」并以 template 模式生成', async () => {
    const user = userEvent.setup();
    mockService.generateStudyPlan.mockResolvedValue({ ...AI_RESULT, source: 'template', plan: { ...AI_RESULT.plan, source: 'template' } });

    render(<PlanTab />);
    await user.click(await screen.findByRole('button', { name: /快速模板/ }));
    await user.click(screen.getByRole('button', { name: /生成 7 天计划/ }));

    await waitFor(() =>
      expect(mockService.generateStudyPlan).toHaveBeenCalledWith({ days: 7, focus: 'comprehensive', source: 'template' })
    );
    expect(await screen.findByText('模板生成')).toBeInTheDocument();
  });

  it('AI 失败回退模板时展示警告条', async () => {
    const user = userEvent.setup();
    mockService.generateStudyPlan.mockResolvedValue({
      ...AI_RESULT,
      source: 'template',
      plan: { ...AI_RESULT.plan, source: 'template' },
      fallbackReason: '未设置API Key'
    });

    render(<PlanTab />);
    await user.click(await screen.findByRole('button', { name: /生成 7 天计划/ }));

    expect(await screen.findByText(/AI 生成失败，已回退到模板计划：未设置API Key/)).toBeInTheDocument();
    expect(screen.getByText('模板生成')).toBeInTheDocument();
  });

  it('「标记今天已完成」会把进度写回主进程', async () => {
    const user = userEvent.setup();
    render(<PlanTab />);
    await user.click(await screen.findByRole('button', { name: /生成 7 天计划/ }));
    await screen.findByTestId('plan-source-chip');

    await user.click(screen.getByRole('button', { name: /标记今天已完成/ }));

    await waitFor(() => expect(mockService.updatePlanProgress).toHaveBeenCalledWith({ progress: 14 }));
    expect(await screen.findByText(/已记录第 1 天完成/)).toBeInTheDocument();
    // 第 1 / 7 天 → 14%，未完成，按钮仍可点
    expect(screen.getByText('14%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /标记今天已完成/ })).toBeEnabled();
  });

  it('加载历史计划时按 structuredPlan.source 显示来源', async () => {
    mockService.getCurrentStudyPlan.mockResolvedValue({
      id: 1,
      plan_data: '**周期目标**\n旧计划',
      structured_plan: JSON.stringify({ days: 7, source: 'ai' }),
      structuredPlan: { days: 7, source: 'ai' },
      days: 7,
      status: 'active',
      progress: 57,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    render(<PlanTab />);

    expect(await screen.findByTestId('plan-source-chip')).toHaveTextContent('AI 生成');
    expect(screen.getByText(/第 1 \/ 7 天/)).toBeInTheDocument();
    expect(screen.getByText('57%')).toBeInTheDocument();
  });

  it('加载失败时展示错误与重试按钮', async () => {
    mockService.getCurrentStudyPlan.mockRejectedValue(new Error('数据库未初始化'));

    render(<PlanTab />);

    expect(await screen.findByText('数据库未初始化')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument();
  });
});
