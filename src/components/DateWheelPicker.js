import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Button, Dialog, Typography } from '@mui/material';

/**
 * 单个滚轮列组件
 */
const WheelColumn = ({ items, selectedIndex, onSelect, label }) => {
  const containerRef = useRef(null);
  const itemHeight = 44;
  const visibleItems = 5;
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  // 滚动到选中项
  const scrollToIndex = useCallback((index, smooth = true) => {
    if (containerRef.current) {
      const targetScrollTop = index * itemHeight;
      containerRef.current.scrollTo({
        top: targetScrollTop,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, [itemHeight]);

  // 初始化滚动位置
  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, scrollToIndex]);

  // 处理滚动结束，吸附到最近的项
  const handleScrollEnd = useCallback(() => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const nearestIndex = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(nearestIndex, items.length - 1));
      scrollToIndex(clampedIndex);
      if (clampedIndex !== selectedIndex) {
        onSelect(clampedIndex);
      }
    }
  }, [itemHeight, items.length, onSelect, scrollToIndex, selectedIndex]);

  // 滚轮事件
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(selectedIndex + delta, items.length - 1));
    if (newIndex !== selectedIndex) {
      onSelect(newIndex);
      scrollToIndex(newIndex);
    }
  }, [items.length, onSelect, scrollToIndex, selectedIndex]);

  // 触摸/鼠标拖动
  const handleStart = (clientY) => {
    setIsDragging(true);
    startY.current = clientY;
    startScrollTop.current = containerRef.current?.scrollTop || 0;
  };

  const handleMove = (clientY) => {
    if (!isDragging || !containerRef.current) return;
    const deltaY = startY.current - clientY;
    containerRef.current.scrollTop = startScrollTop.current + deltaY;
  };

  const handleEnd = () => {
    setIsDragging(false);
    handleScrollEnd();
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      flex: 1,
      minWidth: 70
    }}>
      <Typography 
        variant="caption" 
        sx={{ 
          mb: 1, 
          color: 'rgba(0,0,0,0.4)',
          fontSize: '0.7rem',
          fontWeight: 500,
          letterSpacing: 1
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          height: itemHeight * visibleItems,
          overflow: 'hidden',
          width: '100%',
          borderRadius: 3
        }}
      >
        {/* 选中项高亮背景 */}
        <Box
          sx={{
            position: 'absolute',
            top: itemHeight * 2,
            left: 4,
            right: 4,
            height: itemHeight,
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(25, 118, 210, 0.12) 100%)',
            borderRadius: 2.5,
            pointerEvents: 'none',
            zIndex: 1,
            border: '1px solid rgba(25, 118, 210, 0.15)'
          }}
        />
        {/* 上下渐变遮罩 */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: itemHeight * 2,
            background: 'linear-gradient(to bottom, rgba(250,250,252,1) 0%, rgba(250,250,252,0.8) 50%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: itemHeight * 2,
            background: 'linear-gradient(to top, rgba(250,250,252,1) 0%, rgba(250,250,252,0.8) 50%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
        {/* 滚动容器 */}
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={(e) => handleStart(e.clientY)}
          onMouseMove={(e) => handleMove(e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(e) => handleStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleMove(e.touches[0].clientY)}
          onTouchEnd={handleEnd}
          sx={{
            height: '100%',
            overflowY: 'scroll',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            cursor: 'grab',
            userSelect: 'none',
            paddingTop: `${itemHeight * 2}px`,
            paddingBottom: `${itemHeight * 2}px`
          }}
        >
          {items.map((item, index) => (
            <Box
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  onSelect(index);
                  scrollToIndex(index);
                }
              }}
              sx={{
                height: itemHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: index === selectedIndex ? '1.15rem' : '0.95rem',
                fontWeight: index === selectedIndex ? 600 : 400,
                color: item.disabled 
                  ? 'rgba(0,0,0,0.25)' 
                  : (index === selectedIndex ? 'primary.main' : 'rgba(0,0,0,0.65)'),
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                transform: index === selectedIndex ? 'scale(1.05)' : 'scale(1)',
                '&:hover': {
                  color: item.disabled ? 'rgba(0,0,0,0.25)' : 'primary.main'
                }
              }}
            >
              {item.label}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * 日期滚轮选择器组件
 * @param {string} value - 当前日期值 (YYYY-MM-DD)
 * @param {function} onChange - 日期变化回调
 * @param {string} label - 输入框标签
 * @param {boolean} disableFuture - 是否禁用未来日期
 */
const DateWheelPicker = ({ value, onChange, label = '日期', disableFuture = true }) => {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  // 解析当前值
  const parseDate = (dateStr) => {
    const [y, m, d] = (dateStr || todayStr).split('-').map(Number);
    return { year: y, month: m, day: d };
  };
  
  const [tempDate, setTempDate] = useState(() => parseDate(value));
  
  // 生成年份列表（最近10年）
  const currentYear = today.getFullYear();
  const years = [];
  for (let y = currentYear - 9; y <= currentYear; y++) {
    const isFuture = disableFuture && y > currentYear;
    years.push({ value: y, label: `${y}`, disabled: isFuture });
  }
  
  // 生成月份列表
  const getMonths = (year) => {
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const isFuture = disableFuture && (year > currentYear || (year === currentYear && m > today.getMonth() + 1));
      months.push({ value: m, label: `${m}月`, disabled: isFuture });
    }
    return months;
  };
  
  // 生成日期列表
  const getDays = (year, month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const isFuture = disableFuture && (
        year > currentYear ||
        (year === currentYear && month > today.getMonth() + 1) ||
        (year === currentYear && month === today.getMonth() + 1 && d > today.getDate())
      );
      days.push({ value: d, label: `${d}日`, disabled: isFuture });
    }
    return days;
  };
  
  const months = getMonths(tempDate.year);
  const days = getDays(tempDate.year, tempDate.month);
  
  // 找到选中项的索引
  const yearIndex = years.findIndex(y => y.value === tempDate.year);
  const monthIndex = months.findIndex(m => m.value === tempDate.month);
  const dayIndex = days.findIndex(d => d.value === tempDate.day);
  
  // 处理年份变化
  const handleYearChange = (index) => {
    const newYear = years[index].value;
    if (years[index].disabled) return;
    
    let newMonth = tempDate.month;
    let newDay = tempDate.day;
    
    // 如果选择的年份导致月份超出范围，调整月份
    if (disableFuture && newYear === currentYear && newMonth > today.getMonth() + 1) {
      newMonth = today.getMonth() + 1;
    }
    
    // 如果选择的年月导致日期超出范围，调整日期
    const maxDay = new Date(newYear, newMonth, 0).getDate();
    if (newDay > maxDay) {
      newDay = maxDay;
    }
    if (disableFuture && newYear === currentYear && newMonth === today.getMonth() + 1 && newDay > today.getDate()) {
      newDay = today.getDate();
    }
    
    setTempDate({ year: newYear, month: newMonth, day: newDay });
  };
  
  // 处理月份变化
  const handleMonthChange = (index) => {
    const newMonth = months[index].value;
    if (months[index].disabled) return;
    
    let newDay = tempDate.day;
    
    // 调整日期以适应新月份
    const maxDay = new Date(tempDate.year, newMonth, 0).getDate();
    if (newDay > maxDay) {
      newDay = maxDay;
    }
    if (disableFuture && tempDate.year === currentYear && newMonth === today.getMonth() + 1 && newDay > today.getDate()) {
      newDay = today.getDate();
    }
    
    setTempDate({ ...tempDate, month: newMonth, day: newDay });
  };
  
  // 处理日期变化
  const handleDayChange = (index) => {
    if (days[index].disabled) return;
    setTempDate({ ...tempDate, day: days[index].value });
  };
  
  // 打开对话框时重置临时日期
  const handleOpen = () => {
    setTempDate(parseDate(value));
    setOpen(true);
  };
  
  // 确认选择
  const handleConfirm = () => {
    const dateStr = `${tempDate.year}-${String(tempDate.month).padStart(2, '0')}-${String(tempDate.day).padStart(2, '0')}`;
    onChange(dateStr);
    setOpen(false);
  };
  
  // 格式化显示日期
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '请选择日期';
    const [y, m, d] = dateStr.split('-');
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
  };

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleOpen}
        size="small"
        sx={{
          minWidth: 150,
          height: 40,
          justifyContent: 'center',
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.9rem',
          borderRadius: 2.5,
          borderColor: 'rgba(0,0,0,0.15)',
          color: 'text.primary',
          backgroundColor: 'rgba(0,0,0,0.02)',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'rgba(25, 118, 210, 0.04)'
          }
        }}
      >
        {formatDisplayDate(value)}
      </Button>
      
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            minWidth: 320,
            maxWidth: 360,
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
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              fontSize: '1.1rem',
              color: 'rgba(0,0,0,0.85)'
            }}
          >
            {label}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 0.5,
              color: 'primary.main',
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            {`${tempDate.year}年${tempDate.month}月${tempDate.day}日`}
          </Typography>
        </Box>

        {/* 滚轮区域 */}
        <Box sx={{ 
          px: 2, 
          py: 3,
          display: 'flex', 
          justifyContent: 'center', 
          gap: 0.5
        }}>
          <WheelColumn
            items={years}
            selectedIndex={Math.max(0, yearIndex)}
            onSelect={handleYearChange}
            label="年"
          />
          <WheelColumn
            items={months}
            selectedIndex={Math.max(0, monthIndex)}
            onSelect={handleMonthChange}
            label="月"
          />
          <WheelColumn
            items={days}
            selectedIndex={Math.max(0, dayIndex)}
            onSelect={handleDayChange}
            label="日"
          />
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
            onClick={() => setOpen(false)} 
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
            onClick={handleConfirm} 
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
            确定
          </Button>
        </Box>
      </Dialog>
    </>
  );
};

export default DateWheelPicker;
