import { AppHeader } from '@/components';
import { Colors } from '@/theme/theme';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Download, ExternalLink, FileText, Printer } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Pdf from 'react-native-pdf';

const { width } = Dimensions.get('window');

export default function SkripsiReadScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    uri: string;
    size: string;
    type: string;
  }>();
  
  // Stabilize params to prevent infinite useEffect loop
  const stableParams = useMemo(() => ({
    name: params.name,
    uri: params.uri,
    size: params.size,
    type: params.type,
  }), [params.name, params.uri, params.size, params.type]);
  
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    uri: string;
    size: number;
    type: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    // Get file info from params - only run once
    if (fileInfo) return;
    
    const loadFile = async () => {
      try {
        if (stableParams.name && stableParams.uri) {
          setFileInfo({
            name: stableParams.name,
            uri: stableParams.uri,
            size: parseInt(stableParams.size || '0', 10),
            type: stableParams.type || 'application/octet-stream',
          });
        } else {
          // Fallback for direct navigation without params
          setFileInfo({
            name: 'Skripsi_Final.pdf',
            uri: 'file://path/to/document.pdf',
            size: 2048000,
            type: 'application/pdf',
          });
        }
        setLoading(false);
      } catch (err) {
        setError('Gagal memuat file');
        setLoading(false);
      }
    };

    loadFile();
  }, [stableParams, fileInfo]);

  const handleOpenExternal = async () => {
    if (!fileInfo) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileInfo.uri);
      } else {
        Alert.alert('Error', 'Berbagi file tidak tersedia di perangkat ini');
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal membuka file');
    }
  };

  const handleDownload = async () => {
    if (!fileInfo) return;
    try {
      const fileName = fileInfo.name;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.copyAsync({
        from: fileInfo.uri,
        to: fileUri,
      });
      Alert.alert('Berhasil', `File disimpan ke: ${fileUri}`);
    } catch (err) {
      Alert.alert('Error', 'Gagal mengunduh file');
    }
  };

  const handlePrint = async () => {
    if (!fileInfo) return;
    try {
      await Print.printAsync({
        uri: fileInfo.uri,
      });
    } catch (err) {
      Alert.alert('Error', 'Gagal mencetak file');
    }
  };

  const handlePdfLoadComplete = (numberOfPages: number) => {
    setPdfLoading(false);
    console.log(`PDF loaded with ${numberOfPages} pages`);
  };

  const handlePdfError = (error: any) => {
    console.error('PDF Error:', error);
    setPdfError(true);
    setPdfLoading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isPdf = fileInfo?.type === 'application/pdf' || 
               fileInfo?.name.toLowerCase().endsWith('.pdf') ||
               fileInfo?.uri.toLowerCase().includes('.pdf');

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

  if (error) {
    return (
      <View style={styles.container}>
        <AppHeader title="Baca Skripsi" showBack />
        <View style={styles.errorContainer}>
          <FileText size={48} color={Colors.error} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Gagal Memuat File</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
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
                  {formatFileSize(fileInfo.size)} • {isPdf ? 'PDF Document' : 'Word Document'}
                </Text>
              </View>
            </View>

            {/* PDF Viewer */}
            {isPdf && !pdfError ? (
              <View style={styles.pdfContainer}>
                {pdfLoading && (
                  <View style={styles.pdfLoadingOverlay}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.pdfLoadingText}>Memuat PDF...</Text>
                  </View>
                )}
                <Pdf
                  source={{ uri: fileInfo.uri, cache: true }}
                  style={styles.pdf}
                  onLoadComplete={handlePdfLoadComplete}
                  onError={handlePdfError}
                  trustAllCerts={false}
                  enablePaging={true}
                  horizontal={false}
                  spacing={10}
                  minScale={0.5}
                  maxScale={3.0}
                  activityIndicatorColor={Colors.primary}
                />
              </View>
            ) : pdfError ? (
              <View style={styles.pdfErrorContainer}>
                <FileText size={48} color={Colors.error} strokeWidth={1.5} />
                <Text style={styles.pdfErrorTitle}>Gagal Memuat PDF</Text>
                <Text style={styles.pdfErrorSubtitle}>
                  PDF tidak dapat ditampilkan. Coba buka dengan aplikasi eksternal.
                </Text>
              </View>
            ) : (
              <View style={styles.wordInfoContainer}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>Informasi Dokumen Word</Text>
                  <Text style={styles.infoText}>
                    File Word (.doc, .docx) tidak dapat ditampilkan langsung di aplikasi.
                    Anda dapat membuka file dengan aplikasi eksternal, mengunduhnya, atau mencetaknya.
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {isPdf && !pdfError && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handlePrint}
                  activeOpacity={0.7}
                >
                  <Printer size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.actionButtonText}>Cetak PDF</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleOpenExternal}
                activeOpacity={0.7}
              >
                <ExternalLink size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                  Buka dengan Aplikasi Lain
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleDownload}
                activeOpacity={0.7}
              >
                <Download size={20} color={Colors.primary} strokeWidth={2} />
                <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                  Unduh File
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
  pdfContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    marginBottom: 20,
  },
  pdf: {
    flex: 1,
    width: width - 36,
    height: 600,
  },
  pdfLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pdfLoadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  pdfErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 20,
  },
  pdfErrorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  pdfErrorSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  wordInfoContainer: {
    flex: 1,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#B45309',
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
