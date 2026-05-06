import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Paper, Stack, Grid } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import { ipcClient } from '../../services/ipcClient';
import { useTimeStats } from '../../contexts/AppContext';

// 格式化秒为 "Xh Ym" 或 "Ym" — 与 TimeStats 组件一致的最小实现
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const StatCard = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
    <Typography variant="h5" color="primary.main" sx={{ fontWeight: 600 }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Paper>
);

// 纯 CSS 柱状图
const BarChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120, px: 1 }}>
      {data.map(({ date, count }) => {
        const h = Math.round((count / max) * 100);
        const dayLabel = date.slice(5); // MM-DD
        return (
          <Box key={date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <Box sx={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <Box
                sx={{
                  width: '100%',
                  height: `${h}%`,
                  minHeight: count > 0 ? 2 : 0,
                  bgcolor: count > 0 ? 'primary.main' : 'action.disabledBackground',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.3s'
                }}
                title={`${date}: ${count}`}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.65rem' }}>
              {dayLabel}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: count > 0 ? 'primary.main' : 'text.disabled' }}>
              {count}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

const StatsTab = ({ onBackToSubtitle }) => {
  const { totalTime, sessionTime } = useTimeStats();
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const [statsResult, trendResult] = await Promise.all([
        ipcClient.getHighlightsStats(),
        ipcClient.getHighlightsDailyCount({ days: 7 })
      ]);
      if (statsResult && statsResult.error) throw new Error(statsResult.error);
      if (trendResult && trendResult.error) throw new Error(trendResult.error);
      setStats(statsResult || null);
      setTrend(Array.isArray(trendResult) ? trendResult : []);
      setPhase('ready');
    } catch (e) {
      console.error('StatsTab 加载失败:', e);
      setError(e.message || '加载失败');
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayNew = trend.length > 0 ? trend[trend.length - 1].count : 0;

  const renderBody = () => {
    if (phase === 'loading') {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>
      );
    }
    if (phase === 'error') {
      return (
        <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Typography color="error">加载失败：{error}</Typography>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>重试</Button>
        </Stack>
      );
    }

    return (
      <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
        {/* 计数卡片 */}
        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={4}><StatCard label="总词数" value={stats?.totalHighlights ?? 0} /></Grid>
          <Grid item xs={6} sm={4}><StatCard label="今日新增" value={todayNew} /></Grid>
          <Grid item xs={6} sm={4}><StatCard label="今日复习" value={stats?.todayReviewed ?? 0} /></Grid>
          <Grid item xs={6} sm={4}><StatCard label="已掌握" value={stats?.masteredHighlights ?? 0} /></Grid>
          <Grid item xs={6} sm={4}><StatCard label="连续天数" value={stats?.streakDays ?? 0} /></Grid>
          <Grid item xs={6} sm={4}><StatCard label="视频数" value={stats?.totalVideos ?? 0} /></Grid>
        </Grid>

        {/* 学习时长 */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>学习时长</Typography>
          <Stack direction="row" spacing={3}>
            <Box>
              <Typography variant="caption" color="text.secondary">总时长</Typography>
              <Typography variant="h6">{formatDuration(totalTime)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">今日</Typography>
              <Typography variant="h6">{formatDuration(sessionTime)}</Typography>
            </Box>
          </Stack>
        </Paper>

        {/* 7 天趋势 */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>最近 7 天新增词汇</Typography>
          <BarChart data={trend} />
        </Paper>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">统计</Typography>
        <Button size="small" startIcon={<Refresh />} onClick={load}>刷新</Button>
      </Stack>
      {renderBody()}
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

export default StatsTab;
