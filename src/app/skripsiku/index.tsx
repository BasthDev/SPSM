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
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type UploadedFile = {
  id: string;
  name: string;
  uri: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export default function SkripsiKuScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const newFile: UploadedFile = {
        id: Date.now().toString(),
        name: asset.name,
        uri: asset.uri,
        size: asset.size || 0,
        type: asset.mimeType || 'application/msword',
        uploadedAt: new Date().toISOString(),
      };

      setFiles((prev) => [newFile, ...prev]);
      Alert.alert('Berhasil', 'File skripsi berhasil diupload');
    } catch (error) {
      Alert.alert('Error', 'Gagal memilih file');
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
          onPress: () => {
            setFiles((prev) => prev.filter((f) => f.id !== fileId));
          },
        },
      ]
    );
  };

  const handleViewFile = (file: UploadedFile) => {
    // Pass file data as params
    router.push({
      pathname: '/skripsiku/read',
      params: {
        id: file.id,
        name: file.name,
        uri: file.uri,
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
              <Text style={styles.uploadTitle}>Upload File Skripsi</Text>
              <Text style={styles.uploadSubtitle}>
                Pilih file Word (.doc, .docx) untuk diupload
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
