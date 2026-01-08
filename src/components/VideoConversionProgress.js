import React, { useState, useEffect } from 'react';
import { LinearProgress, Typography, Box, Paper, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

/**
 * 视频转换进度显示组件
 */
const VideoConversionProgress = ({ isVisible, onCancel }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('准备中...');
  const [currentFile, setCurrentFile] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  useEffect(() => {
    if (!isVisible) return;

    // 监听转换进度事件
    const handleProgress = (event, progressData) => {
      console.log('转换进度:', progressData);

      // 解析进度数据
      if (progressData.percent) {
        setProgress(progressData.percent);
      } else if (progressData.timemark) {
        // 从时间戳估算进度（需要知道总时长）
        // 这里可以根据实际情况调整
        setProgress(Math.min(95, Math.random() * 90 + 5)); // 临时方案
      }

      if (progressData.inputPath) {
        const fileName = progressData.inputPath.split('/').pop() || progressData.inputPath.split('\\').pop();
        setCurrentFile(fileName);
      }

      // 更新状态信息
      if (progressData.fps) {
        setStatus(`转换中... ${progressData.fps} fps`);
      } else {
        setStatus('转换中...');
      }

      // 估算剩余时间
      if (progressData.timemark && progressData.timemark !== '00:00:00.00') {
        // 这里需要总时长信息才能准确计算
        // 暂时显示处理时间
        setEstimatedTime(`已处理: ${progressData.timemark}`);
      }
    };

    // 监听转换完成事件
    const handleConversionComplete = (event, result) => {
      if (result.success) {
        setProgress(100);
        setStatus('转换完成');
        setTimeout(() => {
          onCancel && onCancel();
        }, 2000);
      } else {
        setStatus(`转换失败: ${result.error}`);
        setProgress(0);
      }
    };

    // 注册事件监听器
    window.electronAPI?.on?.('conversion-progress', handleProgress);
    window.electronAPI?.on?.('conversion-complete', handleConversionComplete);

    // 清理函数
    return () => {
      window.electronAPI?.removeAllListeners?.('conversion-progress');
      window.electronAPI?.removeAllListeners?.('conversion-complete');
    };
  }, [isVisible, onCancel]);

  if (!isVisible) return null;

  return (
    <ProgressOverlay>
      <ProgressContainer elevation={6}>
        <Typography variant="h6" gutterBottom>
          视频格式转换
        </Typography>

        {currentFile && (
          <Box mb={2}>
            <Chip
              label={`文件: ${currentFile}`}
              variant="outlined"
              size="small"
              sx={{ maxWidth: '100%' }}
            />
          </Box>
        )}

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {status}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {Math.round(progress)}% 完成
          </Typography>
        </Box>

        {estimatedTime && (
          <Typography variant="caption" color="text.secondary">
            {estimatedTime}
          </Typography>
        )}
      </ProgressContainer>
    </ProgressOverlay>
  );
};

// 样式组件
const ProgressOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
}));

const ProgressContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  minWidth: 400,
  maxWidth: 600,
  textAlign: 'center',
}));

export default VideoConversionProgress;
