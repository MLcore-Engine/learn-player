/**
 * useExplainFlow 测试：验证 AI 讲解缓存的命中/未命中行为。
 *
 * 运行：CI=true npm test -- --testPathPattern=useExplainFlow
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockStreamExplanation = jest.fn();
const mockFindCachedExplanation = jest.fn();
const mockCreateHighlight = jest.fn();

jest.mock('../services/aiService', () => ({
  __esModule: true,
  default: { streamExplanation: (...args: unknown[]) => mockStreamExplanation(...args) }
}));

jest.mock('../services/highlightService', () => ({
  createHighlight: (...args: unknown[]) => mockCreateHighlight(...args),
  findCachedExplanation: (...args: unknown[]) => mockFindCachedExplanation(...args)
}));

// hook 通过 AppContext 取 AI / Video 状态，这里替换成最小可用实现
jest.mock('../contexts/AppContext', () => ({
  useAI: () => ({
    setSelectedText: jest.fn(),
    setExplanation: jest.fn(),
    setLoading: jest.fn()
  }),
  useVideo: () => ({
    isLoaded: true,
    playerRef: { current: null },
    videoPath: '/v/movie.mp4'
  })
}));

import useExplainFlow from './useExplainFlow';

const setup = () => renderHook(() => useExplainFlow({ hasExternalSubtitles: false }));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateHighlight.mockResolvedValue({ success: true });
  mockStreamExplanation.mockResolvedValue('AI 实时讲解内容');
});

describe('useExplainFlow 讲解缓存', () => {
  it('未命中缓存时走 AI 流式讲解', async () => {
    mockFindCachedExplanation.mockResolvedValue(null);
    const { result } = setup();

    await act(async () => {
      await result.current.handleExplain('zh', 'glimpse');
    });

    expect(mockFindCachedExplanation).toHaveBeenCalledWith('/v/movie.mp4', 'glimpse');
    expect(mockStreamExplanation).toHaveBeenCalledTimes(1);
    expect(mockCreateHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ original_text: 'glimpse', explanation: 'AI 实时讲解内容' })
    );
  });

  it('命中缓存时不调用 AI，直接复用旧讲解', async () => {
    mockFindCachedExplanation.mockResolvedValue('**glimpse** /ɡlɪmps/ 旧讲解');
    const { result } = setup();

    await act(async () => {
      await result.current.handleExplain('zh', 'glimpse');
    });

    expect(mockStreamExplanation).not.toHaveBeenCalled();
    // 仍会 UPSERT 一次，保证 query_count + 1
    expect(mockCreateHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ original_text: 'glimpse', explanation: '**glimpse** /ɡlɪmps/ 旧讲解' })
    );
  });

  it('缓存查询抛异常时不阻塞主流程，仍然走 AI', async () => {
    mockFindCachedExplanation.mockRejectedValue(new Error('db down'));
    const { result } = setup();

    await act(async () => {
      await result.current.handleExplain('zh', 'glimpse');
    });

    expect(mockStreamExplanation).toHaveBeenCalledTimes(1);
  });

  it('没有可解释文字时不查缓存、不调 AI', async () => {
    const { result } = setup();
    const spy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    await act(async () => {
      await result.current.handleExplain('zh', '');
    });

    expect(mockFindCachedExplanation).not.toHaveBeenCalled();
    expect(mockStreamExplanation).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('连续 explain 时 loading 状态正确回归', async () => {
    mockFindCachedExplanation.mockResolvedValue(null);
    const { result } = setup();

    await act(async () => {
      await result.current.handleExplain('zh', 'glimpse');
    });

    await waitFor(() => expect(result.current.explainLoading).toBe(false));
  });
});
