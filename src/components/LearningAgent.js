import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  Analytics,
  Assignment,
  School,
  TrendingUp,
  AccessTime,
  AutoAwesome,
  Refresh,
  PlayArrow,
  Close,
  CheckCircle,
  Cancel,
  Help
} from '@mui/icons-material';
import learningAnalyticsService from '../services/learningAnalyticsService';
import studyPlanService from '../services/studyPlanService';
import spacedRepetitionService from '../services/spacedRepetitionService';
import { ipcClient } from '../services/ipcClient';
import { useMessage } from '../contexts/MessageContext';

// 清理文本中的特殊标记
const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/**
 * 学习Agent组件
 * 整合学习分析、学习计划和背单词功能
 */
const LearningAgent = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError, showInfo } = useMessage();
  
  // 学习分析状态
  const [overview, setOverview] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [report, setReport] = useState(null);
  
  // 学习计划状态
  const [studyPlan, setStudyPlan] = useState(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  
  // 背单词状态
  const [reviewWords, setReviewWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [vocabStats, setVocabStats] = useState(null);
  const [extractingWords, setExtractingWords] = useState(false);

  // 初始化：加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 加载学习数据
  const loadData = async () => {
    if (!ipcClient.isAvailable()) return;
    
    setLoading(true);
    try {
      // 加载学习概况
      const overviewData = await learningAnalyticsService.getLearningOverview();
      setOverview(overviewData);
      
      // 加载学习模式
      const patternData = await learningAnalyticsService.analyzeLearningPattern();
      setPattern(patternData);
      
      // 加载学习报告
      const reportData = await learningAnalyticsService.getLearningReport({ days: 7 });
      setReport(reportData);
      
      // 加载当前学习计划
      const planData = await studyPlanService.getCurrentStudyPlan();
      setStudyPlan(planData);
      
      // 加载词汇统计
      const statsData = await spacedRepetitionService.getLearningStats();
      setVocabStats(statsData);
      
      // 加载需要复习的单词
      await loadReviewWords();
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载复习单词
  const loadReviewWords = async () => {
    if (!ipcClient.isAvailable()) return;
    
    try {
      const words = await spacedRepetitionService.getWordsToReview(20);
      setReviewWords(words || []);
      setCurrentWordIndex(0);
      setShowAnswer(false);
    } catch (error) {
      console.error('加载复习单词失败:', error);
    }
  };

  // 生成学习计划
  const handleGeneratePlan = async () => {
    if (!ipcClient.isAvailable()) return;
    
    setGeneratingPlan(true);
    try {
      const result = await studyPlanService.generateStudyPlan({
        days: 7,
        focus: 'comprehensive'
      });
      
      setStudyPlan({
        planData: result.planText,
        structuredPlan: result.plan,
        days: 7,
        createdAt: new Date().toISOString()
      });
      
      showSuccess('学习计划生成成功！');
    } catch (error) {
      console.error('生成学习计划失败:', error);
      showError('生成学习计划失败: ' + error.message);
    } finally {
      setGeneratingPlan(false);
    }
  };

  // 提交复习结果
  const handleSubmitReview = async (quality) => {
    if (!ipcClient.isAvailable() || reviewWords.length === 0) return;
    
    const currentWord = reviewWords[currentWordIndex];
    if (!currentWord) return;
    
    try {
      await spacedRepetitionService.submitReview(currentWord.id, quality);
      
      // 移动到下一个单词
      if (currentWordIndex < reviewWords.length - 1) {
        setCurrentWordIndex(currentWordIndex + 1);
        setShowAnswer(false);
      } else {
        // 复习完成，重新加载
        await loadReviewWords();
        showSuccess('本轮复习完成！');
      }
      
      // 更新统计
      const statsData = await spacedRepetitionService.getLearningStats();
      setVocabStats(statsData);
    } catch (error) {
      console.error('提交复习结果失败:', error);
      showError('提交失败: ' + error.message);
    }
  };

  // 从查询记录提取单词
  const handleExtractWords = async () => {
    if (!ipcClient.isAvailable()) return;
    
    setExtractingWords(true);
    try {
      const result = await spacedRepetitionService.extractWordsFromQueries(50);
      showSuccess(`成功提取 ${result} 个单词到学习列表！`);
      await loadReviewWords();
      const statsData = await spacedRepetitionService.getLearningStats();
      setVocabStats(statsData);
    } catch (error) {
      console.error('提取单词失败:', error);
      showError('提取单词失败: ' + error.message);
    } finally {
      setExtractingWords(false);
    }
  };

  // 格式化时间
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  };

  // 渲染学习分析标签页
  const renderAnalyticsTab = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <Box>
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            <Analytics sx={{ mr: 1, verticalAlign: 'middle' }} />
            学习概况
          </Typography>
          {overview && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>总学习时长</Typography>
                    <Typography variant="h5">{formatTime(overview.totalTime || 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>总查询单词</Typography>
                    <Typography variant="h5">{overview.totalQueries || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>学习天数</Typography>
                    <Typography variant="h5">{overview.activeDays || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>今日查询</Typography>
                    <Typography variant="h5">{overview.todayQueries || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>

        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
            学习模式分析
          </Typography>
          {pattern && (
            <Card sx={{ mt: 1 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography color="textSecondary">最活跃时段</Typography>
                    <Typography variant="h6">{pattern.mostActiveHour || '暂无数据'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography color="textSecondary">学习频率</Typography>
                    <Chip 
                      label={pattern.frequency || '未知'} 
                      color={pattern.frequency === '高频' ? 'success' : pattern.frequency === '中频' ? 'warning' : 'default'}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography color="textSecondary">最近趋势</Typography>
                    <Chip 
                      label={pattern.recentTrend || '稳定'} 
                      color={pattern.recentTrend === '上升' ? 'success' : pattern.recentTrend === '下降' ? 'error' : 'default'}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            <AccessTime sx={{ mr: 1, verticalAlign: 'middle' }} />
            最近7天学习报告
          </Typography>
          {report && (
            <Card sx={{ mt: 1 }}>
              <CardContent>
                <Typography variant="body1">
                  查询次数: {report.totalQueries || 0} 次
                </Typography>
                <Typography variant="body1">
                  活跃天数: {report.activeDays || 0} 天
                </Typography>
                {report.dailyStats && report.dailyStats.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>每日查询统计</Typography>
                    <List>
                      {report.dailyStats.map((stat, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={stat.date}
                            secondary={`${stat.count} 次查询`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
          >
            刷新数据
          </Button>
        </Box>
      </Box>
    );
  };

  // 渲染学习计划标签页
  const renderStudyPlanTab = () => {
    return (
      <Box>
        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
            学习计划
          </Typography>
          <Button
            variant="contained"
            startIcon={generatingPlan ? <CircularProgress size={16} /> : <AutoAwesome />}
            onClick={handleGeneratePlan}
            disabled={generatingPlan}
          >
            {generatingPlan ? '生成中...' : '生成新计划'}
          </Button>
        </Box>

        {studyPlan ? (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                计划时长: {studyPlan.days} 天
              </Typography>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                创建时间: {new Date(studyPlan.created_at).toLocaleString('zh-CN')}
              </Typography>
              {studyPlan.progress !== undefined && (
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    进度: {studyPlan.progress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={studyPlan.progress} />
                </Box>
              )}
              <Box sx={{ mt: 2 }}>
                <Typography 
                  variant="body1" 
                  component="div"
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    '& strong': { color: 'primary.main' }
                  }}
                  dangerouslySetInnerHTML={{
                    __html: clean(studyPlan.plan_data || '')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Alert severity="info">
            还没有学习计划，点击"生成新计划"按钮创建个性化学习计划。
          </Alert>
        )}
      </Box>
    );
  };

  // 渲染背单词标签页
  const renderVocabularyTab = () => {
    const currentWord = reviewWords[currentWordIndex];
    
    return (
      <Box>
        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            <School sx={{ mr: 1, verticalAlign: 'middle' }} />
            背单词（间隔重复）
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={extractingWords ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleExtractWords}
              disabled={extractingWords}
              sx={{ mr: 1 }}
            >
              {extractingWords ? '提取中...' : '从查询记录提取单词'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadReviewWords}
            >
              刷新
            </Button>
          </Box>
        </Box>

        {vocabStats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>总单词数</Typography>
                  <Typography variant="h5">{vocabStats.total || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>待复习</Typography>
                  <Typography variant="h5">{vocabStats.dueCount || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>已掌握</Typography>
                  <Typography variant="h5">{vocabStats.masteredCount || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>今日复习</Typography>
                  <Typography variant="h5">{vocabStats.recentReviews || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {reviewWords.length === 0 ? (
          <Alert severity="info">
            当前没有需要复习的单词。可以从查询记录中提取单词，或者手动添加单词到学习列表。
          </Alert>
        ) : currentWord ? (
          <Card>
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="textSecondary">
                  {currentWordIndex + 1} / {reviewWords.length}
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h3" gutterBottom>
                  {currentWord.word}
                </Typography>
                {currentWord.phonetic && (
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {currentWord.phonetic}
                  </Typography>
                )}
              </Box>

              {showAnswer ? (
                <Box>
                  {currentWord.meaning && (
                    <Typography variant="h6" gutterBottom>
                      含义: {currentWord.meaning}
                    </Typography>
                  )}
                  {currentWord.example && (
                    <Typography variant="body1" gutterBottom>
                      例句: {currentWord.example}
                    </Typography>
                  )}
                  {currentWord.explanation && (
                    <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                      <Typography 
                        variant="body2" 
                        component="div"
                        dangerouslySetInnerHTML={{
                          __html: clean(currentWord.explanation)
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/`(.+?)`/g, '<code>$1</code>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    </Paper>
                  )}
                  
                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Cancel />}
                      onClick={() => handleSubmitReview(0)}
                    >
                      重来
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => handleSubmitReview(1)}
                    >
                      困难
                    </Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => handleSubmitReview(2)}
                    >
                      良好
                    </Button>
                    <Button
                      variant="outlined"
                      color="success"
                      startIcon={<CheckCircle />}
                      onClick={() => handleSubmitReview(3)}
                    >
                      简单
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrow />}
                    onClick={() => setShowAnswer(true)}
                  >
                    显示答案
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        ) : null}
      </Box>
    );
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab icon={<Analytics />} label="学习分析" />
          <Tab icon={<Assignment />} label="学习计划" />
          <Tab icon={<School />} label="背单词" />
        </Tabs>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        {tabValue === 0 && renderAnalyticsTab()}
        {tabValue === 1 && renderStudyPlanTab()}
        {tabValue === 2 && renderVocabularyTab()}
      </Box>
    </Card>
  );
};

export default LearningAgent;
