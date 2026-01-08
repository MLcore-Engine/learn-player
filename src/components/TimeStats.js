import React from 'react';
import { Box, Typography, Grid } from '@mui/material';

/**
 * 时间统计组件
 * 显示总时长、当前会话时长和剩余时间
 * 支持横向平铺和小字体显示
 */
const TimeStats = React.memo(({ totalTime, sessionTime, remainingSeconds, formatTime: externalFormatTime, smallFont = false, horizontal = false }) => {
  // 如果外部没有提供格式化函数，使用内部的
  const formatTime = externalFormatTime || ((seconds) => {
    const totalMinutes = Math.floor((seconds || 0) / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0')
    ].join(':');
  });
  
  // 计算距离1000小时还剩余的秒数（如果没有提供）
  const remaining = remainingSeconds !== undefined ? 
    remainingSeconds : Math.max(0, 1000 * 3600 - totalTime);

  // 字体缩小样式
  const fontSize = smallFont ? '0.85rem' : '1rem';
  const captionSize = smallFont ? '0.7rem' : '0.85rem';

  // 横向平铺
  if (horizontal) {
    return (
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>总时长</Typography>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 500, fontSize }}>{formatTime(totalTime)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>今日</Typography>
          <Typography variant="body2" color="secondary" sx={{ fontWeight: 500, fontSize }}>{formatTime(sessionTime)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>剩余(1000h)</Typography>
          <Typography variant="body2" color="info.main" sx={{ fontWeight: 500, fontSize }}>{formatTime(remaining)}</Typography>
        </Box>
      </Box>
    );
  }

  // 默认竖排
  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={1}>
        <Grid item xs={4}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>总时长</Typography>
            <Typography variant="body2" color="primary" sx={{ fontWeight: 500, fontSize }}>{formatTime(totalTime)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>今日</Typography>
            <Typography variant="body2" color="secondary" sx={{ fontWeight: 500, fontSize }}>{formatTime(sessionTime)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>剩余(1000h)</Typography>
            <Typography variant="body2" color="info.main" sx={{ fontWeight: 500, fontSize }}>{formatTime(remaining)}</Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}, (prevProps, nextProps) => {
  // 只有在时间值变化时才重新渲染
  return prevProps.totalTime === nextProps.totalTime && 
         prevProps.sessionTime === nextProps.sessionTime &&
         prevProps.remainingSeconds === nextProps.remainingSeconds;
  // 格式化函数通常是稳定的回调，不需要比较
});

export default TimeStats; 