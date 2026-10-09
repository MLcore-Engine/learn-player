import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Paper, Stack, Grid } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import { ipcClient } from '../../services/ipcClient';
import { useTimeStats } from '../../contexts/AppContext';
import { buildMasteryDistribution, calcMasteryRate, formatDuration } from '../../utils/learningStats';
import type { HighlightsStats, HighlightDailyCount } from '../../types/highlight';

type Phase = 'loading' | 'ready' | 'error';

const LEVEL_COLOR: Record<string, string> = {
  learning: 'warning.main',
  reviewed: 'info.main',
  mastered: 'success.main',
  archived: 'text.disabled'
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
    <Typography variant="h5" color="primary.main" sx={{ fontWeight: 600 }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Paper>
);

const BarChart: React.FC<{ data: HighlightDailyCount[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
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

const MasteryBar: React.FC<{ stats: HighlightsStats | null }> = ({ stats }) => {
  const { total, segments } = buildMasteryDistribution(stats);
  const rate = calcMasteryRate(stats);
  const visible = segments.filter((s) => s.count > 0);

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        还没有学习数据，去点几个单词试试吧。
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={0.5} sx={{ height: 12, borderRadius: 6, overflow: 'hidden' }}>
        {visible.map((s) => (
          <Box
            key={s.level}
            sx={{ width: `${s.percent}%`, bgcolor: LEVEL_COLOR[s.level] }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        {segments.map((s) => (
          <Stack key={s.level} direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: LEVEL_COLOR[s.level] }} />
            <Typography variant="caption" color="text.secondary">
              {s.label} {s.count}（{s.percent}%）
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        掌握率 {rate}%
      </Typography>
    </Stack>
  );
};

export interface StatsTabProps {
  onBackToSubtitle?: () => void;
}

const StatsTab: React.FC<StatsTabProps> = ({ onBackToSubtitle }) => {
  const { totalTime, sessionTime } = useTimeStats();
  const [phase, setPhase] = useState<Phase>('loading');
  const [stats, setStats] = useState<HighlightsStats | null>(null);
  const [trend, setTrend] = useState<HighlightDailyCount[]>([]);
  const [error, setError] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    setPhase('loading');
    setError('');
    try {
      const [statsResult, trendResult] = await Promise.all([
        ipcClient.getHighlightsStats(),
        ipcClient.getHighlightsDailyCount({ days: 7 })
      ]);
      if (statsResult && statsResult.error) throw new Error(statsResult.error);
      if (trendResult && 'error' in trendResult && trendResult.error) throw new Error(trendResult.error);
      setStats(statsResult || null);
      setTrend(Array.isArray(trendResult) ? trendResult : []);
      setPhase('ready');
    } catch (e) {
      console.error('StatsTab 加载失败:', e);
      setError((e as Error).message || '加载失败');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const todayNew = trend.length > 0 ? trend[trend.length - 1].count : 0;

  const renderBody = (): React.ReactNode => {
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
        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="总词数" value={stats?.totalHighlights ?? 0} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="今日新增" value={todayNew} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="今日复习" value={stats?.todayReviewed ?? 0} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="待复习" value={stats?.pendingHighlights ?? 0} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="已掌握" value={stats?.masteredHighlights ?? 0} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="连续天数" value={stats?.streakDays ?? 0} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}><StatCard label="视频数" value={stats?.totalVideos ?? 0} /></Grid>
        </Grid>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>掌握度分布</Typography>
          <MasteryBar stats={stats} />
        </Paper>

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
