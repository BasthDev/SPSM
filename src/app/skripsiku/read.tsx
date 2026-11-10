import { AppHeader } from '@/components';
import { Colors } from '@/theme/theme';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Download, ExternalLink, FileText, Maximize2, Minimize2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

type FileInfo = {
  name: string;
  uri: string;
  size: number;
  type: string;
};

export default function SkripsiReadScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    uri: string;
    size: string;
    type: string;
  }>();

  // Params can arrive as string[] depending on navigation; normalize to string
  const first = (v: unknown): string =>
    Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');

  const stableParams = useMemo(
    () => ({
      name: first(params.name),
      uri: first(params.uri),
      size: first(params.size),
      type: first(params.type),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.name, params.uri, params.size, params.type]
  );

  const [loading, setLoading] = useState(true);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  const isPdfFile = (file: { name: string; type: string }) => {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return name.endsWith('.pdf') || type === 'application/pdf';
  };

  // Online viewers that render the ORIGINAL file (no conversion)
  const viewerUrlFor = (remoteUrl: string, file: { name: string; type: string }) => {
    const encoded = encodeURIComponent(remoteUrl);
    if (isPdfFile(file)) {
      return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;
    }
    // Word / Office docs -> Microsoft Office Online Viewer (faithful rendering)
    return `https://view.officeapps.live.com/op/view.aspx?src=${encoded}`;
  };

  useEffect(() => {
    if (fileInfo) return;

    const loadFile = async () => {
      try {
        if (stableParams.name && stableParams.uri) {
          const isRemoteUrl = stableParams.uri.startsWith('http');
          const info: FileInfo = {
            name: stableParams.name,
            uri: stableParams.uri,
            size: parseInt(stableParams.size || '0', 10),
            type: stableParams.type || 'application/octet-stream',
          };
          setFileInfo(info);

          // Remote files can be viewed directly via online viewer
          if (isRemoteUrl) {
            setViewerUrl(viewerUrlFor(stableParams.uri, info));
          }

          // Download to local cache in the background for share/unduh
          if (isRemoteUrl) {
            try {
              const safeName = stableParams.name.replace(/[^\w.\- ]/g, '_') || 'document';
              const localPath = `${FileSystem.cacheDirectory}${safeName}`;
              const result = await FileSystem.downloadAsync(stableParams.uri, localPath);
              if (result.status === 200) {
                setFileInfo((prev) => (prev ? { ...prev, uri: result.uri } : prev));
              }
            } catch (downloadErr) {
              console.warn('Background download failed:', downloadErr);
            }
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Load file error:', err);
        setError('Gagal memuat file');
        setLoading(false);
      }
    };

    loadFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableParams, fileInfo]);

  const handleOpenExternal = async () => {
    if (!fileInfo) return;
    try {
      // Prefer the original remote URL so the browser gets the real file
      const remoteUri = stableParams.uri.startsWith('http')
        ? stableParams.uri
        : null;
      const target = remoteUri || viewerUrl || fileInfo.uri;

      if (target.startsWith('http')) {
        await WebBrowser.openBrowserAsync(target);
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(target);
        } else {
          Alert.alert('Error', 'Tidak dapat membuka file');
        }
      }
    } catch {
      Alert.alert('Error', 'Gagal membuka file');
    }
  };

  const handleDownload = async () => {
    if (!fileInfo || downloading) return;
    setDownloading(true);
    try {
      const safeName = fileInfo.name.replace(/[^\w.\- ]/g, '_') || 'document';
      let targetUri = fileInfo.uri;

      // If still remote, download it
      if (targetUri.startsWith('http')) {
        const localPath = `${FileSystem.documentDirectory}${safeName}`;
        const result = await FileSystem.downloadAsync(targetUri, localPath);
        if (result.status !== 200) throw new Error('Download failed');
        targetUri = result.uri;
      } else if (!targetUri.startsWith(FileSystem.documentDirectory || 'file:///nonexistent')) {
        // Copy cache file to documents so it persists
        const localPath = `${FileSystem.documentDirectory}${safeName}`;
        await FileSystem.copyAsync({ from: targetUri, to: localPath });
        targetUri = localPath;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(targetUri);
      } else {
        Alert.alert('Berhasil', 'File telah diunduh');
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Gagal mengunduh file');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeLabel = () => {
    if (!fileInfo) return '';
    if (isPdfFile(fileInfo)) return 'PDF Document';
    const name = fileInfo.name.toLowerCase();
    if (name.endsWith('.docx')) return 'Word Document (.docx)';
    if (name.endsWith('.doc')) return 'Word Document (.doc)';
    return 'Document';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Baca Skripsi" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat dokumen...</Text>
        </View>
      </View>
    );
  }

  if (error && !fileInfo) {
    return (
      <View style={styles.container}>
        <AppHeader title="Baca Skripsi" showBack />
        <View style={styles.errorContainer}>
          <FileText size={48} color={Colors.error} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Gagal Memuat File</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              setFileInfo(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const webViewer = viewerUrl ? (
    <WebView
      source={{ uri: viewerUrl }}
      style={isFullscreen ? styles.webviewFullscreen : styles.webview}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.webviewLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat dokumen...</Text>
        </View>
      )}
    />
  ) : null;

  // Fullscreen mode: only the viewer fills the screen
  if (isFullscreen && webViewer) {
    return (
      <View
        style={[
          styles.fullscreenContainer,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {webViewer}
        <TouchableOpacity
          style={[styles.exitFullscreenButton, { top: insets.top + 8 }]}
          onPress={() => setIsFullscreen(false)}
          activeOpacity={0.8}
        >
          <Minimize2 size={20} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.exitFullscreenText}>Kecilkan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Baca Skripsi" showBack />
      <View style={styles.content}>
        {fileInfo ? (
          <View style={styles.mainArea}>
            <View style={styles.fileCard}>
              <View style={styles.fileIconContainer}>
                <FileText size={32} color={Colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{fileInfo.name}</Text>
                <Text style={styles.fileMeta}>
                  {formatFileSize(fileInfo.size)} • {getFileTypeLabel()}
                </Text>
              </View>
              {viewerUrl ? (
                <TouchableOpacity
                  style={styles.fullscreenButton}
                  onPress={() => setIsFullscreen(true)}
                  activeOpacity={0.7}
                >
                  <Maximize2 size={18} color={Colors.primary} strokeWidth={2} />
                </TouchableOpacity>
              ) : null}
            </View>

            {webViewer || (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>Dokumen</Text>
                <Text style={styles.infoText}>
                  File lokal tidak dapat ditampilkan langsung. Gunakan tombol di bawah untuk membukanya.
                </Text>
              </View>
            )}

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.actionButtonSmall, styles.actionButtonPrimary]}
                onPress={handleOpenExternal}
                activeOpacity={0.7}
              >
                <ExternalLink size={16} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.actionButtonSmallText}>Buka di Browser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButtonSmall, styles.actionButtonSecondary]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.7}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Download size={16} color={Colors.primary} strokeWidth={2} />
                )}
                <Text style={[styles.actionButtonSmallText, { color: Colors.primary }]}>
                  Unduh
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <FileText size={64} color={Colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.placeholderTitle}>Dokumen</Text>
            <Text style={styles.placeholderSubtitle}>
              File akan ditampilkan di sini
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 18,
  },
  mainArea: {
    flex: 1,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  webview: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webviewFullscreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  exitFullscreenButton: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  exitFullscreenText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fullscreenButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flex: 1,
    justifyContent: 'center',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  actionButtonSmallText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
