import { useCallback, useEffect, useState } from 'react';

interface UseResizablePanelOptions {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
}

interface UseResizablePanelResult {
  width: number;
  isDragging: boolean;
  handleDragStart: (event: React.MouseEvent) => void;
}

const useResizablePanel = ({
  defaultWidth = 360,
  minWidth = 200,
  maxWidth = 800,
  storageKey = 'sidePanelWidth'
}: UseResizablePanelOptions = {}): UseResizablePanelResult => {
  const [width, setWidth] = useState<number>(defaultWidth);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem(storageKey);
    if (savedWidth) {
      setWidth(parseInt(savedWidth, 10));
    }
  }, [storageKey]);

  const handleDragStart = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    event.preventDefault();
  }, []);

  const handleDrag = useCallback(
    (event: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isDragging, maxWidth, minWidth]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    localStorage.setItem(storageKey, width.toString());
  }, [storageKey, width]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDrag, handleDragEnd, isDragging]);

  return { width, isDragging, handleDragStart };
};

export default useResizablePanel;
