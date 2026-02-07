/**
 * Executorch Vision Provider
 * 
 * Provides on-device computer vision capabilities including:
 * - Image classification
 * - Object detection
 * - OCR (Optical Character Recognition)
 * - Image segmentation
 * - Style transfer
 */

import { isExpoGo } from '../../utils/isExpoGo';
import {
  ClassificationModule,
  ObjectDetectionModule,
  OCRModule,
  VerticalOCRModule,
  ImageSegmentationModule,
  StyleTransferModule,
  EFFICIENTNET_V2_S,
  SSDLITE_320_MOBILENET_V3_LARGE,
  DEEPLAB_V3_RESNET50,
  STYLE_TRANSFER_CANDY,
  STYLE_TRANSFER_MOSAIC,
  STYLE_TRANSFER_RAIN_PRINCESS,
  STYLE_TRANSFER_UDNIE,
  OCR_ENGLISH,
  type Detection,
  type Segment,
  type OCRDetection,
} from 'react-native-executorch';

/** Vision model types */
export type VisionTask = 
  | 'classification' 
  | 'objectDetection' 
  | 'ocr' 
  | 'verticalOcr'
  | 'segmentation' 
  | 'styleTransfer';

/** Vision model info */
export interface VisionModelInfo {
  id: string;
  name: string;
  task: VisionTask;
  description: string;
  sizeMB: number;
  modelSource: any;
}

/** Available vision models */
export const VISION_MODELS: Record<string, VisionModelInfo> = {
  // Classification
  'efficientnet-v2-s': {
    id: 'efficientnet-v2-s',
    name: 'EfficientNet V2 S',
    task: 'classification',
    description: 'Image classification with 1000 ImageNet classes',
    sizeMB: 90,
    modelSource: EFFICIENTNET_V2_S,
  },
  // Object Detection
  'ssdlite-mobilenet': {
    id: 'ssdlite-mobilenet',
    name: 'SSDLite MobileNet V3',
    task: 'objectDetection',
    description: 'Object detection with COCO classes',
    sizeMB: 20,
    modelSource: SSDLITE_320_MOBILENET_V3_LARGE,
  },
  // Segmentation
  'deeplab-v3': {
    id: 'deeplab-v3',
    name: 'DeepLab V3 ResNet50',
    task: 'segmentation',
    description: 'Semantic image segmentation',
    sizeMB: 45,
    modelSource: DEEPLAB_V3_RESNET50,
  },
  // Style Transfer
  'style-candy': {
    id: 'style-candy',
    name: 'Candy Style',
    task: 'styleTransfer',
    description: 'Artistic candy style transfer',
    sizeMB: 15,
    modelSource: STYLE_TRANSFER_CANDY,
  },
  'style-mosaic': {
    id: 'style-mosaic',
    name: 'Mosaic Style',
    task: 'styleTransfer',
    description: 'Mosaic art style transfer',
    sizeMB: 15,
    modelSource: STYLE_TRANSFER_MOSAIC,
  },
  'style-rain-princess': {
    id: 'style-rain-princess',
    name: 'Rain Princess',
    task: 'styleTransfer',
    description: 'Rain Princess art style',
    sizeMB: 15,
    modelSource: STYLE_TRANSFER_RAIN_PRINCESS,
  },
  'style-udnie': {
    id: 'style-udnie',
    name: 'Udnie Style',
    task: 'styleTransfer',
    description: 'Udnie abstract art style',
    sizeMB: 15,
    modelSource: STYLE_TRANSFER_UDNIE,
  },
};

/** OCR language options */
export const OCR_LANGUAGES = {
  english: OCR_ENGLISH,
  // Add more languages as needed
};

/** Classification result */
export interface ClassificationResult {
  label: string;
  confidence: number;
}

/** Object detection result */
export interface ObjectDetectionResult {
  detections: Detection[];
}

/** OCR result */
export interface OCRResult {
  text: string;
  detections: OCRDetection[];
}

/** Segmentation result */
export interface SegmentationResult {
  segments: Segment[];
  mask: string; // base64 encoded mask image
}

/** Style transfer result */
export interface StyleTransferResult {
  image: string; // base64 encoded styled image
}

/** Executorch Vision Provider */
export class ExecutorchVisionProvider {
  private modules: Map<VisionTask, any> = new Map();
  private loadedModels: Map<VisionTask, string> = new Map();

  get id() {
    return 'executorch_vision' as const;
  }

  get name() {
    return 'ExecuTorch Vision';
  }

  /** Check if ExecuTorch is available */
  isSupported(): boolean {
    return !isExpoGo();
  }

  /** Get available models for a task */
  getModelsForTask(task: VisionTask): VisionModelInfo[] {
    return Object.values(VISION_MODELS).filter(m => m.task === task);
  }

