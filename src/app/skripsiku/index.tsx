import { AppHeader } from '@/components';
import { Colors } from '@/theme/theme';
import { useRouter } from 'expo-router';
import {
  Eye,
  File,
  FileText,
  Trash2,
  Upload
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { onRealtimeEvent } from '@/services/realtimeService';

type UploadedFile = {
  id: string;
  name: string;
  uri: string;
  size: number;
  type: string;
  uploadedAt: string;
  appwriteId?: string;
  viewUrl?: string;
};

const ownerPrefix = (userId: string) => `owner_${userId}__`;
const stripOwnerPrefix = (name: string) => name.replace(/^owner_[A-Za-z0-9]+__/, '');

export default function SkripsiKuScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setUserId] = useState<string | null>(null);

  const loadFiles = useCallback(async (uid: string) => {
    try {
      const prefix = ownerPrefix(uid);
      const allFiles = await apiClient.files.list('journals');

      const uploadedFiles: UploadedFile[] = allFiles
        .filter((file: any) => file.name.startsWith(prefix))
        .map((file: any) => ({
          id: file.fileId || file.id,
          name: stripOwnerPrefix(file.name) || file.name,
          uri: file.downloadUrl || '',
          size: file.sizeOriginal || file.size || 0,
          type: file.mimeType || file.type || 'application/octet-stream',
          uploadedAt: file.createdAt || new Date().toISOString(),
          appwriteId: file.fileId || file.id,
          viewUrl: file.viewUrl || '',
        }));

      setFiles(uploadedFiles);
    } catch (error) {
      console.warn('Failed to load files (showing empty state):', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load current user, then load only their files from API storage
  useEffect(() => {
    let currentUid: string | null = null;
    (async () => {
      try {
        const current = await authService.getCurrentAccount();
        currentUid = current.$id;
        setUserId(current.$id);
        await loadFiles(current.$id);
      } catch (error) {
        console.error('Failed to get current user:', error);
        setLoading(false);
      }
    })();

    const unsub = onRealtimeEvent(() => {
      if (currentUid) {
        void loadFiles(currentUid);
      }
    });

    return () => {
      unsub();
    };
  }, [loadFiles]);

  const handleDeleteFile = (fileId: string) => {
    Alert.alert(
      'Hapus File',
      'Apakah Anda yakin ingin menghapus file ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.files.delete('journals', fileId);
              setFiles((prev) => prev.filter((f) => f.id !== fileId));
              Alert.alert('Berhasil', 'File berhasil dihapus');
            } catch (error: any) {
              console.error('Delete error:', error);
              Alert.alert('Error', `Gagal menghapus file: ${error.message || 'Unknown error'}`);
            }
          },
        },
      ]
    );
  };

  const handleViewFile = async (file: UploadedFile) => {
    // Resolve the direct storage URL (view endpoint 302-redirects to the real file)
    const fileUri =
      (await apiClient.files.getViewUrl('journals', file.id)) ||
      file.viewUrl ||
      file.uri;
    router.push({
      pathname: '/skripsiku/read',
      params: {
        id: file.id,
        name: file.name,
        uri: fileUri,
        size: file.size.toString(),
        type: file.type,
      },
    } as any);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="Skripsi Ku" showBack />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat file...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Skripsi Ku" showBack />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Upload Section (disabled — upload now happens on submission detail page) */}
        <View style={[styles.uploadSection, { opacity: 0.6 }]}>
          <TouchableOpacity
            style={[styles.uploadButton, { borderStyle: 'solid', borderColor: Colors.border }]}
            onPress={() =>
              Alert.alert(
                'Upload Dinonaktifkan',
                'Upload skripsi sekarang dilakukan dari halaman detail pengajuan yang sudah disetujui.'
              )
            }
            activeOpacity={0.7}
          >
            <View style={[styles.uploadIconContainer, { backgroundColor: '#F1F5F9' }]}>
              <Upload size={32} color={Colors.textTertiary} strokeWidth={2} />
            </View>
            <View style={styles.uploadTextContainer}>
              <Text style={[styles.uploadTitle, { color: Colors.textSecondary }]}>
                Upload File Skripsi
              </Text>
              <Text style={styles.uploadSubtitle}>
                Upload tersedia di halaman detail pengajuan (status Disetujui)
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Files List */}
        {files.length > 0 ? (
          <View style={styles.filesSection}>
            <Text style={styles.sectionTitle}>File yang Diupload</Text>
            {files.map((file) => (
              <View key={file.id} style={styles.fileCard}>
                <View style={styles.fileIconContainer}>
                  <FileText size={24} color={Colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                  </Text>
                </View>
                <View style={styles.fileActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleViewFile(file)}
                    activeOpacity={0.7}
                  >
                    <Eye size={18} color={Colors.primary} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteFile(file.id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={18} color={Colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <File size={48} color={Colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Belum Ada File</Text>
            <Text style={styles.emptySubtitle}>
              Upload file skripsi Anda untuk melihat di sini
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  uploadIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
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
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  fileMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
