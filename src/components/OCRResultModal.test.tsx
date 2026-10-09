/**
 * OCRResultModal 组件测试：验证本地字典查询的接入（核对本地 feature 分支时
 * 发现 GitHub 侧 dictionaryService 是死代码，本次补上渲染层调用）。
 *
 * 运行：CI=true npm test -- --testPathPattern=OCRResultModal
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockLookup = jest.fn();

jest.mock('../utils/dictionaryService', () => ({
  __esModule: true,
  default: { lookup: (w: string) => mockLookup(w) },
  formatDictionaryResult: (r: { word: string; phonetic: string; definitions: unknown[]; synonyms: unknown[] }) =>
    `**${r.word}** ${r.phonetic}\n\n**N.**\n${JSON.stringify(r.definitions)}\n${JSON.stringify(r.synonyms)}`
}));

import OCRResultModal from './OCRResultModal';

beforeEach(() => {
  jest.clearAllMocks();
});

const OPEN_PROPS = {
  isOpen: true,
  result: 'glimpse of hope',
  onExplain: jest.fn(),
  onClose: jest.fn()
};

describe('OCRResultModal 字典查询', () => {
  it('点单词 → 气泡出现「📖 字典」按钮', async () => {
    const user = userEvent.setup();
    render(<OCRResultModal {...OPEN_PROPS} />);

    await user.click(screen.getByText('glimpse'));

    expect(await screen.findByRole('button', { name: /字典/ })).toBeInTheDocument();
  });

  it('点击「字典」后展示本地查询结果', async () => {
    const user = userEvent.setup();
    mockLookup.mockResolvedValue({
      word: 'glimpse',
      phonetic: '/ɡlɪmps/',
      definitions: [{ type: 'n', english: 'a brief look', chinese: '一瞥' }],
      synonyms: []
    });

    render(<OCRResultModal {...OPEN_PROPS} />);
    await user.click(screen.getByText('glimpse'));
    await user.click(await screen.findByRole('button', { name: /字典/ }));

    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('glimpse'));
    const panel = await screen.findByTestId('ocr-dict-result');
    expect(panel).toBeInTheDocument();
    expect(panel.textContent).toContain('glimpse');
    // markdown **bold** 应被渲染成 <strong>
    expect(panel.querySelector('strong')).not.toBeNull();
  });

  it('本地字典未找到时展示提示，不展示结果面板', async () => {
    const user = userEvent.setup();
    mockLookup.mockResolvedValue(null);

    render(<OCRResultModal {...OPEN_PROPS} />);
    await user.click(screen.getByText('glimpse'));
    await user.click(await screen.findByRole('button', { name: /字典/ }));

    expect(await screen.findByText('本地字典未找到「glimpse」')).toBeInTheDocument();
    expect(screen.queryByTestId('ocr-dict-result')).not.toBeInTheDocument();
  });

  it('查询抛异常时展示错误信息', async () => {
    const user = userEvent.setup();
    mockLookup.mockRejectedValue(new Error('字典文件不存在'));

    render(<OCRResultModal {...OPEN_PROPS} />);
    await user.click(screen.getByText('glimpse'));
    await user.click(await screen.findByRole('button', { name: /字典/ }));

    expect(await screen.findByText('字典文件不存在')).toBeInTheDocument();
  });

  it('关闭时清空字典结果', async () => {
    const user = userEvent.setup();
    mockLookup.mockResolvedValue({
      word: 'glimpse',
      phonetic: '/ɡlɪmps/',
      definitions: [],
      synonyms: []
    });

    const { rerender } = render(<OCRResultModal {...OPEN_PROPS} />);
    await user.click(screen.getByText('glimpse'));
    await user.click(await screen.findByRole('button', { name: /字典/ }));
    expect(await screen.findByTestId('ocr-dict-result')).toBeInTheDocument();

    // 重新打开（result 变化）应清空旧结果
    rerender(<OCRResultModal {...OPEN_PROPS} result="another text" />);
    await waitFor(() => expect(screen.queryByTestId('ocr-dict-result')).not.toBeInTheDocument());
  });
});
