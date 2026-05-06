import React, { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Paper, Stack } from '@mui/material';
import { ArrowBack, Refresh, AutoAwesome } from '@mui/icons-material';
import studyPlanService from '../../services/studyPlanService';

const renderPlanText = (text) => (
  <Box
    sx={{
      whiteSpace: 'pre-wrap',
      lineHeight: 1.7,
      fontSize: '0.95rem',
      '& strong': { color: 'primary.main' }
    }}
    dangerouslySetInnerHTML={{
      __html: (text || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>')
    }}
  />
);

const PlanTab = ({ onBackToSubtitle }) => {
  const [phase, setPhase] = useState('loading'); // loading | ready | generating | error
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  const loadCurrent = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const result = await studyPlanService.getCurrentStudyPlan();
      if (result && result.error) throw new Error(result.error);
      setPlan(result || null);
      setPhase('ready');
    } catch (e) {
      console.error('PlanTab 加载失败:', e);
      setError(e.message || '加载失败');
      setPhase('error');
    }
  }, []);

  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  const handleGenerate = async () => {
    setPhase('generating');
    setError('');
    try {
      const result = await studyPlanService.generateStudyPlan({ days: 7, focus: 'comprehensive' });
      // 服务返回 {planText, plan, days, createdAt}；统一形态成 plan_data + structuredPlan 以匹配 getCurrentStudyPlan 的形态
      setPlan({
        plan_data: result.planText,
        structuredPlan: result.plan,
        days: result.days,
        created_at: result.createdAt
      });
      setPhase('ready');
    } catch (e) {
      console.error('生成计划失败:', e);
      setError(e.message || '生成失败');
      setPhase('error');
    }
  };

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
          <Button variant="contained" startIcon={<AutoAwesome />} onClick={handleGenerate}>
            生成 7 天计划
          </Button>
        </Paper>
      );
    }

    return (
      <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">
              当前计划（{plan.days || 7} 天）
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : ''}
            </Typography>
          </Stack>
          {renderPlanText(plan.plan_data)}
        </Paper>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesome />}
            onClick={handleGenerate}
          >
            重新生成
          </Button>
        </Box>
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
