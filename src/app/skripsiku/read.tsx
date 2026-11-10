import { AppHeader } from '@/components';
import { Colors } from '@/theme/theme';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Download, ExternalLink, FileText, Printer } from 'lucide-react-native';
import mammoth from 'mammoth';
import { Buffer } from 'buffer';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Polyfill for mammoth.js in React Native
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

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

  const stableParams = useMemo(() => ({
    name: first(params.name),
    uri: first(params.uri),
    size: first(params.size),
    type: first(params.type),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [params.name, params.uri, params.size, params.type]);

  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    uri: string;
    size: number;
    type: string;
  } | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isWordFile = (file: { name: string; type: string; uri: string }) => {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return (
      name.endsWith('.doc') ||
      name.endsWith('.docx') ||
      type.includes('msword') ||
      type.includes('wordprocessingml')
    );
  };

  const isPdfFile = (file: { name: string; type: string; uri: string }) => {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return name.endsWith('.pdf') || type === 'application/pdf';
  };

  useEffect(() => {
    if (fileInfo) return;

    const loadFile = async () => {
      try {
        if (stableParams.name && stableParams.uri) {
          const isRemoteUrl = stableParams.uri.startsWith('http');
          let localUri = stableParams.uri;
          let downloaded = false;

          // If remote URL, download to local cache first
          if (isRemoteUrl) {
            try {
              const safeName = stableParams.name.replace(/[^\w.\- ]/g, '_') || 'document';
              const localPath = `${FileSystem.cacheDirectory}${safeName}`;
              const downloadResult = await FileSystem.downloadAsync(
                stableParams.uri,
                localPath
              );
              if (downloadResult.status === 200) {
                localUri = downloadResult.uri;
                downloaded = true;
              } else {
                console.warn('Download returned status:', downloadResult.status);
              }
            } catch (downloadErr) {
              console.error('Download failed:', downloadErr);
            }
          } else {
            downloaded = true;
          }

          const info = {
            name: stableParams.name,
            uri: localUri,
            size: parseInt(stableParams.size || '0', 10),
            type: stableParams.type || 'application/octet-stream',
          };
          setFileInfo(info);

          // Auto-convert Word to PDF (requires a local file)
          if (isWordFile(info)) {
            if (downloaded) {
              await convertWordToPdf(info);
            } else {
              setError('File belum dapat diunduh untuk konversi. Coba buka di browser.');
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

  const convertWordToPdf = async (file: { name: string; uri: string; type: string }) => {
    try {
      setConverting(true);
      setError(null);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));

      const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      const html = result.value;

      if (!html || html.trim() === '') {
        throw new Error('Gagal mengkonversi dokumen');
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 12px; }
            p { margin-bottom: 12px; }
            table { border-collapse: collapse; width: 100%; margin: 16px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;

      const { uri: pdfFileUri } = await Print.printToFileAsync({ html: fullHtml });
      setPdfUri(pdfFileUri);
      setConverting(false);
    } catch (err) {
      console.error('Conversion error:', err);
      setError('Gagal mengkonversi file Word ke PDF');
      setConverting(false);
    }
  };

  const handleOpenFile = async () => {
    const uri = pdfUri || fileInfo?.uri;
    if (!uri) return;

    try {
      // If it's a remote URL, open directly in browser
      if (uri.startsWith('http')) {
        await WebBrowser.openBrowserAsync(uri);
      } else {
        // If local file, try to open with system viewer
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert('Error', 'Tidak dapat membuka file');
        }
      }
    } catch (err) {
      // Fallback to sharing
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert('Error', 'Gagal membuka file');
        }
      } catch (shareErr) {
        Alert.alert('Error', 'Gagal membuka file');
      }
    }
  };

  const handleDownload = async () => {
    if (!fileInfo) return;
    try {
      const fileName = fileInfo.name;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      // If file is already local, copy it
      if (!fileInfo.uri.startsWith('http')) {
        await FileSystem.copyAsync({
          from: fileInfo.uri,
          to: fileUri,
        });
      } else {
        // If remote URL, download it
        await FileSystem.downloadAsync(fileInfo.uri, fileUri);
      }
      
      Alert.alert('Berhasil', `File disimpan`);
    } catch (err) {
      Alert.alert('Error', 'Gagal mengunduh file');
    }
  };

  const handlePrint = async () => {
    const uri = pdfUri || fileInfo?.uri;
    if (!uri) return;
    try {
      await Print.printAsync({ uri });
    } catch (err) {
      Alert.alert('Error', 'Gagal mencetak file');
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
    if (isWordFile(fileInfo)) return pdfUri ? 'PDF (Converted)' : 'Word Document';
    return 'Document';
  };

  if (loading || converting) {
    return (
      <View style={styles.container}>
        <AppHeader title="Baca Skripsi" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {converting ? 'Mengkonversi ke PDF...' : 'Memuat dokumen...'}
          </Text>
        </View>
      </View>
    );
  }

  if (error && !pdfUri) {
    return (
      <View style={styles.container}>
        <AppHeader title="Baca Skripsi" showBack />
        <View style={styles.errorContainer}>
          <FileText size={48} color={Colors.error} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Gagal Memuat File</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenFile}
              activeOpacity={0.7}
            >
              <ExternalLink size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.actionButtonText}>Buka dengan Aplikasi Lain</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => {
                setError(null);
                setPdfUri(null);
                setLoading(true);
                setFileInfo(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                Coba Lagi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Baca Skripsi" showBack />
      <View style={styles.content}>
        {fileInfo ? (
          <>
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
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Dokumen Siap</Text>
              <Text style={styles.infoText}>
                {pdfUri
                  ? 'File Word telah dikonversi ke PDF. Klik tombol di bawah untuk membuka.'
                  : 'Klik tombol di bawah untuk membuka file.'}
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenFile}
                activeOpacity={0.7}
              >
                <ExternalLink size={20} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.actionButtonText}>Buka File</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handlePrint}
                activeOpacity={0.7}
              >
                <Printer size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                  Cetak
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleDownload}
                activeOpacity={0.7}
              >
                <Download size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                  Unduh
                </Text>
              </TouchableOpacity>
            </View>
          </>
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
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
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
  actionButtons: {
    gap: 12,
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
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.primary,
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
