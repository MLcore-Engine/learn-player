import React from 'react';
import {
  VideoProvider,
  TimeStatsProvider,
  AIProvider,
  ApiKeyProvider,
  ErrorProvider
} from '../contexts/AppContext';

export const VideoProviders = ({ children }) => (
  <VideoProvider>
    <TimeStatsProvider>{children}</TimeStatsProvider>
  </VideoProvider>
);

export const AIProviders = ({ children }) => (
  <AIProvider>{children}</AIProvider>
);

export const AppProviders = ({ children }) => (
  <ErrorProvider>
    <ApiKeyProvider>{children}</ApiKeyProvider>
  </ErrorProvider>
);

