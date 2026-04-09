/**
 * Local Storage Service
 * Handles saving generated images to the device and managing local gallery.
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const GALLERY_KEY = '@LocalAI:gallery';
const PICTURES_DIR = `${RNFS.ExternalStorageDirectoryPath}/Pictures/LocalAI`;

export interface GalleryItem {
  id: string;
  filePath: string;
  prompt: string;
  createdAt: string;
  thumbnail?: string; // base64 thumbnail
}

/** Ensure the LocalAI pictures directory exists */
async function ensureDir(): Promise<void> {
  const exists = await RNFS.exists(PICTURES_DIR);
  if (!exists) {
    await RNFS.mkdir(PICTURES_DIR);
  }
}

/** Save a base64 image to the device storage and record it in the gallery */
export async function saveGeneratedImage(
  base64Image: string,
  prompt: string,
): Promise<GalleryItem> {
  await ensureDir();

  const id = Date.now().toString();
  const fileName = `localai_${id}.jpg`;
  const filePath = `${PICTURES_DIR}/${fileName}`;

  // Write the file
  await RNFS.writeFile(filePath, base64Image, 'base64');

  const item: GalleryItem = {
    id,
    filePath,
    prompt,
    createdAt: new Date().toISOString(),
  };

  // Update gallery index in AsyncStorage
  const existing = await loadGallery();
  existing.unshift(item); // newest first
  await AsyncStorage.setItem(GALLERY_KEY, JSON.stringify(existing));

  return item;
}

/** Load the full gallery index */
export async function loadGallery(): Promise<GalleryItem[]> {
  const raw = await AsyncStorage.getItem(GALLERY_KEY);
  if (!raw) return [];
  try {
    const items: GalleryItem[] = JSON.parse(raw);
    // Filter out items whose files no longer exist
    const valid: GalleryItem[] = [];
    for (const item of items) {
      const exists = await RNFS.exists(item.filePath);
      if (exists) valid.push(item);
    }
    return valid;
  } catch {
    return [];
  }
}

/** Delete a gallery item and its file */
export async function deleteGalleryItem(id: string): Promise<void> {
  const items = await loadGallery();
  const item = items.find(i => i.id === id);
  if (item) {
    try {
      await RNFS.unlink(item.filePath);
    } catch {
      // File may already be gone
    }
  }
  const updated = items.filter(i => i.id !== id);
  await AsyncStorage.setItem(GALLERY_KEY, JSON.stringify(updated));
}

/** Read a saved image as base64 */
export async function readImageAsBase64(filePath: string): Promise<string> {
  return RNFS.readFile(filePath, 'base64');
}

/** Save presets */
const PRESETS_KEY = '@LocalAI:presets';

export interface Preset {
  id: string;
  name: string;
  prompt: string;
  negative_prompt: string;
  denoising_strength: number;
  cfg_scale: number;
  steps: number;
  sampler: string;
  createdAt: string;
}

export async function savePreset(preset: Omit<Preset, 'id' | 'createdAt'>): Promise<Preset> {
  const full: Preset = {
    ...preset,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  const existing = await loadPresets();
  existing.unshift(full);
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(existing));
  return full;
}

export async function loadPresets(): Promise<Preset[]> {
  const raw = await AsyncStorage.getItem(PRESETS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function deletePreset(id: string): Promise<void> {
  const items = await loadPresets();
  const updated = items.filter(i => i.id !== id);
  await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
}
