import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { ContentCopy, History, Summarize } from '@mui/icons-material';
import aiService from '../services/aiService';
import { ipcClient } from '../services/ipcClient';

// 清理文本中的特殊标记
const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

// 将富文本(**, `code`)转为简单HTML
function toHtml(text) {
  return (text || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

// 构建可打印HTML
function buildPrintableHtml(records) {
  const today = new Date().toISOString().slice(0, 10);
  const parts = [`<h1>今日学习记录 (${today})</h1>`];
  for (const rec of records || []) {
    const q = (rec.query || '').trim();
    let body = toHtml(clean(rec.explanation || rec.text || ''));
    // 高亮音标：将 /.../ 包裹并着色（尽量避免误伤URL等，限制长度40字符以内）
    // 仅在不属于HTML标签的斜杠内高亮音标：排除 </tag> 与自闭合 />，并排除URL中的 ://
    try {
      body = body.replace(/(?<!<)\/([^/<>\n:]{1,40})\/(?!>)/g, '<span class="phonetic">/$1/</span>');
    } catch (_) {
      // 若运行环境不支持负向回溯，则退化为更保守的匹配（不处理）
    }
    if (!q && !body) continue;
    parts.push(`<div class="record">`);
    if (q) parts.push(`<h2>${q}</h2>`);
    if (body) parts.push(`<div>${body}</div>`);
    parts.push(`</div>`);
  }
  return parts.join('\n');
}

// （保留空位以便未来添加其它导出方式）

// 选项卡内容组件
// function TabPanel(props) {
//   const { children, value, index, ...other } = props;

//   return (
//     <div
//       role="tabpanel"
//       hidden={value !== index}
//       id={`assistant-tabpanel-${index}`}
//       aria-labelledby={`assistant-tab-${index}`}
//       style={{ display: value === index ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
//       {...other}
//     >
//       {value === index && (
//         <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
//           {children}
//         </Box>
//       )}
//     </div>
//   );
// }

/**
 * 学习助手组件
 * 显示AI解释内容和学习记录
 */
const LearningAssistant = React.memo(({ 
 
  explanation
}) => {
  // 状态管理
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [summary, setSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [hasSummarizedToday, setHasSummarizedToday] = useState(false);

  // 初始化：检查本地存储是否已生成今日总结
  useEffect(() => {
    const lastDate = localStorage.getItem('lastSummaryDate');
    const today = new Date().toISOString().slice(0, 10);
    if (lastDate === today) {
      setHasSummarizedToday(true);
    }
  }, []);

  // 当 explanation 更新时，隐藏今日总结视图
  useEffect(() => {
    if (showSummary) {
      setShowSummary(false);
    }
  }, [explanation, showSummary]);

  // 复制文本到剪贴板
  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
  };

  // 切换历史记录显示
  const handleToggleHistory = async () => {
    if (!showHistory) {
      if (ipcClient.isAvailable()) {
        try {
          // 先检查数据库状态
          const dbStatus = await ipcClient.checkDatabaseStatus();
          if (!dbStatus.isConnected) {
            console.error('数据库未连接');
            alert('数据库未连接，无法获取历史记录');
            return;
          }

          const records = await ipcClient.getAiQueriesToday();
          if (!records || records.length === 0) {
            console.log('没有找到今日的查询记录');
            setChatHistory([]);
          } else {
            console.log('获取到查询记录:', records.length, '条');
            setChatHistory(records.map(rec => ({
              type: 'history',
              id: rec.id,
              query: rec.query,
              text: rec.explanation,
              created_at: rec.created_at
            })));
          }
        } catch (error) {
          console.error('获取历史记录失败:', error);
          alert('获取历史记录失败: ' + error.message);
          return;
        }
      }
    }
    // 切换历史记录时，隐藏今日总结
    setShowSummary(false);
    setShowHistory(!showHistory);
  };

  // 处理今日总结：弹出确认或提示已使用
  const handleSummarize = () => {
    if (hasSummarizedToday) {
      alert('今日总结每天只能使用一次');
      return;
    }
    setOpenConfirm(true);
  };

  // 确认生成今日总结
  const handleConfirmSummarize = async () => {
    setOpenConfirm(false);
    setIsSummarizing(true);
    try {
      const result = await aiService.generateVocabularyStory();
      setSummary(result);
      setShowSummary(true);
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('lastSummaryDate', today);
      setHasSummarizedToday(true);
    } catch (error) {
      console.error('生成今日总结失败:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  // 取消生成
  const handleCancelSummarize = () => {
    setOpenConfirm(false);
  };
  
  // 导出今日学习记录为 PDF（直接保存到本地）
  const handleExportPdf = async () => {
    try {
      const dbStatus = await ipcClient.checkDatabaseStatus();
      if (!dbStatus || !dbStatus.isConnected) {
        alert('数据库未连接，无法导出');
        return;
      }
      const records = await ipcClient.getAiQueriesToday();
      if (!records || records.length === 0) {
        alert('今天没有学习记录可导出');
        return;
      }
      const html = buildPrintableHtml(records);
      const today = new Date().toISOString().slice(0, 10);
      const result = await ipcClient.exportLearningTodayPdf({
        html,
        title: '今日学习记录',
        suggestedName: `learning-${today}.pdf`
      });
      if (result && result.success) {
        alert('已保存到: ' + result.filePath);
      } else if (result && result.canceled) {
        // 用户取消保存
      } else {
        alert('导出失败: ' + (result?.error || '未知错误'));
      }
    } catch (e) {
      console.error('导出 PDF 失败:', e);
      alert('导出 PDF 失败: ' + (e?.message || e));
    }
  };
  
  // 渲染当前对话内容
  const renderCurrentDialogue = () => {
    if (showSummary) {
      if (isSummarizing) {
        return (
          <Typography variant="body2" color="text.secondary" align="center">
            正在生成总结...
          </Typography>
        );
      }
      // 提取标签内内容并渲染
      const storyHtml = summary.replace(/<\/?shengcheng>/g, '');
      return (
        <Box sx={{ p: 2 }}>
          <Typography
            variant="body2"
            component="div"
            sx={{ 
              whiteSpace: 'pre-wrap',
              fontSize: '1rem',
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
              __html: storyHtml
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.+?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br/>')
            }}
          />
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton size="small" onClick={() => handleCopyText(storyHtml)}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Box>
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
                borderBottom: index < parts.length - 1 ? '1px solid rgba(0, 0, 0, 0.12)' : 'none'
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
          <IconButton 
            size="small" 
            onClick={() => handleCopyText(clean(explanation))}
          >
            <ContentCopy fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  };

  // 渲染历史记录列表
  const renderHistory = () => (
    <List>
      {chatHistory.map((message, index) => (
        <ListItem 
          key={index} 
          alignItems="flex-start"
          sx={{ 
            backgroundColor: message.type === 'user' ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
            borderRadius: 1,
            mb: 2,
            p: 2,
            border: '1px solid rgba(0, 0, 0, 0.12)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)'
            }
          }}
        >
          <ListItemText
            primary={
              <Typography 
                variant="subtitle2" 
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {message.query}
              </Typography>
            }
            secondary={
              <Box sx={{ mt: 1 }}>
                <Typography
                  variant="body2"
                  component="div"
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '1rem',
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
                    __html: clean(message.text)
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/`(.+?)`/g, '<code>$1</code>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleCopyText(clean(message.text))}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );

  return (
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 主要内容区域 */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        mb: 2, 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {showHistory ? renderHistory() : renderCurrentDialogue()}
      </Box>

      {/* 底部按钮区域 */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={handleToggleHistory}
            size="small"
          >
            {showHistory ? '返回对话' : '查看记录'}
          </Button>
          <Button
            variant="outlined"
            startIcon={isSummarizing ? <CircularProgress size={16} /> : <Summarize />}
            onClick={handleSummarize}
            size="small"
            disabled={isSummarizing}
          >
            {isSummarizing ? '生成中...' : '今日总结'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleExportPdf}
            size="small"
          >
            导出PDF
          </Button>
        </Stack>
      </Box>

      {/* 确认对话框：每日最后一次使用 */}
      <Dialog open={openConfirm} onClose={handleCancelSummarize}>
        <DialogTitle>确认生成今日总结</DialogTitle>
        <DialogContent>
          <DialogContentText>
            今日总结只能在今天学习完成后最后使用，并且每天只能使用一次，确认要继续吗？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSummarize}>取消</Button>
          <Button onClick={handleConfirmSummarize} autoFocus>确认</Button>
        </DialogActions>
      </Dialog>

    </Card>
  );
}, (prevProps, nextProps) => {
  return prevProps.selectedText === nextProps.selectedText &&
         prevProps.explanation === nextProps.explanation &&
         prevProps.isLoading === nextProps.isLoading;
});

export default LearningAssistant; 
