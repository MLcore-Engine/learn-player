import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import DateWheelPicker from './DateWheelPicker';
import { useMessage } from '../contexts/MessageContext';
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
    // 高亮音标：将 /.../ 包裹并着色
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

/**
 * 导出PDF组件
 * 根据日期导出当日学习记录为PDF
 */
const ExportPdfView = React.memo(() => {
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);
  const { showSuccess, showWarning, showError } = useMessage();

  // 导出学习记录为 PDF
  const handleExportPdf = async (selectedDate) => {
    setExporting(true);
    
    try {
      const dbStatus = await ipcClient.checkDatabaseStatus();
      if (!dbStatus || !dbStatus.isConnected) {
        showError('数据库未连接，无法导出');
        return;
      }
      
      const records = await ipcClient.getAiQueriesByDate(selectedDate);
      if (!records || records.length === 0) {
        showWarning('当天没有学习记录可导出');
        return;
      }
      
      const html = buildPrintableHtml(records, selectedDate);
      const result = await ipcClient.exportLearningTodayPdf({
        html,
        title: `学习记录 ${selectedDate}`,
        suggestedName: `learning-${selectedDate}.pdf`
      });
      
      if (result && result.success) {
        showSuccess('已保存到: ' + result.filePath);
      } else if (result && result.canceled) {
        // 用户取消保存
      } else {
        showError('导出失败: ' + (result?.error || '未知错误'));
      }
    } catch (e) {
      console.error('导出 PDF 失败:', e);
      showError('导出 PDF 失败: ' + (e?.message || e));
    } finally {
      setExporting(false);
    }
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
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <DateWheelPicker
            value={exportDate}
            onChange={setExportDate}
            label="选择导出日期"
            disableFuture={true}
          />
          <Button 
            variant="contained" 
            onClick={() => handleExportPdf(exportDate)}
            disabled={exporting}
          >
            {exporting ? '导出中...' : '导出PDF'}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          选择日期后点击"导出PDF"将当天的学习记录保存为PDF文件
        </Typography>
      </Box>
    </Card>
  );
});

export default ExportPdfView; 
