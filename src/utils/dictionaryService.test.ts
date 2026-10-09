/**
 * dictionaryService 纯函数测试：formatDictionaryResult 的 Markdown 组装。
 *
 * 运行：CI=true npm test -- --testPathPattern=dictionaryService
 */
import { formatDictionaryResult } from './dictionaryService';
import type { DictionaryResult } from './dictionaryService';

const RESULT: DictionaryResult = {
  word: 'glimpse',
  phonetic: '/ɡlɪmps/',
  definitions: [
    { type: 'n', english: 'a brief look', chinese: '一瞥' },
    { type: 'v', english: 'to see briefly', chinese: '瞥见' },
    { type: 'n', english: 'a short experience', chinese: '短暂的感受' }
  ],
  synonyms: [
    { english: 'glance', chinese: '匆匆一看' },
    { english: 'peek', chinese: '偷偷看一眼' }
  ]
};

describe('formatDictionaryResult', () => {
  it('头部包含单词与音标（加粗）', () => {
    const out = formatDictionaryResult(RESULT);
    expect(out.startsWith('**glimpse** /ɡlɪmps/')).toBe(true);
  });

  it('按词性分组，组名大写并加粗', () => {
    const out = formatDictionaryResult(RESULT);
    expect(out).toContain('**N**');
    expect(out).toContain('**V**');
    // 同一词性的多条释义应归到同一组下，不重复出现组标题
    expect(out.match(/\*\*N\*\*/g)).toHaveLength(1);
    expect(out).toContain('a brief look\n一瞥');
    expect(out).toContain('a short experience\n短暂的感受');
  });

  it('包含同义词区块', () => {
    const out = formatDictionaryResult(RESULT);
    expect(out).toContain('**同义词**');
    expect(out).toContain('glance - 匆匆一看');
    expect(out).toContain('peek - 偷偷看一眼');
  });

  it('没有同义词时不输出同义词区块', () => {
    const out = formatDictionaryResult({ ...RESULT, synonyms: [] });
    expect(out).not.toContain('**同义词**');
  });

  it('没有释义时只保留头部', () => {
    const out = formatDictionaryResult({ ...RESULT, definitions: [], synonyms: [] });
    expect(out).toBe('**glimpse** /ɡlɪmps/');
  });
});
