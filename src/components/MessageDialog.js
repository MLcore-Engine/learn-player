import React from 'react';
import { Dialog, Box, Typography, Button } from '@mui/material';

// 导入图标 - 使用相对路径，打包时会正确处理
const getIconPath = () => {
  // 在 Electron 环境中，使用 assets 目录的图标
  if (window.electronAPI) {
    // 开发环境使用绝对路径，生产环境使用相对路径
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return '/assets/icon-64.png';
    }
    return './assets/icon-64.png';
  }
  // 浏览器环境使用 public 目录
  return '/assets/icon-64.png';
};

/**
 * 自定义消息对话框组件
 * 替代原生 alert，风格统一且可自定义图标
 */
const MessageDialog = ({ 
  open, 
  onClose, 
  title,
  message, 
  type = 'info', // 'info' | 'success' | 'warning' | 'error'
  confirmText = '确定',
  showIcon = true
}) => {
  // 根据类型设置颜色
  const typeColors = {
    info: '#1976d2',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f'
  };
  
  const color = typeColors[type] || typeColors.info;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          minWidth: 320,
          maxWidth: 400,
          background: 'linear-gradient(180deg, #FAFAFC 0%, #FFFFFF 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.1)'
        }
      }}
    >
      {/* 内容区域 */}
      <Box sx={{ 
        pt: 4, 
        pb: 2, 
        px: 3,
        textAlign: 'center'
      }}>
        {/* 图标 */}
        {showIcon && (
          <Box sx={{ 
            width: 64, 
            height: 64, 
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <img 
              src={getIconPath()} 
              alt="App Icon"
              style={{ 
                width: '100%', 
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                // 图标加载失败时隐藏
                e.target.style.display = 'none';
              }}
            />
          </Box>
        )}
        
        {/* 标题 */}
        {title && (
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              fontSize: '1.1rem',
              color: 'rgba(0,0,0,0.85)',
              mb: 1
            }}
          >
            {title}
          </Typography>
        )}
        
        {/* 消息内容 */}
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'rgba(0,0,0,0.65)',
            fontSize: '0.95rem',
            lineHeight: 1.6
          }}
        >
          {message}
        </Typography>
      </Box>

      {/* 按钮区域 */}
      <Box sx={{ 
        px: 3, 
        pb: 3,
        pt: 2
      }}>
        <Button 
          onClick={onClose} 
          variant="contained"
          fullWidth
          sx={{
            height: 44,
            borderRadius: 2.5,
            fontWeight: 600,
            fontSize: '0.95rem',
            boxShadow: `0 4px 12px ${color}40`,
            background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: `0 6px 16px ${color}50`,
              transform: 'translateY(-1px)'
            }
          }}
        >
          {confirmText}
        </Button>
      </Box>
    </Dialog>
  );
};

export default MessageDialog;
