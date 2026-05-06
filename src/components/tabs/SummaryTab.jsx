import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress, Paper, Stack, List, ListItem, ListItemText, IconButton
} from '@mui/material';
import { ArrowBack, Refresh, AutoStories, PictureAsPdf, ContentCopy } from '@mui/icons-material';
import { ipcClient } from '../../services/ipcClient';
import aiService from '../../services/aiService';

// 构建导出 PDF 的 HTML（仅今日新增）
const buildPdfHtml = (highlights) => {
  const today = new Date().toISOString().slice(0, 10);
  const parts = [`<h1>今日学习记录 (${today})</h1>`];
  for (const h of highlights || []) {
    const word = (h.original_text || '').trim();
    let body = (h.explanation || h.user_note || '').trim();
    body = body
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
    if (!word && !body) continue;
    parts.push('<div class="record">');
    if (word) parts.push(`<h2>${word}</h2>`);
    if (body) parts.push(`<div>${body}</div>`);
    parts.push('</div>');
  }
  return parts.join('\n');
};

// 渲染 AI 故事（去掉 <shengcheng> 标签 + 简单 markdown）
const renderStoryHtml = (raw) => {
  const cleaned = (raw || '').replace(/<\/?shengcheng>/g, '');
  return cleaned
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
};

const SummaryTab = ({ onBackToSubtitle }) => {
  const [todayWords, setTodayWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [story, setStory] = useState('');
  const [storyBusy, setStoryBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await ipcClient.getTodayHighlights();
      if (result && result.error) throw new Error(result.error);
      setTodayWords(Array.isArray(result) ? result : []);
    } catch (e) {
      console.error('SummaryTab 加载失败:', e);
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerateStory = async () => {
    if (todayWords.length === 0) {
      alert('今天还没有新增单词');
      return;
    }
    setStoryBusy(true);
    setStory('');
    try {
      const result = await aiService.generateVocabularyStory();
      setStory(result || '');
    } catch (e) {
      console.error('生成故事失败:', e);
      alert('生成故事失败：' + (e.message || e));
    } finally {
      setStoryBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (todayWords.length === 0) {
      alert('今天还没有新增单词，无内容可导出');
      return;
    }
    setExportBusy(true);
    try {
      const html = buildPdfHtml(todayWords);
      const today = new Date().toISOString().slice(0, 10);
      const result = await ipcClient.exportLearningTodayPdf({
        html,
        title: '今日学习记录',
        suggestedName: `learning-${today}.pdf`
      });
      if (result && result.success) {
        alert('已保存到: ' + result.filePath);
      } else if (result && result.canceled) {
        // user cancelled
      } else {
        alert('导出失败: ' + (result?.error || '未知错误'));
      }
    } catch (e) {
      console.error('导出 PDF 失败:', e);
      alert('导出 PDF 失败：' + (e?.message || e));
    } finally {
      setExportBusy(false);
    }
  };

  const handleCopyStory = () => {
    if (!story) return;
    navigator.clipboard.writeText(story.replace(/<\/?shengcheng>/g, ''));
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">总结</Typography>
        <Button size="small" startIcon={<Refresh />} onClick={load}>刷新</Button>
      </Stack>

      <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
        {/* 今日单词列表 */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            今日新增（{todayWords.length}）
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : error ? (
            <Typography color="error" variant="body2">{error}</Typography>
          ) : todayWords.length === 0 ? (
            <Typography variant="body2" color="text.secondary">今天还没有新增单词</Typography>
          ) : (
            <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
              {todayWords.map((h) => (
                <ListItem key={h.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={h.original_text}
                    secondary={(h.explanation || '').slice(0, 60) + (h.explanation && h.explanation.length > 60 ? '...' : '')}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* 操作按钮 */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={storyBusy ? <CircularProgress size={14} color="inherit" /> : <AutoStories />}
            onClick={handleGenerateStory}
            disabled={storyBusy || todayWords.length === 0}
          >
            {storyBusy ? '生成中...' : '生成今日故事'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={exportBusy ? <CircularProgress size={14} /> : <PictureAsPdf />}
            onClick={handleExportPdf}
            disabled={exportBusy || todayWords.length === 0}
          >
            {exportBusy ? '导出中...' : '导出 PDF'}
          </Button>
        </Stack>

        {/* 今日故事 */}
        {story && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">今日故事</Typography>
              <IconButton size="small" onClick={handleCopyStory}>
                <ContentCopy fontSize="small" />
              </IconButton>
            </Stack>
            <Box
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                fontSize: '0.95rem',
                '& strong': { color: 'primary.main' },
                '& code': {
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  padding: '2px 4px',
                  borderRadius: 1,
                  fontFamily: 'monospace'
                }
              }}
              dangerouslySetInnerHTML={{ __html: renderStoryHtml(story) }}
            />
          </Paper>
        )}
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

export default SummaryTab;
