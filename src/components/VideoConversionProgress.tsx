import React, { useState, useEffect } from 'react';
import { LinearProgress, Typography, Box, Paper, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ipcClient } from '../services/ipcClient';

export interface VideoConversionProgressProps {
  isVisible: boolean;
  onCancel?: () => void;
}

interface ProgressPayload {
  percent?: number;
  timemark?: string;
  inputPath?: string;
  fps?: number;
}

interface ConversionCompletePayload {
  success: boolean;
  error?: string;
}

const VideoConversionProgress: React.FC<VideoConversionProgressProps> = ({ isVisible, onCancel }) => {
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('准备中...');
  const [currentFile, setCurrentFile] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  useEffect(() => {
    if (!isVisible) return;

    const handleProgress = (...args: unknown[]): void => {
      const progressData = args[0] as ProgressPayload | undefined;
      if (!progressData) return;
      console.log('转换进度:', progressData);

      if (typeof progressData.percent === 'number') {
        setProgress(progressData.percent);
      } else if (progressData.timemark) {
        setProgress(Math.min(95, Math.random() * 90 + 5));
      }

      if (progressData.inputPath) {
        const fileName =
          progressData.inputPath.split('/').pop() ||
          progressData.inputPath.split('\\').pop() ||
          '';
        setCurrentFile(fileName);
      }

      if (progressData.fps) {
        setStatus(`转换中... ${progressData.fps} fps`);
      } else {
        setStatus('转换中...');
      }

      if (progressData.timemark && progressData.timemark !== '00:00:00.00') {
        setEstimatedTime(`已处理: ${progressData.timemark}`);
      }
    };

    const handleConversionComplete = (...args: unknown[]): void => {
      const result = args[0] as ConversionCompletePayload | undefined;
      if (!result) return;
      if (result.success) {
        setProgress(100);
        setStatus('转换完成');
        setTimeout(() => {
          onCancel && onCancel();
        }, 2000);
      } else {
        setStatus(`转换失败: ${result.error ?? '未知错误'}`);
        setProgress(0);
      }
    };

    const cleanupProgress = ipcClient.onConversionProgress(handleProgress);
    const cleanupComplete = ipcClient.onConversionComplete(handleConversionComplete);

    return () => {
      if (cleanupProgress) cleanupProgress();
      if (cleanupComplete) cleanupComplete();
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
            <Chip label={`文件: ${currentFile}`} variant="outlined" size="small" sx={{ maxWidth: '100%' }} />
          </Box>
        )}

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {status}
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
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

const ProgressOverlay = styled(Box)(() => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999
}));

const ProgressContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  minWidth: 400,
  maxWidth: 600,
  textAlign: 'center'
}));

export default VideoConversionProgress;
