import React from 'react';
import { Box, Card, Typography, IconButton, Stack, Button } from '@mui/material';
import { ContentCopy, ArrowBack } from '@mui/icons-material';

// 清理文本中的特殊标记
const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/**
 * 学习助手（解释 Tab）
 * 只展示当前 AI 解释的流式内容 + 复制 + 返回字幕
 * 今日总结 / 导出 PDF / 查看历史记录 等功能已拆出（S6 在总结 Tab 实现）
 */
const LearningAssistant = React.memo(({
  explanation,
  selectedText,
  onBackToSubtitles,
}) => {
  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
  };

  const renderContent = () => {
    if (!explanation) {
      return (
        <Typography variant="body2" color="text.secondary" align="center">
          选择字幕文本或输入问题开始对话
        </Typography>
      );
    }

    const parts = clean(explanation).split('\n\n');

    return (
      <Box sx={{ p: 2 }}>
        {parts.map((part, index) => {
          const isTitle = /^\d+\./.test(part);
          const isDictResult = part.includes('/') && part.includes('**');

          return (
            <Box
              key={index}
              sx={{
                mb: 2,
                pb: 2,
                borderBottom: index < parts.length - 1 ? '1px solid rgba(0, 0, 0, 0.12)' : 'none'
              }}
            >
              <Typography
                variant={isTitle || isDictResult ? 'subtitle1' : 'body2'}
                component="div"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontSize: isTitle || isDictResult ? '1.1rem' : '1rem',
                  lineHeight: 1.6,
                  '& strong': {
                    color: 'primary.main',
                    fontWeight: 600,
                    fontSize: '1.05rem'
                  },
                  '& code': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    padding: '2px 4px',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.95rem'
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html: part
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.+?)`/g, '<code>$1</code>')
                    .replace(/\n/g, '<br/>')
                }}
              />
            </Box>
          );
        })}
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton size="small" onClick={() => handleCopyText(clean(explanation))}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  };

  const showBackButton = onBackToSubtitles && (explanation || selectedText);

  return (
    <Card sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Box sx={{
        flexGrow: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {renderContent()}
      </Box>

      {showBackButton && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={onBackToSubtitles}
              size="small"
            >
              返回字幕
            </Button>
          </Stack>
        </Box>
      )}
    </Card>
  );
});

export default LearningAssistant;
