import React, { useState, useEffect } from 'react';
import dictionaryService from '../utils/dictionaryService';

const OCRResultModal = React.memo(({ isOpen, result, onExplain, onClose, style, isLoading }) => {
  const [dictResult, setDictResult] = useState(null);
  const [dictLoading, setDictLoading] = useState(false);

  // 当模态框关闭或结果更新时，重置字典查询结果
  useEffect(() => {
    if (!isOpen || result !== undefined) {
      setDictResult(null);
    }
  }, [isOpen, result]);

  if (!isOpen) return null;

  const getSelectedText = () => {
    return window.getSelection().toString().trim();
  };

  const handleDictionaryLookup = async () => {
    const txt = getSelectedText();
    if (!txt) {
      alert('请先在上方结果里选中要查询的单词');
      return;
    }

    setDictLoading(true);
    try {
      const result = await dictionaryService.lookup(txt);
      if (result) {
        // 格式化字典查询结果
        const formattedResult = formatDictionaryResult(result);
        setDictResult(formattedResult);
        
        // 保存到数据库
        await window.electronAPI.invoke('saveAiQuery', {
          query: txt,
          explanation: formattedResult,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('字典查询失败:', error);
      alert('字典查询失败: ' + error.message);
    } finally {
      setDictLoading(false);
    }
  };

  // 格式化字典查询结果
  const formatDictionaryResult = (result) => {
    let formatted = `**${result.word}** ${result.phonetic}\n\n`;
    
    // 按词性分组显示释义
    const groupedDefs = result.definitions.reduce((acc, def) => {
      if (!acc[def.type]) acc[def.type] = [];
      acc[def.type].push(def);
      return acc;
    }, {});

    Object.entries(groupedDefs).forEach(([type, defs]) => {
      formatted += `**${type.toUpperCase()}**\n`;
      defs.forEach(def => {
        formatted += `${def.english}\n${def.chinese}\n\n`;
      });
    });

    // 添加同义词
    if (result.synonyms && result.synonyms.length > 0) {
      formatted += '**同义词**\n';
      result.synonyms.forEach(syn => {
        formatted += `${syn.english} - ${syn.chinese}\n`;
      });
    }

    return formatted;
  };

  // 处理关闭按钮点击
  const handleClose = () => {
    setDictResult(null);
    onClose();
  };

  return (
    <div
      className="ocr-result-modal"
      style={{
        ...style,
        width: '100%',
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        maxHeight: 'calc(100vh - 200px)',
        position: 'relative'
      }}
    >
      <div
        style={{
          marginBottom: 12,
          color: '#222',
          fontSize: 22,
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          overflow: 'auto',
          maxHeight: '40vh',
          paddingRight: 8
        }}
      >
        {result}
      </div>

      {/* 显示字典查询结果 */}
      {dictResult && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: '#f5f5f5',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            maxHeight: '30vh',
            paddingRight: 8
          }}
          dangerouslySetInnerHTML={{
            __html: dictResult
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br/>')
          }}
        />
      )}

      <div 
        style={{ 
          display: 'flex', 
          gap: 8, 
          justifyContent: 'space-between',
          position: 'sticky',
          bottom: 0,
          background: '#fff',
          paddingTop: 8,
          borderTop: '1px solid #eee'
        }}
      >
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #1976d2',
            background: '#fff',
            color: '#1976d2',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
            transition: 'all 0.2s ease',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          disabled={isLoading}
          onClick={() => {
            const txt = getSelectedText();
            if (!txt) {
              alert('请先在上方结果里选中要解释的文字');
              return;
            }
            onExplain('zh', txt);
          }}
        >
          {isLoading ? '处理中...' : '中文解释'}
        </button>
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #1976d2',
            background: '#fff',
            color: '#1976d2',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
            transition: 'all 0.2s ease',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          disabled={isLoading}
          onClick={() => {
            const txt = getSelectedText();
            if (!txt) {
              alert('请先在上方结果里选中要解释的文字');
              return;
            }
            onExplain('en', txt);
          }}
        >
          {isLoading ? 'Processing...' : '英文解释'}
        </button>
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #1976d2',
            background: '#fff',
            color: '#1976d2',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
            transition: 'all 0.2s ease',
            cursor: dictLoading ? 'not-allowed' : 'pointer',
            opacity: dictLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          disabled={dictLoading}
          onClick={handleDictionaryLookup}
        >
          {dictLoading ? '查询中...' : '字典查询'}
        </button>
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #666',
            background: '#fff',
            color: '#666',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          onClick={handleClose}
          disabled={isLoading}
        >
          关闭
        </button>
      </div>
    </div>
  );
});

export default OCRResultModal; 