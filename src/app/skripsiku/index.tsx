import { AppHeader } from '@/components';
import { Colors } from '@/theme/theme';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import {
  Eye,
  File,
  FileText,
  Trash2,
  Upload
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ID, Query } from 'react-native-appwrite';
import { account, storage } from '@/services/appwrite';
import { BUCKET_JOURNALS } from '@/models/types';

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
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load current user, then load only their files from Appwrite storage
  useEffect(() => {
    (async () => {
      try {
        const current = await account.get();
        setUserId(current.$id);
        await loadFiles(current.$id);
      } catch (error) {
        console.error('Failed to get current user:', error);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFiles = async (uid: string) => {
    try {
      setLoading(true);
      const prefix = ownerPrefix(uid);

      // Storage has no fulltext index on name, so paginate and filter client-side
      const allFiles: any[] = [];
      let cursor: string | undefined;
      while (true) {
        const queries = [
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const response = await storage.listFiles({
          bucketId: BUCKET_JOURNALS,
          queries,
        });
        allFiles.push(...response.files);
        if (response.files.length < 100) break;
        cursor = response.files[response.files.length - 1].$id;
      }

      const uploadedFiles: UploadedFile[] = allFiles
        .filter((file) => file.name.startsWith(prefix))
        .map((file) => ({
          id: file.$id,
          name: stripOwnerPrefix(file.name) || file.name,
          uri: storage.getFileDownloadURL(BUCKET_JOURNALS, file.$id).toString(),
          size: file.sizeOriginal || 0,
          type: file.mimeType || 'application/octet-stream',
          uploadedAt: file.$createdAt,
          appwriteId: file.$id,
          viewUrl: storage.getFileViewURL(BUCKET_JOURNALS, file.$id).toString(),
        }));

      setFiles(uploadedFiles);
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const isPdf =
        (asset.mimeType || '').toLowerCase() === 'application/pdf' ||
        (asset.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        Alert.alert('Format Tidak Didukung', 'Hanya file PDF yang dapat diupload.');
        return;
      }
      if (!userId) {
        Alert.alert('Error', 'Sesi tidak ditemukan. Silakan login ulang.');
        return;
      }
      setUploading(true);

      const storedName = `${ownerPrefix(userId)}${asset.name}`;

      // Upload file to Appwrite with correct format for react-native-appwrite
      const uploadedFile = await storage.createFile({
        bucketId: BUCKET_JOURNALS,
        fileId: ID.unique(),
        file: {
          uri: asset.uri,
          name: storedName,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
        },
        permissions: [
          'read("any")',
          `update("user:${userId}")`,
          `delete("user:${userId}")`,
        ],
      });

      const newFile: UploadedFile = {
        id: uploadedFile.$id,
        name: asset.name,
        uri: storage.getFileDownloadURL(BUCKET_JOURNALS, uploadedFile.$id).toString(),
        size: asset.size || 0,
        type: asset.mimeType || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        appwriteId: uploadedFile.$id,
        viewUrl: storage.getFileViewURL(BUCKET_JOURNALS, uploadedFile.$id).toString(),
      };

      setFiles((prev) => [newFile, ...prev]);
      Alert.alert('Berhasil', 'File skripsi berhasil diupload');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', `Gagal upload file: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

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
              // Delete from Appwrite storage
              await storage.deleteFile({
                bucketId: BUCKET_JOURNALS,
                fileId: fileId,
              });
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

  const handleViewFile = (file: UploadedFile) => {
    // Use Appwrite view URL if available, otherwise use local URI
    const fileUri = file.viewUrl || file.uri;
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
        {/* Upload Section */}
        <View style={styles.uploadSection}>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickDocument}
            activeOpacity={0.7}
            disabled={uploading}
          >
            <View style={styles.uploadIconContainer}>
              <Upload size={32} color={Colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.uploadTextContainer}>
              <Text style={styles.uploadTitle}>
                {uploading ? 'Mengupload...' : 'Upload File Skripsi'}
              </Text>
              <Text style={styles.uploadSubtitle}>
                Pilih file PDF skripsi Anda
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
