import React, { useState } from 'react';
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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { ContentCopy, History } from '@mui/icons-material';
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
function buildPrintableHtml(records, dateLabel) {
  const dateText = dateLabel || new Date().toISOString().slice(0, 10);
  const parts = [`<h1>学习记录 (${dateText})</h1>`];
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
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [openExportDialog, setOpenExportDialog] = useState(false);

  // 复制文本到剪贴板
  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
  };

  const loadHistoryByDate = async (selectedDate) => {
    if (!ipcClient.isAvailable()) {
      return;
    }
    try {
      const dbStatus = await ipcClient.checkDatabaseStatus();
      if (!dbStatus.isConnected) {
        console.error('数据库未连接');
        alert('数据库未连接，无法获取历史记录');
        return;
      }

      const records = await ipcClient.getAiQueriesByDate(selectedDate);
      if (!records || records.length === 0) {
        console.log('没有找到查询记录');
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
      setShowHistory(true);
    } catch (error) {
      console.error('获取历史记录失败:', error);
      alert('获取历史记录失败: ' + error.message);
    }
  };
  
  // 导出今日学习记录为 PDF（直接保存到本地）
  const handleExportPdf = async (selectedDate) => {
    try {
      const dbStatus = await ipcClient.checkDatabaseStatus();
      if (!dbStatus || !dbStatus.isConnected) {
        alert('数据库未连接，无法导出');
        return;
      }
      const records = await ipcClient.getAiQueriesByDate(selectedDate);
      if (!records || records.length === 0) {
        alert('当天没有学习记录可导出');
        return;
      }
      const html = buildPrintableHtml(records, selectedDate);
      const result = await ipcClient.exportLearningTodayPdf({
        html,
        title: `学习记录 ${selectedDate}`,
        suggestedName: `learning-${selectedDate}.pdf`
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
  
  const handleHistoryClick = () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setOpenHistoryDialog(true);
  };

  const handleHistoryConfirm = async () => {
    setOpenHistoryDialog(false);
    await loadHistoryByDate(historyDate);
  };

  const handleExportClick = () => {
    setOpenExportDialog(true);
  };

  const handleExportConfirm = async () => {
    setOpenExportDialog(false);
    await handleExportPdf(exportDate);
  };

  // 渲染当前对话内容
  const renderCurrentDialogue = () => {
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
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            AI助手
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<History />}
              onClick={handleHistoryClick}
              size="small"
            >
              {showHistory ? '返回对话' : '查看记录'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleExportClick}
              size="small"
            >
              导出PDF
            </Button>
          </Stack>
        </Stack>
      </Box>
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

      <Dialog open={openHistoryDialog} onClose={() => setOpenHistoryDialog(false)}>
        <DialogTitle>选择记录日期</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="日期"
            type="date"
            value={historyDate}
            onChange={(event) => setHistoryDate(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistoryDialog(false)}>取消</Button>
          <Button onClick={handleHistoryConfirm} autoFocus>开始查看记录</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openExportDialog} onClose={() => setOpenExportDialog(false)}>
        <DialogTitle>选择导出日期</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="日期"
            type="date"
            value={exportDate}
            onChange={(event) => setExportDate(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExportDialog(false)}>取消</Button>
          <Button onClick={handleExportConfirm} autoFocus>开始导出</Button>
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
