import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';

export async function requestMediaPermission() {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

export async function downloadFile({ url, filename, quality, format, onProgress, onComplete, onError }) {
  try {
    // Request permission
    const perm = await requestMediaPermission();
    if (!perm) {
      onError?.('Storage permission denied');
      return null;
    }

    const destUri = FileSystem.documentDirectory + filename;

    // Notification
    let notifId;
    try {
      notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⬇️ WAVE Downloading',
          body: filename,
          data: { type: 'download' },
        },
        trigger: null,
      });
    } catch (e) {}

    // Download
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      destUri,
      {},
      (prog) => {
        const pct = prog.totalBytesExpectedToWrite > 0
          ? Math.round((prog.totalBytesWritten / prog.totalBytesExpectedToWrite) * 100)
          : 0;
        onProgress?.(pct, prog.totalBytesWritten, prog.totalBytesExpectedToWrite);
      }
    );

    const { uri } = await downloadResumable.downloadAsync();

    // Save to media library (Downloads folder)
    const asset = await MediaLibrary.createAssetAsync(uri);
    const album = await MediaLibrary.getAlbumAsync('WAVE Downloads');
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync('WAVE Downloads', asset, false);
    }

    // Update notification
    try {
      if (notifId) await Notifications.dismissNotificationAsync(notifId);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Download Complete',
          body: filename,
          data: { type: 'download_done', uri },
        },
        trigger: null,
      });
    } catch (e) {}

    const info = await FileSystem.getInfoAsync(uri);
    onComplete?.({ uri, localUri: uri, size: info.size || 0, asset });
    return { uri, size: info.size || 0 };
  } catch (e) {
    onError?.(e.message || 'Download failed');
    return null;
  }
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

export function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').substring(0, 200);
}

export async function getStorageInfo() {
  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    const total = await FileSystem.getTotalDiskCapacityAsync();
    return { free: info, total, used: total - info };
  } catch (e) {
    return { free: 0, total: 0, used: 0 };
  }
}