  /** Get model info by ID */
  getModelInfo(modelId: string): VisionModelInfo | null {
    return VISION_MODELS[modelId] || null;
  }

  /** Check if a model is loaded for a task */
  isModelLoaded(task: VisionTask): boolean {
    return this.modules.has(task);
  }

  /** Load a vision model */
  async loadModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const modelInfo = VISION_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (!this.isSupported()) {
      throw new Error('ExecuTorch is not available in Expo Go');
    }

    try {
      // Clean up existing model for this task
      const existingModule = this.modules.get(modelInfo.task);
      if (existingModule) {
        existingModule.delete();
        this.modules.delete(modelInfo.task);
      }

      // Create appropriate module based on task
      let module: any;

      switch (modelInfo.task) {
        case 'classification':
          module = new ClassificationModule();
          break;
        case 'objectDetection':
          module = new ObjectDetectionModule();
          break;
        case 'ocr':
          module = new OCRModule();
          break;
        case 'verticalOcr':
          module = new VerticalOCRModule();
          break;
        case 'segmentation':
          module = new ImageSegmentationModule();
          break;
        case 'styleTransfer':
          module = new StyleTransferModule();
          break;
        default:
          throw new Error(`Unsupported task: ${modelInfo.task}`);
      }

      // Load the model
      await module.load(modelInfo.modelSource, onProgress);

      this.modules.set(modelInfo.task, module);
      this.loadedModels.set(modelInfo.task, modelId);

      console.log(`[Vision] Loaded ${modelInfo.task} model: ${modelInfo.name}`);
      return true;
    } catch (error) {
      console.error(`[Vision] Failed to load model:`, error);
      return false;
    }
  }

  /** Unload a model for a specific task */
  unloadModel(task: VisionTask): void {
    const module = this.modules.get(task);
    if (module) {
      module.delete();
      this.modules.delete(task);
      this.loadedModels.delete(task);
      console.log(`[Vision] Unloaded ${task} model`);
    }
  }

  /** Unload all models */
  unloadAll(): void {
    for (const [task, module] of this.modules) {
      module.delete();
      console.log(`[Vision] Unloaded ${task} model`);
    }
    this.modules.clear();
    this.loadedModels.clear();
  }

  /**
   * Classify an image
   * @param imageUri Local file URI of the image
   */
  async classify(imageUri: string): Promise<ClassificationResult[]> {
    const module = this.modules.get('classification');
    if (!module) {
      throw new Error('Classification model not loaded');
    }

    const result = await module.forward(imageUri);
    return result;
  }

  /**
   * Detect objects in an image
   * @param imageUri Local file URI of the image
   */
  async detectObjects(imageUri: string): Promise<ObjectDetectionResult> {
    const module = this.modules.get('objectDetection');
    if (!module) {
      throw new Error('Object detection model not loaded');
    }

    const result = await module.forward(imageUri);
    return { detections: result };
  }

  /**
   * Extract text from an image (OCR)
   * @param imageUri Local file URI of the image
   */
  async recognizeText(imageUri: string): Promise<OCRResult> {
    const module = this.modules.get('ocr');
    if (!module) {
      throw new Error('OCR model not loaded');
    }

    const result = await module.forward(imageUri);
    return {
      text: result.map((r: OCRDetection) => r.text).join(' '),
      detections: result,
    };
  }

  /**
   * Extract text from an image with vertical text support
   * @param imageUri Local file URI of the image
   * @param independentCharacters Whether to recognize characters independently
   */
  async recognizeVerticalText(
    imageUri: string, 
    independentCharacters: boolean = false
  ): Promise<OCRResult> {
    const module = this.modules.get('verticalOcr');
    if (!module) {
      throw new Error('Vertical OCR model not loaded');
    }

    const result = await module.forward(imageUri, independentCharacters);
    return {
      text: result.map((r: OCRDetection) => r.text).join(' '),
      detections: result,
    };
  }

  /**
   * Segment an image
   * @param imageUri Local file URI of the image
   */
  async segment(imageUri: string): Promise<SegmentationResult> {
    const module = this.modules.get('segmentation');
    if (!module) {
      throw new Error('Segmentation model not loaded');
    }

    const result = await module.forward(imageUri);
    return {
      segments: result.segments,
      mask: result.mask,
    };
  }

  /**
   * Apply style transfer to an image
   * @param imageUri Local file URI of the image
   */
  async transferStyle(imageUri: string): Promise<StyleTransferResult> {
    const module = this.modules.get('styleTransfer');
    if (!module) {
      throw new Error('Style transfer model not loaded');
    }

    const result = await module.forward(imageUri);
    return { image: result };
  }
}

// Export singleton instance
export const VisionProvider = new ExecutorchVisionProvider();
