/**
 * Resolves the FFmpeg binary path for both dev and production.
 *
 * Dev:  uses the path from @ffmpeg-installer/ffmpeg (npm-installed binary).
 * Prod: the binary is in app.asar.unpacked via asarUnpack, so we build the
 *       path from process.resourcesPath + the platform package sub-path.
 */
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

function resolveFfmpegPath() {
  // In dev the Electron main process is run directly from the source tree.
  // process.resourcesPath points to the Electron framework resources, not our
  // app, so we always use the npm-installed binary in dev.
  const isDev = !!(process.env.DEV_SERVER_URL || !process.resourcesPath ||
    process.resourcesPath.includes('Electron.app/Contents/Resources'));

  if (isDev) {
    return ffmpegInstaller.path;
  }

  // In production, electron-builder unpacks the platform binary via asarUnpack.
  // The unpacked path mirrors the node_modules structure under app.asar.unpacked.
  const platformPkg = `@ffmpeg-installer/${process.platform}-${process.arch}`;
  const ext = process.platform === 'win32' ? '.exe' : '';
  const prodPath = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    platformPkg,
    'ffmpeg' + ext
  );

  const fs = require('fs');
  if (fs.existsSync(prodPath)) {
    return prodPath;
  }

  // Fallback: installer may have placed it differently; try the npm path.
  console.warn('[ffmpegPath] prod path not found, falling back to npm path:', prodPath);
  return ffmpegInstaller.path;
}

const ffmpegPath = resolveFfmpegPath();
module.exports = { ffmpegPath };
