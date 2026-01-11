import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import DateWheelPicker from './DateWheelPicker';
import { useMessage } from '../contexts/MessageContext';
import { ipcClient } from '../services/ipcClient';

// 清理文本中的特殊标记
const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/**
 * 查看记录组件
 * 根据日期查询当日学习过的单词记录
 */
const HistoryView = React.memo(() => {
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [chatHistory, setChatHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showError } = useMessage();

  const loadHistoryByDate = async (selectedDate) => {
    if (!ipcClient.isAvailable()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const dbStatus = await ipcClient.checkDatabaseStatus();
      if (!dbStatus.isConnected) {
        console.error('数据库未连接');
        showError('数据库未连接，无法获取历史记录');
        return;
      }

      const records = await ipcClient.getAiQueriesByDate(selectedDate);
      if (!records || records.length === 0) {
        console.log('没有找到查询记录');
        setChatHistory([]);
      } else {
        console.log('获取到查询记录:', records.length, '条');
        setChatHistory(records.map(rec => ({
          id: rec.id,
          query: rec.query,
          text: rec.explanation,
          created_at: rec.created_at
        })));
      }
      setHistoryLoaded(true);
    } catch (error) {
      console.error('获取历史记录失败:', error);
      showError('获取历史记录失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 处理日期变化
  const handleDateChange = (newDate) => {
    setHistoryDate(newDate);
    setHistoryLoaded(false);
  };

  // 渲染历史记录列表
  const renderHistory = () => {
    if (chatHistory.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          当天没有学习记录
        </Typography>
      );
    }

    return (
      <List>
        {chatHistory.map((message, index) => (
          <ListItem 
            key={index} 
            alignItems="flex-start"
            sx={{ 
              borderRadius: 2,
              mb: 2,
              p: 2,
              backgroundColor: '#FAF5E4',
              border: '1px solid #E8E0C8',
              '&:hover': {
                backgroundColor: '#F5EFD7'
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
                        backgroundColor: '#F0E8D0',
                        padding: '2px 6px',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.95rem',
                        border: '1px solid #E0D8C0'
                      }
                    }}
                    dangerouslySetInnerHTML={{
                      __html: clean(message.text)
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.+?)`/g, '<code>$1</code>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
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
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <DateWheelPicker
            value={historyDate}
            onChange={handleDateChange}
            label="选择查询日期"
            disableFuture={true}
          />
          <Button 
            variant="contained" 
            onClick={() => loadHistoryByDate(historyDate)}
            disabled={loading}
          >
            {loading ? '加载中...' : '查询记录'}
          </Button>
        </Stack>
      </Box>
      
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        px: 2,
        pb: 2
      }}>
        {historyLoaded ? renderHistory() : (
          <Typography variant="body2" color="text.secondary" align="center">
            选择日期后点击"查询记录"查看当天的学习内容
          </Typography>
        )}
      </Box>
    </Card>
  );
});

export default HistoryView; 
