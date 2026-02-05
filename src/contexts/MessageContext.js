import React, { createContext, useContext, useState, useCallback } from 'react';
import MessageDialog from '../components/MessageDialog';

// 创建消息上下文
const MessageContext = createContext(null);

/**
 * 消息提供者组件
 * 提供全局消息提示功能
 */
export const MessageProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    open: false,
    message: '',
    type: 'info',
    title: ''
  });

  // 显示消息
  const showMessage = useCallback((message, type = 'info', title = '') => {
    setDialogState({
      open: true,
      message,
      type,
      title
    });
  }, []);

  // 关闭消息
  const closeMessage = useCallback(() => {
    setDialogState(prev => ({ ...prev, open: false }));
  }, []);

  // 快捷方法
  const showInfo = useCallback((message, title) => showMessage(message, 'info', title), [showMessage]);
  const showSuccess = useCallback((message, title) => showMessage(message, 'success', title), [showMessage]);
  const showWarning = useCallback((message, title) => showMessage(message, 'warning', title), [showMessage]);
  const showError = useCallback((message, title) => showMessage(message, 'error', title), [showMessage]);

  return (
    <MessageContext.Provider value={{ 
      showMessage, 
      showInfo, 
      showSuccess, 
      showWarning, 
      showError 
    }}>
      {children}
      <MessageDialog
        open={dialogState.open}
        onClose={closeMessage}
        message={dialogState.message}
        type={dialogState.type}
        title={dialogState.title}
      />
    </MessageContext.Provider>
  );
};

/**
 * 使用消息上下文的 Hook
 */
export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    console.warn('useMessage must be used within a MessageProvider');
    // 返回空操作，避免报错
    return {
      showMessage: () => {},
      showInfo: () => {},
      showSuccess: () => {},
      showWarning: () => {},
      showError: () => {}
    };
  }
  return context;
};

export default MessageContext;
