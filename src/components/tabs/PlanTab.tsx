import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Alert, Chip, LinearProgress } from '@mui/material';
import { ArrowBack, Refresh, AutoAwesome, Bolt, CheckCircle } from '@mui/icons-material';
import studyPlanService from '../../services/studyPlanService';
import { calcPlanDayIndex, calcPlanProgress } from '../../utils/learningStats';
import type { StudyPlanRow, StructuredPlan, PlanSource } from '../../types/plan';

type Phase = 'loading' | 'ready' | 'generating' | 'error';
type PlanMode = 'ai' | 'template';

// 前端展示用的 plan 形态 —— 兼容 getCurrentStudyPlan 返回的 StudyPlanRow
// 和 generateStudyPlan 返回的 {planText, plan, days, createdAt}
interface DisplayPlan {
  plan_data?: string;
  structuredPlan?: StructuredPlan | null;
  days?: number;
  created_at?: string;
  progress?: number;
}

const renderPlanText = (text: string | undefined): React.ReactNode => (
  <Box
    sx={{
      whiteSpace: 'pre-wrap',
      lineHeight: 1.7,
      fontSize: '0.95rem',
      '& strong': { color: 'primary.main' }
    }}
    dangerouslySetInnerHTML={{
      __html: (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>')
    }}
  />
);

export interface PlanTabProps {
  onBackToSubtitle?: () => void;
}

const PlanTab: React.FC<PlanTabProps> = ({ onBackToSubtitle }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [plan, setPlan] = useState<DisplayPlan | null>(null);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<PlanMode>('ai');
  const [notice, setNotice] = useState<string>('');
  const [planSource, setPlanSource] = useState<PlanSource | null>(null);
  const [dayIndex, setDayIndex] = useState(1);
  const [progress, setProgress] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);

  const loadCurrent = useCallback(async (): Promise<void> => {
    setPhase('loading');
    setError('');
    try {
      const result = (await studyPlanService.getCurrentStudyPlan()) as StudyPlanRow | null;
      setPlan(result || null);
      setPlanSource(result?.structuredPlan?.source ?? null);
      applyPlanSchedule(result || null);
      setPhase('ready');
    } catch (e) {
      console.error('PlanTab 加载失败:', e);
      setError((e as Error).message || '加载失败');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  /** 由 created_at 推算当前是第几天，并同步进度条 */
  const applyPlanSchedule = useCallback((p: DisplayPlan | null): void => {
    const days = p?.days ?? 7;
    const idx = calcPlanDayIndex(p?.created_at, days);
    const pct = typeof p?.progress === 'number' ? p.progress : calcPlanProgress(idx, days);
    setDayIndex(idx);
    setProgress(Math.min(Math.max(pct, 0), 100));
  }, []);

  const handleGenerate = async (): Promise<void> => {
    setPhase('generating');
    setError('');
    setNotice('');
    try {
      const result = await studyPlanService.generateStudyPlan({ days: 7, focus: 'comprehensive', source: mode });
      const next: DisplayPlan = {
        plan_data: result.planText,
        structuredPlan: result.plan,
        days: result.days,
        created_at: result.createdAt
      };
      setPlan(next);
      setPlanSource(result.source);
      applyPlanSchedule(next);
      if (result.source === 'template' && mode === 'ai' && result.fallbackReason) {
        setNotice(`AI 生成失败，已回退到模板计划：${result.fallbackReason}`);
      }
      setPhase('ready');
    } catch (e) {
      console.error('生成计划失败:', e);
      setError((e as Error).message || '生成失败');
      setPhase('error');
    }
  };

  const handleMarkTodayDone = async (): Promise<void> => {
    setSavingProgress(true);
    try {
      await studyPlanService.updatePlanProgress({ progress: calcPlanProgress(dayIndex, plan?.days ?? 7) });
      setProgress(calcPlanProgress(dayIndex, plan?.days ?? 7));
      setNotice(`已记录第 ${dayIndex} 天完成，继续保持！`);
    } catch (e) {
      console.error('更新计划进度失败:', e);
      setError((e as Error).message || '更新进度失败');
    } finally {
      setSavingProgress(false);
    }
  };

  const modeSelector = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={mode}
      onChange={(_e, next: PlanMode | null) => {
        if (next) setMode(next);
      }}
    >
      <ToggleButton value="ai">
        <AutoAwesome fontSize="small" sx={{ mr: 0.5 }} /> AI 生成
      </ToggleButton>
      <ToggleButton value="template">
        <Bolt fontSize="small" sx={{ mr: 0.5 }} /> 快速模板
      </ToggleButton>
    </ToggleButtonGroup>
  );

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
          <Typography color="error">{error}</Typography>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadCurrent}>重试</Button>
        </Stack>
      );
    }
    if (phase === 'generating') {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, flexDirection: 'column', gap: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">正在生成计划...</Typography>
        </Box>
      );
    }

    if (!plan) {
      return (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 2 }}>还没有学习计划</Typography>
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 2 }}>
            {modeSelector}
          </Stack>
          <Button variant="contained" startIcon={<AutoAwesome />} onClick={handleGenerate}>
            生成 7 天计划
          </Button>
        </Paper>
      );
    }

    return (
      <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
        {notice && (
          <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setNotice('')}>
            {notice}
          </Alert>
        )}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">当前计划（{plan.days || 7} 天）</Typography>
              {planSource && (
                <Chip
                  size="small"
                  data-testid="plan-source-chip"
                  color={planSource === 'ai' ? 'primary' : 'default'}
                  icon={planSource === 'ai' ? <AutoAwesome /> : <Bolt />}
                  label={planSource === 'ai' ? 'AI 生成' : '模板生成'}
                />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : ''}
            </Typography>
          </Stack>
          {renderPlanText(plan.plan_data)}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">
              第 {dayIndex} / {plan.days || 7} 天
            </Typography>
            <Typography variant="caption" color="text.secondary">{progress}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 1.5, height: 8, borderRadius: 4 }} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<CheckCircle />}
            disabled={savingProgress || progress >= 100}
            onClick={handleMarkTodayDone}
          >
            {savingProgress ? '保存中...' : progress >= 100 ? '计划已完成' : '标记今天已完成'}
          </Button>
        </Paper>

        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mt: 2 }}>
          {modeSelector}
          <Button size="small" variant="outlined" startIcon={<AutoAwesome />} onClick={handleGenerate}>
            重新生成
          </Button>
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">计划</Typography>
        <Button size="small" startIcon={<Refresh />} onClick={loadCurrent}>刷新</Button>
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

export default PlanTab;
