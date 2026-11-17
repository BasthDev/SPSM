import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BellRing, FileCheck2, RefreshCcw, Sparkles } from 'lucide-react-native';
import { Colors } from '@/theme/theme';

export interface CarouselSlideData {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  colors: readonly [string, string, ...string[]];
  badge?: string;
}

export const DEFAULT_DASHBOARD_SLIDES: CarouselSlideData[] = [
  {
    id: 'realtime',
    title: 'Update Real-time',
    description: 'Status & notifikasi pengajuan berubah otomatis tanpa perlu reload.',
    icon: <BellRing size={22} color="#FFFFFF" strokeWidth={2.3} />,
    colors: ['#0284C7', '#0369A1'],
    badge: 'LIVE',
  },
  {
    id: 'revision',
    title: 'Ajukan Ulang Cepat',
    description: 'Data dan dokumen judul otomatis terisi saat pengajuan revisi.',
    icon: <RefreshCcw size={22} color="#FFFFFF" strokeWidth={2.3} />,
    colors: ['#2563EB', '#1D4ED8'],
    badge: 'PRAKTIS',
  },
  {
    id: 'digital_doc',
    title: 'SK & Surat Digital',
    description: 'Pantau nomor dokumen dan unduh berkas resmi langsung dari aplikasi.',
    icon: <FileCheck2 size={22} color="#FFFFFF" strokeWidth={2.3} />,
    colors: ['#0D9488', '#0F766E'],
    badge: 'RESMI',
  },
  {
    id: 'ai_check',
    title: 'Cek Kemiripan AI',
    description: 'Pemeriksaan orisinalitas judul terintegrasi untuk mencegah duplikasi.',
    icon: <Sparkles size={22} color="#FFFFFF" strokeWidth={2.3} />,
    colors: ['#4F46E5', '#3730A3'],
    badge: 'SMART',
  },
];

type CarouselProps = {
  /** Daftar slide custom (opsional). Jika tidak disediakan, slide default dashboard akan digunakan. */
  slides?: React.ReactNode[];
  /** Data slide terstruktur (opsional). */
  items?: CarouselSlideData[];
  /** Tinggi area carousel (default 108). */
  height?: number;
  /** Auto-scroll interval ms (default 4000). Set 0 untuk nonaktifkan. */
  autoPlayMs?: number;
  style?: ViewStyle;
};

/**
 * Carousel horizontal mandiri untuk dashboard.
 * Dilengkapi styling internal, pagination snap presisi, dan dot indicator responsif.
 */
export const Carousel: React.FC<CarouselProps> = ({
  slides,
  items,
  height = 108,
  autoPlayMs = 4000,
  style,
}) => {
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Gunakan slides kustom jika ada, atau render dari items/default slides
  const slideItems = items || (slides ? null : DEFAULT_DASHBOARD_SLIDES);
  const count = slides ? slides.length : (slideItems ? slideItems.length : 0);

  // Auto-play loop
  useEffect(() => {
    if (!autoPlayMs || count < 2 || containerWidth === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % count;
        listRef.current?.scrollToOffset({
          offset: next * containerWidth,
          animated: true,
        });
        return next;
      });
    }, autoPlayMs);

    return () => clearInterval(timer);
  }, [autoPlayMs, count, containerWidth]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth <= 0) return;
    const currentOffset = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(currentOffset / containerWidth);
    if (newIdx !== index && newIdx >= 0 && newIdx < count) {
      setIndex(newIdx);
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  if (count === 0) return null;

  return (
    <View style={[styles.wrap, { height }, style]} onLayout={onLayout}>
      {containerWidth > 0 && (
        <FlatList
          ref={listRef}
          data={slides ? slides : slideItems!}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={containerWidth}
          snapToAlignment="start"
          renderItem={({ item, index: itemIdx }) => {
            if (slides) {
              return (
                <View style={[styles.slideContainer, { width: containerWidth, height }]}>
                  {item as React.ReactNode}
                </View>
              );
            }
            const slide = item as CarouselSlideData;
            return (
              <View style={[styles.slideContainer, { width: containerWidth, height }]}>
                <LinearGradient
                  colors={slide.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, { height }]}
                >
                  <View style={styles.iconCircle}>
                    {slide.icon}
                  </View>
                  <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title} numberOfLines={1}>
                        {slide.title}
                      </Text>
                      {slide.badge && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{slide.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.desc} numberOfLines={2}>
                      {slide.description}
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            );
          }}
        />
      )}

      {/* Modern Pill / Dot Indicators */}
      {count > 1 && (
        <View style={styles.indicatorContainer} pointerEvents="none">
          {Array.from({ length: count }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  slideContainer: {
    paddingHorizontal: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 12.5,
    color: '#E0F2FE',
    lineHeight: 17,
    fontWeight: '500',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 8,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 4.5,
    borderRadius: 3,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
});
