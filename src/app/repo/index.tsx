import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components';
import { Colors } from '@/theme/theme';
import { Eye, FileText } from 'lucide-react-native';
import { Query } from 'react-native-appwrite';
import { storage } from '@/services/appwrite';
import { BUCKET_JOURNALS } from '@/models/types';

type RepoFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  viewUrl: string;
};

const stripOwnerPrefix = (name: string) => name.replace(/^owner_[A-Za-z0-9]+__/, '');

export default function RepoScreen() {
  const router = useRouter();
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await storage.listFiles({
        bucketId: BUCKET_JOURNALS,
        queries: [
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ],
      });

      setFiles(
        response.files.map((file) => ({
          id: file.$id,
          name: stripOwnerPrefix(file.name) || file.name,
          size: file.sizeOriginal || 0,
          type: file.mimeType || 'application/octet-stream',
          uploadedAt: file.$createdAt,
          viewUrl: storage.getFileViewURL(BUCKET_JOURNALS, file.$id).toString(),
        }))
      );
    } catch (error) {
      console.error('Failed to load repo files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = (file: RepoFile) => {
    router.push({
      pathname: '/skripsiku/read',
      params: {
        id: file.id,
        name: file.name,
        uri: file.viewUrl,
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
      <AppHeader title="Repository" showBack />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Repository</Text>
          <Text style={styles.subtitle}>
            Semua file skripsi yang diupload oleh mahasiswa dapat dilihat di sini.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : files.length > 0 ? (
          <View style={styles.filesSection}>
            <Text style={styles.sectionTitle}>Semua File Skripsi</Text>
            {files.map((file) => (
              <TouchableOpacity
                key={file.id}
                style={styles.fileCard}
                onPress={() => handleViewFile(file)}
                activeOpacity={0.7}
              >
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
                  <View style={styles.actionButton}>
                    <Eye size={18} color={Colors.primary} strokeWidth={2} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <FileText size={48} color={Colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Belum Ada File</Text>
            <Text style={styles.emptySubtitle}>
              Belum ada file skripsi yang diupload
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
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
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
