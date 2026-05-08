import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { ArrowBack, Delete, Download, GraphicEq, Refresh, Shuffle } from '@mui/icons-material';
import { ipcClient } from '../../services/ipcClient';
import {
  deleteStory,
  downloadAudio,
  downloadText,
  generateAudio,
  generateStoryText,
  listStories,
  loadAudioDataUrl,
  saveStory,
  updateStoryAudio
} from '../../services/storyService';
import type { Highlight } from '../../types/highlight';
import type {
  StoryDifficulty,
  StoryLength,
  StoryRow,
  StoryStyle
} from '../../types/story';
import {
  DEFAULT_INSTRUCTION,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  STEP_TTS_MODELS,
  STEP_TTS_VOICES
} from '../../types/story';

export interface StoryTabProps {
  onBackToSubtitle?: () => void;
}

type Phase = 'idle' | 'generatingText' | 'textReady' | 'generatingAudio' | 'audioReady' | 'error';

const DEFAULT_WORD_COUNT = 5;

const renderInlineBold = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <Box key={i} component="strong" sx={{ color: 'primary.main', fontWeight: 700 }}>
          {m[1]}
        </Box>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const StoryTab: React.FC<StoryTabProps> = ({ onBackToSubtitle }) => {
  const [vocabPool, setVocabPool] = useState<Highlight[]>([]);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [style, setStyle] = useState<StoryStyle>('dialogue');
  const [difficulty, setDifficulty] = useState<StoryDifficulty>('B1');
  const [length, setLength] = useState<StoryLength>('medium');
  const [bilingual, setBilingual] = useState<boolean>(true);
  const [voice, setVoice] = useState<string>(DEFAULT_TTS_VOICE);
  const [ttsModel, setTtsModel] = useState<string>(DEFAULT_TTS_MODEL);
  const [instruction, setInstruction] = useState<string>(DEFAULT_INSTRUCTION);
  const [speed, setSpeed] = useState<number>(1.0);

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string>('');
  const [storyId, setStoryId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [bodyEn, setBodyEn] = useState<string>('');
  const [bodyZh, setBodyZh] = useState<string>('');
  const [audioPath, setAudioPath] = useState<string>('');
  const [audioDataUrl, setAudioDataUrl] = useState<string>('');

  const [history, setHistory] = useState<StoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  const loadVocab = useCallback(async (): Promise<void> => {
    try {
      const result = await ipcClient.getHighlights({ status: 'learning', limit: 100 });
      if (Array.isArray(result)) {
        setVocabPool(result);
      } else {
        setVocabPool([]);
      }
    } catch (e) {
      console.error('加载生词失败:', e);
    }
  }, []);

  const loadHistory = useCallback(async (): Promise<void> => {
    setHistoryLoading(true);
    try {
      const list = await listStories(50);
      setHistory(list);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVocab();
    loadHistory();
  }, [loadVocab, loadHistory]);

  const wordList = useMemo(() => {
    return Array.from(new Set(vocabPool.map((h) => h.original_text.trim()).filter(Boolean)));
  }, [vocabPool]);

  const toggleWord = (w: string): void => {
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const pickRandom = (): void => {
    const pool = [...wordList];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSelectedWords(new Set(pool.slice(0, Math.min(DEFAULT_WORD_COUNT, pool.length))));
  };

  const handleGenerateText = async (): Promise<void> => {
    if (selectedWords.size === 0) {
      setError('请至少选择一个生词');
      setPhase('error');
      return;
    }
    setError('');
    setPhase('generatingText');
    setAudioPath('');
    setAudioDataUrl('');
    setStoryId(null);
    try {
      const words = Array.from(selectedWords);
      const result = await generateStoryText({
        words,
        style,
        difficulty,
        length,
        bilingual
      });
      setTitle(result.title);
      setBodyEn(result.bodyEn);
      setBodyZh(result.bodyZh);
      const id = await saveStory({
        title: result.title,
        bodyEn: result.bodyEn,
        bodyZh: result.bodyZh,
        vocabWords: words,
        style,
        difficulty
      });
      setStoryId(id);
      setPhase('textReady');
      loadHistory();
    } catch (e) {
      console.error(e);
      setError((e as Error).message || '生成失败');
      setPhase('error');
    }
  };

  const handleGenerateAudio = async (): Promise<void> => {
    if (!bodyEn) return;
    setPhase('generatingAudio');
    setError('');
    try {
      const supportsInstruction = STEP_TTS_MODELS.find((m) => m.id === ttsModel)?.supportsInstruction;
      const r = await generateAudio({
        text: bodyEn,
        voice,
        speed,
        model: ttsModel,
        instruction: supportsInstruction ? instruction : undefined
      });
      if (!r.success || !r.filePath) throw new Error(r.error || 'TTS 失败');
      setAudioPath(r.filePath);
      const dataUrl = await loadAudioDataUrl(r.filePath);
      setAudioDataUrl(dataUrl);
      if (storyId) {
        await updateStoryAudio(storyId, r.filePath, r.size || 0, voice, ttsModel);
      }
      setPhase('audioReady');
      loadHistory();
    } catch (e) {
      console.error(e);
      setError((e as Error).message || '语音生成失败');
      setPhase('error');
    }
  };

  const handleDownloadAudio = async (): Promise<void> => {
    if (!audioPath) return;
    try {
      const safe = (title || 'story').replace(/[^\w一-龥-]+/g, '_').slice(0, 40);
      await downloadAudio(audioPath, `${safe || 'story'}.mp3`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDownloadText = async (): Promise<void> => {
    if (!bodyEn) return;
    const md =
      `# ${title || 'Story'}\n\n` +
      `> 生词：${Array.from(selectedWords).join(', ')}\n\n` +
      `## English\n\n${bodyEn}\n\n` +
      (bodyZh ? `## 中文\n\n${bodyZh}\n` : '');
    try {
      const safe = (title || 'story').replace(/[^\w一-龥-]+/g, '_').slice(0, 40);
      await downloadText(md, `${safe || 'story'}.md`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openHistory = async (row: StoryRow): Promise<void> => {
    setStoryId(row.id);
    setTitle(row.title || '');
    setBodyEn(row.body_en || '');
    setBodyZh(row.body_zh || '');
    setSelectedWords(new Set(row.vocab_words || []));
    if (row.style) setStyle(row.style as StoryStyle);
    if (row.difficulty) setDifficulty(row.difficulty as StoryDifficulty);
    if (row.voice) setVoice(row.voice);
    if (row.model) setTtsModel(row.model);
    setAudioPath(row.audio_path || '');
    setAudioDataUrl('');
    if (row.audio_path) {
      try {
        const url = await loadAudioDataUrl(row.audio_path);
        setAudioDataUrl(url);
        setPhase('audioReady');
      } catch (e) {
        console.warn('音频文件不可用:', e);
        setPhase('textReady');
      }
    } else {
      setPhase('textReady');
    }
  };

  const handleDeleteHistory = async (id: number): Promise<void> => {
    try {
      await deleteStory(id);
      if (storyId === id) {
        setStoryId(null);
        setBodyEn('');
        setBodyZh('');
        setAudioPath('');
        setAudioDataUrl('');
        setPhase('idle');
      }
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const isBusy = phase === 'generatingText' || phase === 'generatingAudio';

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">故事 · 听力</Typography>
        <Button size="small" startIcon={<Refresh />} onClick={loadVocab}>刷新生词</Button>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">选择生词 ({selectedWords.size} / {wordList.length})</Typography>
            <Button size="small" startIcon={<Shuffle />} onClick={pickRandom} disabled={!wordList.length}>
              随机选 {DEFAULT_WORD_COUNT}
            </Button>
          </Stack>
          <Box sx={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {wordList.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                还没有生词。先去字幕里点几个吧。
              </Typography>
            )}
            {wordList.map((w) => (
              <Chip
                key={w}
                label={w}
                size="small"
                color={selectedWords.has(w) ? 'primary' : 'default'}
                variant={selectedWords.has(w) ? 'filled' : 'outlined'}
                onClick={() => toggleWord(w)}
              />
            ))}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>体裁</InputLabel>
                <Select label="体裁" value={style} onChange={(e) => setStyle(e.target.value as StoryStyle)}>
                  <MenuItem value="dialogue">双人对话</MenuItem>
                  <MenuItem value="short_story">短故事</MenuItem>
                  <MenuItem value="scene">情景描写</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>难度</InputLabel>
                <Select label="难度" value={difficulty} onChange={(e) => setDifficulty(e.target.value as StoryDifficulty)}>
                  <MenuItem value="A2">A2</MenuItem>
                  <MenuItem value="B1">B1</MenuItem>
                  <MenuItem value="B2">B2</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>长度</InputLabel>
                <Select label="长度" value={length} onChange={(e) => setLength(e.target.value as StoryLength)}>
                  <MenuItem value="short">短</MenuItem>
                  <MenuItem value="medium">中</MenuItem>
                  <MenuItem value="long">长</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <FormControlLabel
              control={<Switch checked={bilingual} onChange={(e) => setBilingual(e.target.checked)} />}
              label="同时生成中文翻译"
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>TTS 模型</InputLabel>
                <Select label="TTS 模型" value={ttsModel} onChange={(e) => setTtsModel(e.target.value)}>
                  {STEP_TTS_MODELS.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <Typography variant="body2">{m.label}</Typography>
                        {m.hint && (
                          <Typography variant="caption" color="text.secondary" noWrap>{m.hint}</Typography>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ flex: 2 }}>
                <InputLabel>语音</InputLabel>
                <Select label="语音" value={voice} onChange={(e) => setVoice(e.target.value)}>
                  {STEP_TTS_VOICES.map((v) => {
                    const tagColor =
                      v.englishFitness === 'best' ? 'success' :
                      v.englishFitness === 'good' ? 'primary' : 'default';
                    const tagLabel =
                      v.englishFitness === 'best' ? '英文优' :
                      v.englishFitness === 'good' ? '英文较好' : '英文一般';
                    return (
                      <MenuItem key={v.id} value={v.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2">{v.label}</Typography>
                            {v.hint && (
                              <Typography variant="caption" color="text.secondary" noWrap>{v.hint}</Typography>
                            )}
                          </Box>
                          <Chip size="small" label={tagLabel} color={tagColor as 'success' | 'primary' | 'default'} variant="outlined" />
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <TextField
                size="small"
                type="number"
                label="语速"
                value={speed}
                onChange={(e) => setSpeed(Math.max(0.5, Math.min(2, Number(e.target.value) || 1)))}
                inputProps={{ step: 0.1, min: 0.5, max: 2 }}
                sx={{ width: 100 }}
              />
            </Stack>
            {STEP_TTS_MODELS.find((m) => m.id === ttsModel)?.supportsInstruction && (
              <TextField
                size="small"
                label="Instruction (≤200 字，仅 stepaudio-2.5-tts)"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value.slice(0, 200))}
                multiline
                minRows={2}
                helperText={`${instruction.length}/200 — 用自然语描述音色风格、口音、节奏等`}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={isBusy || selectedWords.size === 0}
                onClick={handleGenerateText}
                startIcon={phase === 'generatingText' ? <CircularProgress size={16} /> : null}
              >
                生成故事文本
              </Button>
              <Button
                variant="outlined"
                disabled={isBusy || !bodyEn}
                onClick={handleGenerateAudio}
                startIcon={phase === 'generatingAudio' ? <CircularProgress size={16} /> : <GraphicEq />}
              >
                生成语音
              </Button>
            </Stack>
            {error && (
              <Typography variant="caption" color="error">{error}</Typography>
            )}
          </Stack>
        </Paper>

        {bodyEn && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            {title && <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>{title}</Typography>}
            <Typography
              variant="body2"
              component="div"
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mb: bodyZh ? 2 : 0 }}
            >
              {renderInlineBold(bodyEn)}
            </Typography>
            {bodyZh && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                  {bodyZh}
                </Typography>
              </>
            )}
            {audioDataUrl && (
              <Box sx={{ mt: 2 }}>
                <audio controls src={audioDataUrl} style={{ width: '100%' }} />
              </Box>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button size="small" startIcon={<Download />} disabled={!audioPath} onClick={handleDownloadAudio}>
                下载 MP3
              </Button>
              <Button size="small" startIcon={<Download />} onClick={handleDownloadText}>
                下载 文本
              </Button>
            </Stack>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">历史故事</Typography>
            {historyLoading && <CircularProgress size={14} />}
          </Stack>
          {history.length === 0 && (
            <Typography variant="caption" color="text.secondary">还没有生成过。</Typography>
          )}
          <Stack spacing={0.5}>
            {history.map((row) => (
              <Stack
                key={row.id}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                  cursor: 'pointer'
                }}
                onClick={() => openHistory(row)}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {row.title || row.body_en.slice(0, 40)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.created_at} · {(row.vocab_words || []).slice(0, 5).join(', ')}
                    {row.audio_path ? ' · 🔊' : ''}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteHistory(row.id);
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Box>

      {onBackToSubtitle && (
        <Box sx={{ mt: 1 }}>
          <Button size="small" variant="outlined" startIcon={<ArrowBack />} onClick={onBackToSubtitle}>
            返回字幕
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default StoryTab;
