const fallbackElectronAPI = {
  invoke: async () => {
    throw new Error('Electron API不可用');
  },
  send: () => {},
  on: () => () => {},
  removeAllListeners: () => {}
};

let mockElectronAPI = null;

const resolveElectronAPI = () => {
  if (mockElectronAPI) {
    return mockElectronAPI;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  return window.electronAPI || null;
};

export const getElectronAPI = () => resolveElectronAPI() ?? fallbackElectronAPI;

export const isElectronAvailable = () => Boolean(resolveElectronAPI());

export const setElectronAPIMock = (mockApi) => {
  mockElectronAPI = mockApi;
};

export default getElectronAPI;
