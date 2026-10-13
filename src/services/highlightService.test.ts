/**
 * findCachedExplanation 测试：验证「AI 讲解缓存」的命中/未命中判定。
 *
 * 运行：CI=true npm test -- --testPathPattern=highlightService
 */
jest.mock('./ipcClient', () => ({
  ipcClient: {
    isAvailable: () => true,
    findHighlight: jest.fn()
  }
}));

import { ipcClient } from './ipcClient';
import { findCachedExplanation } from './highlightService';

const mockFind = (ipcClient as unknown as { findHighlight: jest.Mock }).findHighlight;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('findCachedExplanation', () => {
  it('命中且有 explanation 时返回缓存内容', async () => {
    mockFind.mockResolvedValue({ id: '1', original_text: 'glimpse', explanation: '**glimpse** /ɡlɪmps/' });

    const r = await findCachedExplanation('/v/a.mp4', 'glimpse');

    expect(r).toBe('**glimpse** /ɡlɪmps/');
    expect(mockFind).toHaveBeenCalledWith({ videoPath: '/v/a.mp4', text: 'glimpse' });
  });

  it('未命中（返回 null）时返回 null', async () => {
    mockFind.mockResolvedValue(null);
    expect(await findCachedExplanation('/v/a.mp4', 'newWord')).toBeNull();
  });

  it('命中但 explanation 为空串时视为未命中', async () => {
    mockFind.mockResolvedValue({ id: '1', original_text: 'x', explanation: '' });
    expect(await findCachedExplanation('/v/a.mp4', 'x')).toBeNull();
  });

  it('命中但 explanation 为 null 时视为未命中', async () => {
    mockFind.mockResolvedValue({ id: '1', original_text: 'x', explanation: null });
    expect(await findCachedExplanation('/v/a.mp4', 'x')).toBeNull();
  });

  it('命中但 explanation 全是空白时视为未命中', async () => {
    mockFind.mockResolvedValue({ id: '1', original_text: 'x', explanation: '   \n  ' });
    expect(await findCachedExplanation('/v/a.mp4', 'x')).toBeNull();
  });

  it('IPC 返回 error 时返回 null，不抛出', async () => {
    mockFind.mockResolvedValue({ error: '数据库未初始化' });
    expect(await findCachedExplanation('/v/a.mp4', 'x')).toBeNull();
  });

  it('IPC 抛异常时返回 null，不抛出', async () => {
    mockFind.mockRejectedValue(new Error('boom'));
    await expect(findCachedExplanation('/v/a.mp4', 'x')).resolves.toBeNull();
  });

  it('空文本直接返回 null，不发 IPC', async () => {
    expect(await findCachedExplanation('/v/a.mp4', '')).toBeNull();
    expect(await findCachedExplanation('/v/a.mp4', '   ')).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('videoPath 为空时按空串查询（OCR 场景 video_path 存的是空串）', async () => {
    mockFind.mockResolvedValue(null);
    await findCachedExplanation('', 'word');
    expect(mockFind).toHaveBeenCalledWith({ videoPath: '', text: 'word' });
  });
});
