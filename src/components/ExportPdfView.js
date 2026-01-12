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

// HTML 转义：避免 AI 文本里的 < > 等被当成标签导致内容“消失”
function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 将富文本(**, `code`)转为简单HTML
function toHtml(text) {
  // 先转义，防止内容注入/解析成 HTML 标签
  const safe = escapeHtml(text || '');
  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

// 构建可打印HTML
function buildPrintableHtml(records, dateLabel) {
  const dateText = dateLabel || new Date().toISOString().slice(0, 10);
  const parts = [`<h1>学习记录 (${escapeHtml(dateText)})</h1>`];
  
  // 去重：按 query 去重，保留第一条记录
  const uniqueRecords = [];
  const seenQueries = new Set();
  for (const rec of records || []) {
    const q = (rec.query || '').trim().toLowerCase();
    // 如果有 query 则去重，否则直接保留
    if (q) {
      if (!seenQueries.has(q)) {
        seenQueries.add(q);
        uniqueRecords.push(rec);
      }
    } else {
      // query 为空但有 explanation 的也保留
      if (rec.explanation || rec.text) {
        uniqueRecords.push(rec);
      }
    }
  }
  
  console.log('【buildPrintableHtml】去重后记录数:', uniqueRecords.length);
  
  for (const rec of uniqueRecords) {
    const q = (rec.query || '').trim();
    const rawExplanation = rec.explanation || rec.text || '';
    console.log('【buildPrintableHtml】处理记录:', q, '解释长度:', rawExplanation.length);
    
    const cleaned = clean(rawExplanation);
    let body = toHtml(cleaned);
    
    // 高亮音标：将 /.../ 包裹并着色
    try {
      body = body.replace(/\/([^/<>\n:]{1,40})\//g, '<span class="phonetic">/$1/</span>');
    } catch (_) {
      // 忽略正则错误
    }
    
    if (!q && !body) {
      console.log('【buildPrintableHtml】跳过空记录');
      continue;
    }
    
    parts.push(`<div class="record">`);
    if (q) parts.push(`<h2>${escapeHtml(q)}</h2>`);
    if (body) parts.push(`<div class="content">${body}</div>`);
    parts.push(`</div>`);
  }
  
  console.log('【buildPrintableHtml】最终生成的HTML长度:', parts.join('').length);
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
      const records = await ipcClient.getAiQueriesByDate(selectedDate);
      console.log('【PDF导出】获取到记录数:', records?.length);
      console.log('【PDF导出】记录样例:', records?.[0]);
      
      if (!records || records.length === 0) {
        showWarning('当天没有学习记录可导出');
        return;
      }
      
      const html = buildPrintableHtml(records, selectedDate);
      console.log('【PDF导出】生成的HTML长度:', html?.length);
      console.log('【PDF导出】HTML预览:', html?.slice(0, 300));
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
