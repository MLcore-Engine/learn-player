import React from 'react';
import { 
  Dialog, 
  Box, 
  Typography, 
  TextField, 
  Button,
  Chip
} from '@mui/material';
import { Key, Link as LinkIcon, CheckCircle, Error } from '@mui/icons-material';

const ApiKeySettings = ({ 
  isVisible, 
  apiKey,
  modelUrl,
  storedApiKeyStatus,
  configSource,
  onApiKeyChange,
  onModelUrlChange,
  onSave, 
  onCancel 
}) => {
  const sourceLabels = {
    store: '用户设置',
    env: '环境变量',
    default: '默认',
    local: '本地'
  };
  const apiKeySourceLabel = sourceLabels[configSource?.apiKey] || '未知';
  const modelUrlSourceLabel = sourceLabels[configSource?.modelUrl] || '未知';
  
  // 判断状态
  const isConfigured = storedApiKeyStatus === '已配置' || storedApiKeyStatus === '已存储';
  
  return (
    <Dialog 
      open={isVisible} 
      onClose={onCancel}
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          minWidth: 400,
          maxWidth: 480,
          background: 'linear-gradient(180deg, #FAFAFC 0%, #FFFFFF 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.1)'
        }
      }}
    >
      {/* 标题区域 */}
      <Box sx={{ 
        pt: 3, 
        pb: 2, 
        px: 3,
        textAlign: 'center',
        borderBottom: '1px solid rgba(0,0,0,0.06)'
      }}>
        <Box sx={{ 
          width: 56, 
          height: 56, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
        }}>
          <Key sx={{ fontSize: 28, color: '#fff' }} />
        </Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 600,
            fontSize: '1.15rem',
            color: 'rgba(0,0,0,0.85)'
          }}
        >
          API 设置
        </Typography>
        <Box sx={{ 
          mt: 1.5, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 1
        }}>
          {isConfigured ? (
            <Chip 
              icon={<CheckCircle sx={{ fontSize: 16 }} />}
              label={storedApiKeyStatus}
              size="small"
              sx={{
                backgroundColor: 'rgba(46, 125, 50, 0.1)',
                color: '#2e7d32',
                fontWeight: 500,
                fontSize: '0.75rem',
                '& .MuiChip-icon': { color: '#2e7d32' }
              }}
            />
          ) : (
            <Chip 
              icon={<Error sx={{ fontSize: 16 }} />}
              label={storedApiKeyStatus || '未配置'}
              size="small"
              sx={{
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                color: '#d32f2f',
                fontWeight: 500,
                fontSize: '0.75rem',
                '& .MuiChip-icon': { color: '#d32f2f' }
              }}
            />
          )}
        </Box>
      </Box>

      {/* 表单区域 */}
      <Box sx={{ px: 3, py: 3 }}>
        {/* API Key 输入 */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 1
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500,
                color: 'rgba(0,0,0,0.7)',
                fontSize: '0.85rem'
              }}
            >
              API Key
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(0,0,0,0.4)',
                fontSize: '0.7rem'
              }}
            >
              来源: {apiKeySourceLabel}
            </Typography>
          </Box>
          <TextField
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="输入新的 API Key (留空则清除)"
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <Key sx={{ fontSize: 18, color: 'rgba(0,0,0,0.3)', mr: 1 }} />
              ),
              sx: {
                borderRadius: 2.5,
                backgroundColor: 'rgba(0,0,0,0.02)',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.04)'
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0,0,0,0.1)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0,0,0,0.2)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main'
                }
              }
            }}
          />
        </Box>

        {/* Model URL 输入 */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 1
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500,
                color: 'rgba(0,0,0,0.7)',
                fontSize: '0.85rem'
              }}
            >
              模型 API URL
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(0,0,0,0.4)',
                fontSize: '0.7rem'
              }}
            >
              来源: {modelUrlSourceLabel}
            </Typography>
          </Box>
          <TextField
            type="text"
            value={modelUrl}
            onChange={(e) => onModelUrlChange(e.target.value)}
            placeholder="输入大模型 API URL"
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <LinkIcon sx={{ fontSize: 18, color: 'rgba(0,0,0,0.3)', mr: 1 }} />
              ),
              sx: {
                borderRadius: 2.5,
                backgroundColor: 'rgba(0,0,0,0.02)',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.04)'
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0,0,0,0.1)'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0,0,0,0.2)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main'
                }
              }
            }}
          />
        </Box>

        {/* 提示信息 */}
        <Box sx={{ 
          mt: 2,
          p: 1.5,
          borderRadius: 2,
          backgroundColor: 'rgba(25, 118, 210, 0.04)',
          border: '1px solid rgba(25, 118, 210, 0.1)'
        }}>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'rgba(0,0,0,0.5)',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              display: 'block'
            }}
          >
            💡 API Key 将被加密存储在本地。留空并保存可以清除已存储的 Key。
          </Typography>
        </Box>
      </Box>

      {/* 按钮区域 */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1.5,
        px: 3, 
        pb: 3,
        pt: 1
      }}>
        <Button 
          onClick={onCancel} 
          fullWidth
          sx={{
            height: 44,
            borderRadius: 2.5,
            fontWeight: 500,
            fontSize: '0.95rem',
            color: 'rgba(0,0,0,0.6)',
            backgroundColor: 'rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.08)'
            }
          }}
        >
          取消
        </Button>
        <Button 
          onClick={onSave} 
          variant="contained"
          fullWidth
          sx={{
            height: 44,
            borderRadius: 2.5,
            fontWeight: 600,
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
              transform: 'translateY(-1px)'
            }
          }}
        >
          保存
        </Button>
      </Box>
    </Dialog>
  );
};

export default ApiKeySettings; 
