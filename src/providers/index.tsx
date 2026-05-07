import React, { type ReactNode } from 'react';
import {
  VideoProvider,
  TimeStatsProvider,
  AIProvider,
  ApiKeyProvider,
  ErrorProvider
} from '../contexts/AppContext';

interface ProviderProps {
  children: ReactNode;
}

export const VideoProviders: React.FC<ProviderProps> = ({ children }) => (
  <VideoProvider>
    <TimeStatsProvider>{children}</TimeStatsProvider>
  </VideoProvider>
);

export const AIProviders: React.FC<ProviderProps> = ({ children }) => (
  <AIProvider>{children}</AIProvider>
);

export const AppProviders: React.FC<ProviderProps> = ({ children }) => (
  <ErrorProvider>
    <ApiKeyProvider>{children}</ApiKeyProvider>
  </ErrorProvider>
);
