/**
 * API Service
 * Handles all communication with the local FastAPI backend.
 */

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerateParams {
  prompt: string;
  negative_prompt?: string;
  denoising_strength?: number;
  cfg_scale?: number;
  steps?: number;
  sampler?: string;
  checkpoint?: string;
  width?: number;
  height?: number;
  use_controlnet?: boolean;
  controlnet_model?: string;
  restore_faces?: boolean;
  enable_hr?: boolean;
  hr_scale?: number;
  hr_upscaler?: string;
  imageUri: string;
  imageMime?: string;
}

export interface GenerateResult {
  image: string; // base64 encoded
}

export interface SDModel {
  title: string;
  model_name: string;
  filename: string;
}

export interface ModelsResult {
  models: SDModel[];
}

// ─── Config Storage Key ───────────────────────────────────────────────────────
const SERVER_URL_KEY = '@LocalAI:serverUrl';
const DEFAULT_SERVER_URL = 'http://192.168.1.10:8000';

// ─── API Client Factory ───────────────────────────────────────────────────────

let _client: AxiosInstance | null = null;
let _baseUrl: string = DEFAULT_SERVER_URL;

export async function initApiClient(): Promise<void> {
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  _baseUrl = stored ?? DEFAULT_SERVER_URL;
  _client = axios.create({
    baseURL: _baseUrl,
    timeout: 120_000, // 2 minutes for long generations
  });
}

export async function setServerUrl(url: string): Promise<void> {
  _baseUrl = url.replace(/\/$/, ''); // strip trailing slash
  await AsyncStorage.setItem(SERVER_URL_KEY, _baseUrl);
  _client = axios.create({ baseURL: _baseUrl, timeout: 120_000 });
}

export async function getServerUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
  return stored ?? DEFAULT_SERVER_URL;
}

function getClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({ baseURL: _baseUrl, timeout: 120_000 });
  }
  return _client;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/** Fetch available SD model checkpoints */
export async function fetchModels(): Promise<SDModel[]> {
  const res = await getClient().get<ModelsResult>('/models');
  return res.data.models;
}

/** Fetch available samplers */
export async function fetchSamplers(): Promise<string[]> {
  const res = await getClient().get<{ samplers: string[] }>('/samplers');
  return res.data.samplers;
}

/** Fetch available upscalers */
export async function fetchUpscalers(): Promise<string[]> {
  const res = await getClient().get<{ upscalers: string[] }>('/upscalers');
  return res.data.upscalers;
}

/** Fetch available ControlNet models */
export async function fetchControlNetModels(): Promise<string[]> {
  const res = await getClient().get<{ controlnet_models: string[] }>('/controlnet-models');
  return res.data.controlnet_models;
}

/** Health check */
export async function healthCheck(): Promise<boolean> {
  try {
    await getClient().get('/', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send an img2img generation request.
 * Returns the generated image as a base64 string.
 */
export async function generateImage(params: GenerateParams): Promise<string> {
  const formData = new FormData();

  formData.append('prompt', params.prompt);
  formData.append('negative_prompt', params.negative_prompt ?? '');
  formData.append('denoising_strength', String(params.denoising_strength ?? 0.5));
  formData.append('cfg_scale', String(params.cfg_scale ?? 7));
  formData.append('steps', String(params.steps ?? 20));
  formData.append('sampler', params.sampler ?? 'Euler a');
  formData.append('width', String(params.width ?? 512));
  formData.append('height', String(params.height ?? 512));
  formData.append('restore_faces', String(params.restore_faces ?? false));
  formData.append('enable_hr', String(params.enable_hr ?? false));
  formData.append('hr_scale', String(params.hr_scale ?? 2.0));
  formData.append('hr_upscaler', params.hr_upscaler ?? 'Latent');
  formData.append('use_controlnet', String(params.use_controlnet ?? false));
  formData.append('controlnet_model', params.controlnet_model ?? 'control_v11p_sd15_openpose');

  if (params.checkpoint) {
    formData.append('checkpoint', params.checkpoint);
  }

  // Attach the image file
  formData.append('file', {
    uri: params.imageUri,
    type: params.imageMime ?? 'image/jpeg',
    name: 'input.jpg',
  } as any);

  const res = await getClient().post<GenerateResult>('/generate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return res.data.image;
}
