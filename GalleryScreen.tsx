/**
 * GalleryScreen
 * Displays all locally saved generated images in a grid layout.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  Modal,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { loadGallery, deleteGalleryItem, GalleryItem } from '../services/storage';
import { COLORS } from '../utils/theme';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3; // 3-column grid

export default function GalleryScreen() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  // Reload gallery whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadGallery().then(setItems);
    }, []),
  );

  const handleDelete = (item: GalleryItem) => {
    Alert.alert('Delete Image', 'Are you sure you want to delete this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGalleryItem(item.id);
          setItems(prev => prev.filter(i => i.id !== item.id));
          setSelected(null);
        },
      },
    ]);
  };

  const handleShare = async (item: GalleryItem) => {
    try {
      await Share.share({ url: `file://${item.filePath}` });
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message ?? 'Unknown error');
    }
  };

  const renderItem = ({ item }: { item: GalleryItem }) => (
    <TouchableOpacity onPress={() => setSelected(item)} style={styles.gridItem}>
      <Image
        source={{ uri: `file://${item.filePath}` }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Local Gallery</Text>
      <Text style={styles.subtitle}>{items.length} image{items.length !== 1 ? 's' : ''} saved</Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No images yet.</Text>
          <Text style={styles.emptyHint}>Generate an image and save it to see it here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && (
              <>
                <Image
                  source={{ uri: `file://${selected.filePath}` }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <Text style={styles.modalPrompt} numberOfLines={3}>
                  {selected.prompt}
                </Text>
                <Text style={styles.modalDate}>
                  {new Date(selected.createdAt).toLocaleString()}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtn} onPress={() => handleShare(selected)}>
                    <Text style={styles.modalBtnText}>📤 Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(selected)}
                  >
                    <Text style={styles.modalBtnText}>🗑 Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.closeBtn]}
                    onPress={() => setSelected(null)}
                  >
                    <Text style={styles.modalBtnText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.placeholder,
    marginBottom: 12,
  },
  grid: {
    paddingBottom: 20,
  },
  gridItem: {
    margin: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumbnail: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: COLORS.surface,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.placeholder,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 420,
  },
  modalImage: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  modalPrompt: {
    color: COLORS.text,
    fontSize: 13,
    marginTop: 10,
    fontStyle: 'italic',
  },
  modalDate: {
    color: COLORS.placeholder,
    fontSize: 12,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  modalBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#c0392b',
  },
  closeBtn: {
    backgroundColor: COLORS.border,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
