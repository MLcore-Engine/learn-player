import React from 'react';
import { Box, Typography, Grid } from '@mui/material';

export interface TimeStatsProps {
  totalTime: number;
  sessionTime: number;
  remainingSeconds?: number;
  formatTime?: (seconds: number) => string;
  smallFont?: boolean;
  horizontal?: boolean;
}

/**
 * 时间统计组件 —— 显示总时长、当前会话时长和剩余时间
 * 支持横向平铺和小字体显示
 */
const TimeStats = React.memo<TimeStatsProps>(
  ({
    totalTime,
    sessionTime,
    remainingSeconds,
    formatTime: externalFormatTime,
    smallFont = false,
    horizontal = false
  }) => {
    const formatTime =
      externalFormatTime ||
      ((seconds: number): string => {
        const totalMinutes = Math.floor((seconds || 0) / 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return [hrs.toString().padStart(2, '0'), mins.toString().padStart(2, '0')].join(':');
      });

    const remaining =
      remainingSeconds !== undefined ? remainingSeconds : Math.max(0, 1000 * 3600 - totalTime);

    const fontSize = smallFont ? '0.85rem' : '1rem';
    const captionSize = smallFont ? '0.7rem' : '0.85rem';

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

    return (
      <Box sx={{ width: '100%' }}>
        <Grid container spacing={1}>
          <Grid size={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>总时长</Typography>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 500, fontSize }}>{formatTime(totalTime)}</Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>今日</Typography>
              <Typography variant="body2" color="secondary" sx={{ fontWeight: 500, fontSize }}>{formatTime(sessionTime)}</Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: captionSize }}>剩余(1000h)</Typography>
              <Typography variant="body2" color="info.main" sx={{ fontWeight: 500, fontSize }}>{formatTime(remaining)}</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.totalTime === nextProps.totalTime &&
      prevProps.sessionTime === nextProps.sessionTime &&
      prevProps.remainingSeconds === nextProps.remainingSeconds
    );
  }
);

export default TimeStats;
