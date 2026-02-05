import React from 'react';
import {
  Box,
  Card,
  Typography,
  CircularProgress,
} from '@mui/material';

// 清理文本中的特殊标记
const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/**
 * 学习助手组件
 * 只显示AI解释内容
 */
const LearningAssistant = React.memo(({
  explanation,
  isLoading,
  selectedText
}) => {
  // 渲染当前对话内容
  const renderCurrentDialogue = () => {
    // 显示加载状态
    if (isLoading && !explanation) {
      return (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: 4,
          gap: 2
        }}>
          <CircularProgress size={32} sx={{ color: '#8B7355' }} />
          <Typography variant="body2" sx={{ color: '#6B5D45', fontWeight: 500 }}>
            {selectedText ? `正在解释: "${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}"` : '生成中...'}
          </Typography>
        </Box>
      );
    }

    if (!explanation) {
      return (
        <Typography variant="body2" color="text.secondary" align="center">
          选择字幕文本或输入问题开始对话
        </Typography>
      );
    }

    // 将解释文本分割成不同部分
    const parts = clean(explanation).split('\n\n');
    
    return (
      <Box sx={{ p: 2 }}>
        {parts.map((part, index) => {
          // 检查是否是标题行（包含数字和点）或字典查询结果（包含音标）
          const isTitle = /^\d+\./.test(part);
          const isDictResult = part.includes('/') && part.includes('**');
          
          return (
            <Box 
              key={index} 
              sx={{ 
                mb: 2,
                pb: 2,
                borderBottom: index < parts.length - 1 ? '1px solid #E8E0C8' : 'none'
              }}
            >
              <Typography
                variant={isTitle || isDictResult ? "subtitle1" : "body2"}
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
                    backgroundColor: '#F0E8D0',
                    padding: '2px 6px',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    border: '1px solid #E0D8C0'
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
        
        {/* 流式输出时显示生成中提示 */}
        {isLoading && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            py: 1,
            color: '#8B7355'
          }}>
            <CircularProgress size={16} sx={{ color: '#8B7355' }} />
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              生成中...
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#FDF8E8',
      boxShadow: 'none',
      borderRadius: 0
    }}>
      {/* 主要内容区域 */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {renderCurrentDialogue()}
      </Box>
    </Card>
  );
}, (prevProps, nextProps) => {
  return prevProps.explanation === nextProps.explanation &&
         prevProps.isLoading === nextProps.isLoading &&
         prevProps.selectedText === nextProps.selectedText;
});

export default LearningAssistant; 
