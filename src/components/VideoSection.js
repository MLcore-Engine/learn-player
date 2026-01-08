import React, { useRef, useEffect, useState } from 'react';
import VideoPlayer from './VideoPlayer';

const VideoSection = ({ videoPath, onTimeUpdate, onSubtitleSelect }) => {
  const videoRef = useRef(null);
  
  return (
    <div style={{ flex: 1, backgroundColor: '#000' }}>
      {videoPath ? (
        <VideoPlayer
          key={videoPath}
          videoPath={videoPath}
          onTimeUpdate={onTimeUpdate}
          onSubtitleSelect={onSubtitleSelect}
          videoRef={videoRef}
        />
      ) : (
        <div style={{ 
          color: '#fff', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%' 
        }}>
          <strong>文件 {'->'} 打开视频</strong>
        </div>
      )}
    </div>
  );
};

export default VideoSection; 