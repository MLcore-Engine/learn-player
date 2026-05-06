import type { ElectronAPI } from './ipc';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// 让该文件视为 module，避免污染全局导出
export {};
