# React Native ExecuTorch Integration

This module provides a comprehensive integration layer for [react-native-executorch](https://docs.swmansion.com/react-native-executorch/) v0.8.0, enabling on-device AI inference for the project.

## Features

### 🤖 Natural Language Processing
- **LLMs**: Llama 3.2, Qwen 3, SmolLM2, Hammer 2.1 (tool calling), Phi 4
- **Speech-to-Text**: Whisper (Tiny, Base, Small) with multilingual support
- **Text-to-Speech**: Kokoro high-quality voices
- **Text Embeddings**: all-MiniLM, all-mpnet, CLIP

### 👁️ Computer Vision
- **Classification**: EfficientNet V2 S
- **Object Detection**: SSDLite MobileNet V3
- **OCR**: Multi-language text recognition
- **Image Segmentation**: DeepLab V3
- **Style Transfer**: Candy, Mosaic, Rain Princess, Udnie

### 🔧 Utilities
- Model management with download progress
- Streaming text generation
- Voice Activity Detection (VAD)
- Text-to-Image generation (Stable Diffusion)

## Quick Start

```tsx
import { 
  useLocalLLM, 
  LLAMA3_2_1B,
  useLocalSTT,
  WHISPER_TINY,
  useLocalTTS,
  KOKORO_MEDIUM,
  KOKORO_VOICE_AF_HEART 
} from '@/services/executorch';

// LLM Example
function ChatComponent() {
  const { 
    loadModel, 
    generateStream, 
    isReady, 
    isGenerating,
    response 
  } = useLocalLLM();

  useEffect(() => {
    loadModel('llama3.2-1b');
  }, []);

  const handleSend = async (message: string) => {
    const messages = [{ role: 'user', content: message }];
    for await (const chunk of generateStream(messages)) {
      console.log(chunk.text);
    }
  };
}
```

## Directory Structure

```
services/executorch/
├── index.ts              # Main exports
├── LLMProvider.ts        # Enhanced LLM provider
├── STTProvider.ts        # Speech-to-text provider
├── TTSProvider.ts        # Text-to-speech provider
├── VisionProvider.ts     # Computer vision provider
├── EmbeddingsProvider.ts # Embeddings provider
├── utils.ts              # Utility functions
├── hooks/                # React hooks
│   ├── useLocalLLM.ts
│   ├── useLocalSTT.ts
│   ├── useLocalTTS.ts
│   ├── useExecutorchVision.ts
│   └── useExecutorchEmbeddings.ts
└── README.md
```

## Available Hooks

### useLocalLLM
```tsx
const {
  isLoading,
  isGenerating,
  isReady,
  response,
  loadModel,
  generate,
  generateStream,
  interrupt,
} = useLocalLLM({ autoLoad: true, modelId: 'llama3.2-1b' });
```

### useLocalSTT
```tsx
const {
  isReady,
  transcribe,
  loadModel,
} = useLocalSTT({ autoLoad: true, modelId: 'whisper-tiny' });

// Usage
const waveform = new Float32Array(/* 16kHz audio */);
const text = await transcribe(waveform, { language: 'en' });
```

### useLocalTTS
```tsx
const {
  isReady,
  synthesize,
  synthesizeStream,
  stopSynthesis,
} = useLocalTTS({ 
  autoLoad: true, 
  modelId: 'kokoro-medium',
  voiceId: 'af-heart'
});

// Usage
const audio = await synthesize('Hello world', { speed: 1.0 });
```

### useExecutorchVision
```tsx
const {
  isReady,
  classify,
  detectObjects,
  recognizeText,
  segment,
  transferStyle,
} = useExecutorchVision();

// Usage
await loadModel('efficientnet-v2-s');
const results = await classify('file://image.jpg');
```

### useExecutorchEmbeddings
```tsx
const {
  isTextModelReady,
  embedText,
  embedTexts,
  cosineSimilarity,
  findMostSimilar,
} = useExecutorchEmbeddings({
  autoLoad: true,
  textModelId: 'all-minilm-l6-v2'
});

// Usage
const embedding = await embedText('Hello world');
const similar = findMostSimilar(query, candidates, 5);
```

## Available Models

### LLM Models
| Model | Size | Description |
|-------|------|-------------|
| smollm2-135m | ~300MB | Tiny, fastest |
| qwen3-0.6b-q | ~400MB | Fast, efficient |
| llama3.2-1b | ~2GB | High quality |
| hammer2.1-0.5b-q | ~350MB | Tool calling |
| phi-4-mini | ~2.5GB | Latest from Microsoft |

### STT Models
| Model | Size | Description |
|-------|------|-------------|
| whisper-tiny-en-q | ~25MB | Fastest, English only |
| whisper-tiny | ~40MB | Multilingual |
| whisper-base | ~75MB | Good balance |
| whisper-small | ~250MB | Best accuracy |

### TTS Voices
| Voice | Gender | Accent |
|-------|--------|--------|
| af-heart | Female | US |
| af-river | Female | US |
| af-sarah | Female | US |
| am-adam | Male | US |
| am-michael | Male | US |
| bf-emma | Female | UK |
| bm-daniel | Male | UK |

## Configuration

Update `src/config/localInference.ts` to enable/disable features:

```typescript
export const LOCAL_INFERENCE_ENABLED = {
  LLM: true,
  VISION: true,
  TTS: true,
  STT: true,
  RAG: true,
  EMBEDDINGS: true,
  VAD: false,
  TEXT_TO_IMAGE: false,
};
```

## Important Notes

1. **Expo Go**: ExecuTorch does not work in Expo Go. Use a development build.
2. **Memory**: Large models (1B+ parameters) require significant RAM (4GB+ recommended).
3. **Downloads**: Models are downloaded on-demand from HuggingFace.
4. **New Architecture**: Requires React Native 0.81+ with New Architecture enabled.

## Resources

- [ExecuTorch Documentation](https://docs.swmansion.com/react-native-executorch/)
- [HuggingFace Models](https://huggingface.co/software-mansion)
- [GitHub Repository](https://github.com/software-mansion/react-native-executorch)
