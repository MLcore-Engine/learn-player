/**
 * StatsTab 组件测试：验证统计卡片、掌握度分布与时长展示。
 *
 * 运行：CI=true npm test -- --testPathPattern=StatsTab
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetStats = jest.fn();
const mockGetDaily = jest.fn();

jest.mock('../../services/ipcClient', () => ({
  ipcClient: {
    isAvailable: () => true,
    getHighlightsStats: () => mockGetStats(),
    getHighlightsDailyCount: (opts: { days?: number }) => mockGetDaily(opts)
  }
}));

// StatsTab 通过 AppContext 的 useTimeStats 拿时长，这里 mock 掉整个 context 模块
jest.mock('../../contexts/AppContext', () => ({
  useTimeStats: () => ({ totalTime: 3900, sessionTime: 600 })
}));

import StatsTab from './StatsTab';

const STATS = {
  totalHighlights: 10,
  pendingHighlights: 4,
  reviewedHighlights: 3,
  archivedHighlights: 1,
  masteredHighlights: 2,
  totalVideos: 2,
  todayReviewed: 5,
  streakDays: 4
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStats.mockResolvedValue(STATS);
  mockGetDaily.mockResolvedValue([
    { date: '2026-05-07', count: 1 },
    { date: '2026-05-08', count: 3 },
    { date: '2026-05-09', count: 2 }
  ]);
});

describe('StatsTab', () => {
  it('渲染统计卡片与掌握度分布', async () => {
    render(<StatsTab />);

    expect(await screen.findByText('总词数')).toBeInTheDocument();
    expect(screen.getByText('待复习')).toBeInTheDocument();
    expect(screen.getByText('已掌握')).toBeInTheDocument();
    expect(screen.getByText('连续天数')).toBeInTheDocument();
    expect(screen.getByText('视频数')).toBeInTheDocument();

    // 数值：总词数 10 / 待复习 4 / 已掌握 2 / 连续 4 / 视频 2
    for (const v of ['10', '4', '2', '4', '2']) {
      expect(screen.getAllByText(v).length).toBeGreaterThan(0);
    }
  });

  it('掌握度分布展示四个状态与占比', async () => {
    render(<StatsTab />);

    expect(await screen.findByText('掌握度分布')).toBeInTheDocument();
    expect(screen.getByText(/学习中 4（40%）/)).toBeInTheDocument();
    expect(screen.getByText(/已复习 3（30%）/)).toBeInTheDocument();
    expect(screen.getByText(/已掌握 2（20%）/)).toBeInTheDocument();
    expect(screen.getByText(/已归档 1（10%）/)).toBeInTheDocument();
    expect(screen.getByText('掌握率 20%')).toBeInTheDocument();
  });

  it('展示学习时长（含小时换算）', async () => {
    render(<StatsTab />);
    expect(await screen.findByText('学习时长')).toBeInTheDocument();
    expect(screen.getByText('1h 5m')).toBeInTheDocument(); // totalTime 3900s
    expect(screen.getByText('10m')).toBeInTheDocument(); // sessionTime 600s
  });

  it('无数据时掌握度分布显示空态文案', async () => {
    mockGetStats.mockResolvedValue({
      totalHighlights: 0,
      pendingHighlights: 0,
      reviewedHighlights: 0,
      archivedHighlights: 0,
      masteredHighlights: 0,
      totalVideos: 0,
      todayReviewed: 0,
      streakDays: 0
    });

    render(<StatsTab />);

    expect(await screen.findByText(/还没有学习数据/)).toBeInTheDocument();
    expect(screen.queryByText('掌握率 0%')).not.toBeInTheDocument();
  });

  it('统计接口报错时展示错误与重试', async () => {
    mockGetStats.mockResolvedValue({ ...STATS, error: '数据库未初始化' });

    render(<StatsTab />);

    expect(await screen.findByText(/数据库未初始化/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument();
  });

  it('接口抛异常时不会白屏，同样展示重试', async () => {
    mockGetStats.mockRejectedValue(new Error('boom'));

    render(<StatsTab />);

    await waitFor(() => expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument());
  });
});
