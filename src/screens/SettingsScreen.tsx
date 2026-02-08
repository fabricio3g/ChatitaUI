/**
 * Settings Screen
 * Comprehensive settings management for AI, TTS, STT, Vision, and LLM models.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    Switch,
    Alert,
    ActivityIndicator,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { LLMService } from '../services/llm/LLMService';
import { LLMProviderId, ModelMode } from '../services/llm/types';
import { useNavigation } from '@react-navigation/native';
import { StatusModal } from '../components/common/StatusModal';
import { ThemeName } from '../theme';
import { STTProviderType as STTProvider, STTService } from '../services/stt/STTService';
import { TTSService } from '../services/tts/TTSService';
import { LOCAL_INFERENCE_ENABLED, hasLocalInference } from '../config/localInference';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { WHISPER_MODELS } from '../services/stt/WhisperProvider';
import { SettingsBus } from '../services/SettingsBus';

// Conditionally import local inference modules - only load when enabled
let WhisperSTT: any = null;
let EFFICIENT_TEXT_PRESETS: any[] = [];
let VISUAL_MODELS: any[] = [];
let AUDIO_MODELS: any[] = [];
let downloadLlamaModel: any = null;
let deleteLlamaModel: any = null;
let getDownloadedLlamaModels: any = null;
let setGlobalActiveLlama: any = null;
let getGlobalActiveLlama: any = null;
let loadLlamaModelFromFile: any = null;
let LLAMA_CANCELLED: any = null;

const loadLocalInferenceModules = async () => {
    if (LOCAL_INFERENCE_ENABLED.STT) {
        try {
            const whisperModule = await import('../services/stt/WhisperProvider');
            WhisperSTT = whisperModule.WhisperSTT;
            // WHISPER_MODELS is now statically imported from ExecutorchSTTProvider
        } catch (e) {
            console.warn('[SettingsScreen] Failed to load Whisper modules:', e);
        }
    }

    if (LOCAL_INFERENCE_ENABLED.LLM) {
        try {
            const llamaModule = await import('../services/llm/llama/models');
            EFFICIENT_TEXT_PRESETS = llamaModule.EFFICIENT_TEXT_PRESETS;
            VISUAL_MODELS = llamaModule.VISUAL_MODELS;
            AUDIO_MODELS = llamaModule.AUDIO_MODELS;
            downloadLlamaModel = llamaModule.downloadLlamaModel;
            deleteLlamaModel = llamaModule.deleteLlamaModel;
            getDownloadedLlamaModels = llamaModule.getDownloadedLlamaModels;
            setGlobalActiveLlama = llamaModule.setActiveLlamaModel;
            getGlobalActiveLlama = llamaModule.getActiveLlamaModel;
            loadLlamaModelFromFile = llamaModule.loadLlamaModelFromFile;
            LLAMA_CANCELLED = llamaModule.CANCELLED;
        } catch (e) {
            console.warn('[SettingsScreen] Failed to load Llama modules:', e);
        }
    }
};

const AI_PROVIDERS: Record<string, any> = {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-pro-1.5' },
    groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama3-70b-8192' },
    mistral: { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-large-latest' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
    ...(LOCAL_INFERENCE_ENABLED.LLM ? { local: { name: 'Local (Ollama/LMStudio)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' } } : {}),
    ...(LOCAL_INFERENCE_ENABLED.LLM ? { llama_rn: { name: 'Local GGUF (On-Device)', baseUrl: '', defaultModel: '' } } : {}),
};

const STT_PROVIDERS = [
    ...(LOCAL_INFERENCE_ENABLED.STT ? [{ id: 'whisper_local', name: 'Whisper Local', description: 'On-device Whisper model (privacy-focused)' }] : []),
    { id: 'api', name: 'API (OpenAI/Custom)', description: 'Cloud-based transcription service' },
];

const TTS_PROVIDERS = [
    { id: 'system', name: 'System (Device)' },
    { id: 'custom', name: 'API (Custom/OpenAI compatible)' },
];

const IMAGE_GEN_PROVIDERS = {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-1' },
    openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-image-1' },
    custom: { name: 'Custom (OpenAI Compatible)', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-1' },
};

type TTSProviderId = 'system' | 'custom';

const CollapsibleSection = ({ title, icon, isExpanded, onToggle, children, badge, description }: any) => {
    const { theme } = useTheme();
    return (
        <View style={[styles.section, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
            <Pressable style={styles.sectionHeader} onPress={onToggle}>
                <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}10` }]}>
                        <Feather name={icon as any} size={18} color={theme.colors.primary} />
                    </View>
                    <View style={styles.sectionTitleContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
                        {description && (
                            <Text style={[styles.sectionDescription, { color: theme.colors.textTertiary }]}>
                                {description}
                            </Text>
                        )}
                    </View>
                    {badge && (
                        <View style={[styles.badge, { backgroundColor: theme.colors.surfaceHighlight }]}>
                            <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>{badge}</Text>
                        </View>
                    )}
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textTertiary} />
            </Pressable>
            {isExpanded && <View style={styles.sectionContent}>{children}</View>}
        </View>
    );
};

const CompactInput = ({ label, value, onChangeText, placeholder, secure, multiline, keyboardType }: any) => {
    const { theme } = useTheme();
    return (
        <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.colors.surfaceHighlight,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        height: multiline ? 80 : 44,
                        textAlignVertical: multiline ? 'top' : 'center',
                    }
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry={secure}
                multiline={multiline}
                keyboardType={keyboardType}
            />
        </View>
    );
};

const ChipSelector = ({ options, selected, onSelect }: any) => {
    const { theme } = useTheme();
    return (
        <View style={styles.chipGrid}>
            {options.map((opt: any) => {
                const isSelected = selected === opt.key;
                return (
                    <Pressable
                        key={opt.key}
                        onPress={() => onSelect(opt.key)}
                        style={[
                            styles.chip,
                            {
                                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceHighlight,
                                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                            }
                        ]}
                    >
                        <Text style={[styles.chipText, { color: isSelected ? '#fff' : theme.colors.textSecondary }]}>
                            {opt.label}
                        </Text>
                        {opt.description && !isSelected && (
                            <Text style={[styles.chipDescription, { color: theme.colors.textTertiary }]}>
                                {opt.description}
                            </Text>
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
};

// Model Item Component - Full management UI for each model
const ModelItem = ({
    model,
    isDownloaded,
    isActive,
    isLoaded,
    isLoading,
    progress,
    onDownload,
    onDelete,
    onActivate,
    onLoad,
    onUnload,
    onCancel,
    theme
}: any) => {
    const isDownloading = progress !== undefined && progress < 1;
    const progressPercent = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress * 100))) : 0;

    return (
        <View style={[styles.modelCard, { borderColor: theme.colors.border }]}>
            <View style={styles.modelInfo}>
                <View style={styles.modelNameRow}>
                    <Text style={[styles.modelName, { color: theme.colors.text }]}>
                        {model.name}
                    </Text>
                    {isActive && (
                        <View style={[styles.activeIndicator, { backgroundColor: theme.colors.success + '20' }]}>
                            <Feather name="check" size={12} color={theme.colors.success} />
                            <Text style={[styles.activeIndicatorText, { color: theme.colors.success }]}>Active</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.modelMeta, { color: theme.colors.textTertiary }]}>
                    {model.sizeGB}GB • {model.quantization} • {model.contextSize.toLocaleString()} ctx
                </Text>
                <Text style={[styles.modelDescription, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                    {model.description}
                </Text>
                {isDownloading && (
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: theme.colors.primary }]} />
                    </View>
                )}
                {isDownloading && (
                    <Text style={[styles.modelProgressText, { color: theme.colors.textTertiary }]}>
                        Downloading… {progressPercent}%
                    </Text>
                )}
            </View>
            <View style={styles.modelActions}>
                {isDownloaded ? (
                    <>
                        <Pressable
                            onPress={onActivate}
                            disabled={isActive}
                            style={[
                                styles.modelActionBtn,
                                {
                                    backgroundColor: isActive ? theme.colors.success : theme.colors.primary,
                                    opacity: isActive ? 0.7 : 1
                                }
                            ]}
                        >
                            <Feather name={isActive ? 'check' : 'play'} size={14} color="#fff" />
                            <Text style={styles.modelActionText}>{isActive ? 'Active' : 'Set Active'}</Text>
                        </Pressable>
                        {onLoad && onUnload && (
                            <Pressable
                                onPress={isLoaded ? onUnload : onLoad}
                                disabled={isLoading}
                                style={[
                                    styles.modelActionBtn,
                                    { backgroundColor: isLoaded ? theme.colors.warning : theme.colors.primary }
                                ]}
                            >
                                <Feather name={isLoaded ? 'stop-circle' : 'zap'} size={14} color="#fff" />
                                <Text style={styles.modelActionText}>
                                    {isLoaded ? 'Unload' : 'Load'}
                                </Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={onDelete}
                            style={[styles.modelActionBtn, { backgroundColor: theme.colors.error }]}
                        >
                            <Feather name="trash-2" size={14} color="#fff" />
                            <Text style={styles.modelActionText}>Delete</Text>
                        </Pressable>
                    </>
                ) : (
                    <>
                        {isDownloading && onCancel && (
                            <Pressable
                                style={[styles.modelActionBtn, { backgroundColor: theme.colors.error }]}
                                onPress={onCancel}
                            >
                                <Feather name="x" size={14} color="#fff" />
                                <Text style={styles.modelActionText}>Cancel</Text>
                            </Pressable>
                        )}
                        <Pressable
                            disabled={isDownloading}
                            style={[
                                styles.modelActionBtn,
                                { backgroundColor: isDownloading ? theme.colors.surfaceHighlight : theme.colors.primary }
                            ]}
                            onPress={onDownload}
                        >
                            {isDownloading ? (
                                <ActivityIndicator size="small" color={theme.colors.textTertiary} />
                            ) : (
                                <>
                                    <Feather name="download" size={14} color="#fff" />
                                    <Text style={styles.modelActionText}>Download</Text>
                                </>
                            )}
                        </Pressable>
                    </>
                )}
            </View>
        </View>
    );
};

export const SettingsScreen = () => {
    const { theme, themeName, setThemeName } = useTheme();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    // === MODE SELECTION ===
    // Single mode only: Mixed
    const mode: ModelMode = 'mixed';

    // AI Provider settings (API mode)
    const [apiKey, setApiKey] = useState('');
    const [provider, setProvider] = useState<LLMProviderId>('openai');
    const [model, setModel] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [connectionTesting, setConnectionTesting] = useState(false);
    const [apiModelsLoading, setApiModelsLoading] = useState(false);
    const [apiModels, setApiModels] = useState<string[]>([]);

    // === VISION CONFIGURATION (NEW) ===
    const [useSeparateVision, setUseSeparateVision] = useState(false);
    const [visionProvider, setVisionProvider] = useState<LLMProviderId>('openai');
    const [visionModel, setVisionModel] = useState('gpt-4o');
    const [visionBaseUrl, setVisionBaseUrl] = useState('');
    const [visionApiKey, setVisionApiKey] = useState('');
    /** When mode === 'mixed' and useSeparateVision: API vs Local vision source */
    const [visionSourceMixed, setVisionSourceMixed] = useState<'api' | 'local'>('api');

    // === LOCAL MODELS CONFIG (Local mode) ===
    const [localLlmModel, setLocalLlmModel] = useState<string | null>(null);
    const [localVisionModel, setLocalVisionModel] = useState<string | null>(null);

    // TTS settings
    const [ttsProvider, setTtsProvider] = useState<TTSProviderId>('system');
    const [ttsVoice, setTtsVoice] = useState('');
    const [ttsApiKey, setTtsApiKey] = useState('');
    const [ttsBaseUrl, setTtsBaseUrl] = useState('https://api.openai.com/v1/audio/speech');
    const [ttsModel, setTtsModel] = useState('tts-1');

    // STT settings - ALWAYS INDEPENDENT
    const [sttProvider, setSttProvider] = useState<STTProvider>(LOCAL_INFERENCE_ENABLED.STT ? 'whisper_local' : 'api');
    const [sttApiKey, setSttApiKey] = useState('');
    const [sttBaseUrl, setSttBaseUrl] = useState('https://api.openai.com/v1');
    const [activeWhisperModel, setActiveWhisperModel] = useState<string>('whisper-tiny');

    // Other settings
    const [systemPrompt, setSystemPrompt] = useState('');
    const [temperature, setTemperature] = useState('0.7');
    const [maxTokens, setMaxTokens] = useState('2048');
    const [streamEnabled, setStreamEnabled] = useState(true);
    const [userName, setUserName] = useState('');
    const [userPersona, setUserPersona] = useState('');
    const [showReasoning, setShowReasoning] = useState(true);
    const [simulatedToolsEnabled, setSimulatedToolsEnabled] = useState(true);
    const [streamingChunksEnabled, setStreamingChunksEnabled] = useState(true);
    const [useGpsForSearch, setUseGpsForSearch] = useState(true);
    const [searchProvider, setSearchProvider] = useState<'headless' | 'searxng' | 'duckduckgo' | 'brave'>('headless');
    const [searchBaseUrl, setSearchBaseUrl] = useState('');
    const [searchApiKey, setSearchApiKey] = useState('');
    const [ddgBaseUrl, setDdgBaseUrl] = useState('https://api.duckduckgo.com');
    const [ddgApiKey, setDdgApiKey] = useState('');
    const [braveBaseUrl, setBraveBaseUrl] = useState('https://api.search.brave.com/res/v1/web/search');
    const [braveApiKey, setBraveApiKey] = useState('');

    // Image generation (tool) settings
    const [imageGenProvider, setImageGenProvider] = useState<'openai' | 'openrouter' | 'custom'>('openai');
    const [imageGenApiKey, setImageGenApiKey] = useState('');
    const [imageGenBaseUrl, setImageGenBaseUrl] = useState(IMAGE_GEN_PROVIDERS.openai.baseUrl);
    const [imageGenModel, setImageGenModel] = useState(IMAGE_GEN_PROVIDERS.openai.defaultModel);
    const [imageGenSize, setImageGenSize] = useState<'1024x1024' | '1024x1792' | '1792x1024'>('1024x1024');

    const [isLoading, setIsLoading] = useState(true);

    // UI Expand States
    const [expandedSections, setExpandedSections] = useState<string[]>(['ai_provider', 'stt', 'tts']);

    // Status Modal
    const [statusModal, setStatusModal] = useState<{ visible: boolean; type: 'success' | 'error' | 'info'; title: string; message: string }>({
        visible: false,
        type: 'success',
        title: '',
        message: ''
    });

    // Model states
    const [downloadedLlamaModels, setDownloadedLlamaModels] = useState<any[]>([]);
    const [downloadedWhisperModels, setDownloadedWhisperModels] = useState<string[]>([]);
    const WHISPER_MODEL_DIR = `${FileSystem.documentDirectory}whisper_models/`;

    const loadWhisperDownloadsFallback = async (): Promise<string[]> => {
        try {
            const dirInfo = await FileSystem.getInfoAsync(WHISPER_MODEL_DIR);
            if (!dirInfo.exists) return [];
            const files = await FileSystem.readDirectoryAsync(WHISPER_MODEL_DIR);
            return Object.keys(WHISPER_MODELS).filter(id => files.includes(`${id}.bin`));
        } catch {
            return [];
        }
    };

    // Progress tracking
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
    /** Cancel functions for in-progress downloads (llama/whisper keyed by modelId) */
    const downloadCancelRef = useRef<Record<string, () => Promise<void>>>({});
    const [loadedLocalModelId, setLoadedLocalModelId] = useState<string | null>(null);
    const [localModelLoading, setLocalModelLoading] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
        loadLocalInferenceModules();
    }, []);

    const loadSettings = async () => {
        try {
            const values = await AsyncStorage.multiGet([
                'settings_apiKey',
                'settings_provider',
                'settings_model',
                'settings_baseUrl',
                'settings_useSeparateVision',
                'settings_visionProvider',
                'settings_visionModel',
                'settings_visionBaseUrl',
                'settings_visionApiKey',
                'settings_visionSourceMixed',
                'settings_localLlmModel',
                'settings_localVisionModel',
                'settings_ttsProvider',
                'settings_ttsVoice',
                'settings_ttsApiKey',
                'settings_ttsBaseUrl',
                'settings_ttsModel',
                'settings_systemPrompt',
                'settings_temperature',
                'settings_maxTokens',
                'settings_stream',
                'settings_userName',
                'settings_userPersona',
                'settings_sttProvider',
                'settings_sttApiKey',
                'settings_sttBaseUrl',
                'settings_whisper_model',
                'settings_activeLlamaModel',
                'settings_showReasoning',
                'settings_simulatedToolsEnabled',
                'settings_streamingChunksEnabled',
                'settings_useGpsForSearch',
                'settings_searchProvider',
                'settings_searchBaseUrl',
                'settings_searchApiKey',
                'settings_ddgBaseUrl',
                'settings_ddgApiKey',
                'settings_braveBaseUrl',
                'settings_braveApiKey',
                'settings_imageGenProvider',
                'settings_imageGenApiKey',
                'settings_imageGenBaseUrl',
                'settings_imageGenModel',
                'settings_imageGenSize',
            ]);

            const settings: any = {};
            values.forEach(([key, value]) => {
                if (value !== null) settings[key] = value;
            });

            // Single mode: Mixed (no longer stored)
            if (settings.settings_apiKey) setApiKey(settings.settings_apiKey);
            if (settings.settings_provider) setProvider(settings.settings_provider as LLMProviderId);
            if (settings.settings_model) setModel(settings.settings_model);
            if (settings.settings_baseUrl) setBaseUrl(settings.settings_baseUrl);

            // Load vision config
            if (settings.settings_useSeparateVision) {
                setUseSeparateVision(settings.settings_useSeparateVision === 'true');
            }
            if (settings.settings_visionProvider) setVisionProvider(settings.settings_visionProvider as LLMProviderId);
            if (settings.settings_visionModel) setVisionModel(settings.settings_visionModel);
            if (settings.settings_visionBaseUrl) setVisionBaseUrl(settings.settings_visionBaseUrl);
            if (settings.settings_visionApiKey) setVisionApiKey(settings.settings_visionApiKey);
            if (settings.settings_visionSourceMixed === 'local' || settings.settings_visionSourceMixed === 'api') {
                setVisionSourceMixed(settings.settings_visionSourceMixed);
            }
            if (!settings.settings_visionBaseUrl) {
                const inferredVisionBase = AI_PROVIDERS[settings.settings_visionProvider || visionProvider]?.baseUrl;
                if (inferredVisionBase) setVisionBaseUrl(inferredVisionBase);
            }

            // Load local model config
            if (settings.settings_localLlmModel) setLocalLlmModel(settings.settings_localLlmModel);
            if (settings.settings_localVisionModel) setLocalVisionModel(settings.settings_localVisionModel);
            // Migration: use old activeLlamaModel
            if (settings.settings_activeLlamaModel && !settings.settings_localLlmModel) {
                setLocalLlmModel(settings.settings_activeLlamaModel);
            }

            if (settings.settings_ttsProvider) setTtsProvider(settings.settings_ttsProvider as TTSProviderId);
            if (settings.settings_ttsVoice) setTtsVoice(settings.settings_ttsVoice);
            if (settings.settings_ttsApiKey) setTtsApiKey(settings.settings_ttsApiKey);
            if (settings.settings_ttsBaseUrl) setTtsBaseUrl(settings.settings_ttsBaseUrl);
            if (settings.settings_ttsModel) setTtsModel(settings.settings_ttsModel);
            if (settings.settings_systemPrompt) setSystemPrompt(settings.settings_systemPrompt);
            if (settings.settings_temperature) setTemperature(settings.settings_temperature);
            if (settings.settings_maxTokens) setMaxTokens(settings.settings_maxTokens);
            if (settings.settings_stream) setStreamEnabled(settings.settings_stream === 'true');
            if (settings.settings_userName) setUserName(settings.settings_userName);
            if (settings.settings_userPersona) setUserPersona(settings.settings_userPersona);
            if (settings.settings_sttProvider) setSttProvider(settings.settings_sttProvider as STTProvider);
            if (settings.settings_sttApiKey) setSttApiKey(settings.settings_sttApiKey);
            if (settings.settings_sttBaseUrl) setSttBaseUrl(settings.settings_sttBaseUrl);
            if (settings.settings_whisper_model) {
                const legacyMap: Record<string, string> = {
                    'tiny.en': 'whisper-tiny',
                    'tiny': 'whisper-tiny',
                    'base.en': 'whisper-base',
                    'base': 'whisper-base',
                };
                const normalized = legacyMap[settings.settings_whisper_model] || settings.settings_whisper_model;
                setActiveWhisperModel(normalized);
            }
            if (settings.settings_showReasoning) setShowReasoning(settings.settings_showReasoning === 'true');
            if (settings.settings_simulatedToolsEnabled !== undefined) setSimulatedToolsEnabled(settings.settings_simulatedToolsEnabled === 'true');
            if (settings.settings_streamingChunksEnabled !== undefined) setStreamingChunksEnabled(settings.settings_streamingChunksEnabled === 'true');
            if (settings.settings_useGpsForSearch !== undefined) setUseGpsForSearch(settings.settings_useGpsForSearch === 'true');
            if (settings.settings_searchProvider) setSearchProvider(settings.settings_searchProvider);
            if (settings.settings_searchBaseUrl) setSearchBaseUrl(settings.settings_searchBaseUrl);
            if (settings.settings_searchApiKey) setSearchApiKey(settings.settings_searchApiKey);
            if (settings.settings_ddgBaseUrl) setDdgBaseUrl(settings.settings_ddgBaseUrl);
            if (settings.settings_ddgApiKey) setDdgApiKey(settings.settings_ddgApiKey);
            if (settings.settings_braveBaseUrl) setBraveBaseUrl(settings.settings_braveBaseUrl);
            if (settings.settings_braveApiKey) setBraveApiKey(settings.settings_braveApiKey);
            if (settings.settings_imageGenProvider) setImageGenProvider(settings.settings_imageGenProvider);
            if (settings.settings_imageGenApiKey) setImageGenApiKey(settings.settings_imageGenApiKey);
            if (settings.settings_imageGenBaseUrl) setImageGenBaseUrl(settings.settings_imageGenBaseUrl);
            if (settings.settings_imageGenModel) setImageGenModel(settings.settings_imageGenModel);
            if (settings.settings_imageGenSize) setImageGenSize(settings.settings_imageGenSize);
            // Initialize LLMService with loaded config
            await LLMService.initialize();

            const cfg = LLMService.getConfig() as any;
            await checkModelStatuses();
        } catch (error) {
            console.error('Failed to load settings', error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkModelStatuses = async () => {
        try {
            if (LOCAL_INFERENCE_ENABLED.STT) {
                const whisperFiles = WhisperSTT?.getDownloadedModels
                    ? await WhisperSTT.getDownloadedModels()
                    : await loadWhisperDownloadsFallback();
                setDownloadedWhisperModels(whisperFiles);
            }

            if (LOCAL_INFERENCE_ENABLED.LLM && getDownloadedLlamaModels) {
                const llamaModels = await getDownloadedLlamaModels();
                setDownloadedLlamaModels(llamaModels);
            }

            if (LOCAL_INFERENCE_ENABLED.LLM && getGlobalActiveLlama) {
                const activeLlama = await getGlobalActiveLlama();
                if (activeLlama && !localLlmModel) {
                    setLocalLlmModel(activeLlama.id);
                }
            }

            setLoadedLocalModelId(LLMService.getLoadedLocalModelId());
        } catch (e) {
            console.warn("Error checking model statuses", e);
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    const toggleSectionWithRefresh = async (section: string) => {
        const willExpand = !expandedSections.includes(section);
        toggleSection(section);
        if (!willExpand) return;
        if (section === 'ai_provider' && (mode === 'local' || (mode === 'mixed' && provider === 'llama_rn'))) {
            await checkModelStatuses();
        }
        if (section === 'stt' && sttProvider === 'whisper_local') {
            if (LOCAL_INFERENCE_ENABLED.STT) {
                const list = WhisperSTT?.getDownloadedModels
                    ? await WhisperSTT.getDownloadedModels()
                    : await loadWhisperDownloadsFallback();
                setDownloadedWhisperModels(list);
            }
        }
        if (section === 'tts') {
            return;
        }
    };

    const handleProviderChange = (newProvider: LLMProviderId) => {
        setProvider(newProvider);
        const preset = AI_PROVIDERS[newProvider];
        if (preset) {
            setBaseUrl(preset.baseUrl);
            setModel(preset.defaultModel);
        }
        setApiModels([]);
        if (newProvider !== 'llama_rn') {
            // Don't clear activeLlamaModel from storage, just switch provider
        }
    };

    const handleImageGenProviderChange = (nextProvider: 'openai' | 'openrouter' | 'custom') => {
        setImageGenProvider(nextProvider);
        const preset = IMAGE_GEN_PROVIDERS[nextProvider];
        if (preset && nextProvider !== 'custom') {
            setImageGenBaseUrl(preset.baseUrl);
            setImageGenModel(preset.defaultModel);
        }
    };

    const isOllamaOrLocal = () => {
        const base = (baseUrl || '').trim();
        return /localhost:11434|127\.0\.0\.1:11434/i.test(base) || provider === 'local';
    };

    const getModelsUrl = () => {
        const base = (baseUrl || '').trim().replace(/\/$/, '');
        if (!base) return '';
        if (isOllamaOrLocal()) {
            const origin = base.replace(/\/v1\/?$/, '');
            return `${origin}/api/tags`;
        }
        return base.endsWith('/models') ? base : `${base}/models`;
    };

    const getTestHeaders = (): Record<string, string> => {
        if (isOllamaOrLocal()) return { 'Content-Type': 'application/json' };
        const key = apiKey.trim();
        if (!key) return {};
        return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    };

    const testConnection = async () => {
        const url = getModelsUrl();
        if (!url) {
            setStatusModal({ visible: true, type: 'error', title: 'Missing URL', message: 'Enter a Base URL first.' });
            return;
        }
        if (!isOllamaOrLocal() && !apiKey.trim()) {
            setStatusModal({ visible: true, type: 'error', title: 'Missing API Key', message: 'Enter an API key to test.' });
            return;
        }
        setConnectionTesting(true);
        try {
            const r = await fetch(url, { method: 'GET', headers: getTestHeaders() });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(`${r.status} ${text.slice(0, 120)}`);
            }
            setStatusModal({
                visible: true,
                type: 'success',
                title: 'Connection OK',
                message: 'Successfully connected to the API.',
            });
        } catch (e: any) {
            setStatusModal({
                visible: true,
                type: 'error',
                title: 'Connection failed',
                message: e?.message || 'Network request failed',
            });
        } finally {
            setConnectionTesting(false);
        }
    };

    const parseModelsResponse = (json: any): string[] => {
        if (Array.isArray(json.data)) {
            return json.data.map((m: any) => (typeof m === 'string' ? m : (m.id || m.model || ''))).filter(Boolean);
        }
        if (Array.isArray(json.models)) {
            return json.models.map((m: any) => (typeof m === 'string' ? m : (m.name || m.id || m.model || ''))).filter(Boolean);
        }
        if (Array.isArray(json)) {
            return json.map((m: any) => (typeof m === 'string' ? m : (m.id || m.model || m.name || ''))).filter(Boolean);
        }
        return [];
    };

    const loadModelsFromApi = async () => {
        const url = getModelsUrl();
        if (!url) {
            setStatusModal({ visible: true, type: 'error', title: 'Missing URL', message: 'Enter a Base URL first.' });
            return;
        }
        if (!isOllamaOrLocal() && !apiKey.trim()) {
            setStatusModal({ visible: true, type: 'error', title: 'Missing API Key', message: 'Enter an API key to load models.' });
            return;
        }
        setApiModelsLoading(true);
        setApiModels([]);
        try {
            const r = await fetch(url, { method: 'GET', headers: getTestHeaders() });
            if (!r.ok) {
                const text = await r.text();
                throw new Error(`${r.status} ${text.slice(0, 120)}`);
            }
            const json = await r.json();
            const list = parseModelsResponse(json);
            setApiModels(list);
            if (list.length === 0) {
                setStatusModal({ visible: true, type: 'info', title: 'No models', message: 'No models returned from the API.' });
            }
        } catch (e: any) {
            setStatusModal({
                visible: true,
                type: 'error',
                title: 'Load failed',
                message: e?.message || 'Failed to load models',
            });
            setApiModels([]);
        } finally {
            setApiModelsLoading(false);
        }
    };

    const handleActivateLocalModel = async (modelId: string, type: 'llm' | 'vision' = 'llm') => {
        if (!LOCAL_INFERENCE_ENABLED.LLM) {
            setStatusModal({ visible: true, type: 'info', title: 'Unavailable', message: 'Local LLM models are disabled' });
            return;
        }
        try {
            if (type === 'llm') {
                if (!setGlobalActiveLlama) {
                    setStatusModal({ visible: true, type: 'error', title: 'Unavailable', message: 'Local LLM bridge not loaded' });
                    return;
                }
                await setGlobalActiveLlama(modelId);
                setLocalLlmModel(modelId);
                // Also switch provider to llama_rn when activating a local LLM model
                setProvider('llama_rn');
            } else {
                setLocalVisionModel(modelId);
            }

            await checkModelStatuses();
            setStatusModal({
                visible: true,
                type: 'success',
                title: 'Model Activated',
                message: type === 'llm'
                    ? 'Local LLM model is now active. AI Provider switched to Local GGUF.'
                    : 'Local Vision model is now active.'
            });
        } catch (e) {
            setStatusModal({
                visible: true,
                type: 'error',
                title: 'Activation Failed',
                message: 'Failed to activate the model.'
            });
        }
    };

    const handleSTTProviderChange = async (newProvider: STTProvider) => {
        // Persist STT provider change immediately
        const switched = await STTService.switchProvider(newProvider);
        if (!switched) {
            setStatusModal({
                visible: true,
                type: 'info',
                title: 'STT provider unavailable',
                message: newProvider === 'whisper_local'
                    ? 'Whisper Local requires at least one downloaded model.'
                    : 'Could not switch STT provider.',
            });
            return;
        }
        setSttProvider(newProvider);
        if (newProvider === 'whisper_local') {
            if (LOCAL_INFERENCE_ENABLED.STT) {
                const whisperFiles = WhisperSTT?.getDownloadedModels
                    ? await WhisperSTT.getDownloadedModels()
                    : await loadWhisperDownloadsFallback();
                setDownloadedWhisperModels(whisperFiles);
            }
        }
    };

    const saveSettings = async () => {
        try {
            await AsyncStorage.multiSet([
                ['settings_apiKey', apiKey],
                ['settings_provider', provider],
                ['settings_model', model],
                ['settings_baseUrl', baseUrl],
                ['settings_useSeparateVision', String(useSeparateVision)],
                ['settings_visionProvider', visionProvider],
                ['settings_visionModel', visionModel],
                ['settings_visionBaseUrl', visionBaseUrl],
                ['settings_visionApiKey', visionApiKey],
                ['settings_visionSourceMixed', visionSourceMixed],
                ['settings_localLlmModel', localLlmModel || ''],
                ['settings_localVisionModel', localVisionModel || ''],
                ['settings_activeVisionModel', localVisionModel || ''],
                ['settings_ttsProvider', ttsProvider],
                ['settings_ttsVoice', ttsVoice],
                ['settings_ttsApiKey', ttsApiKey],
                ['settings_ttsBaseUrl', ttsBaseUrl],
                ['settings_ttsModel', ttsModel],
                ['settings_systemPrompt', systemPrompt],
                ['settings_temperature', temperature],
                ['settings_maxTokens', maxTokens],
                ['settings_stream', String(streamEnabled)],
                ['settings_userName', userName],
                ['settings_userPersona', userPersona],
                ['settings_sttProvider', sttProvider],
                ['settings_sttApiKey', sttApiKey],
                ['settings_sttBaseUrl', sttBaseUrl],
                ['settings_whisper_model', activeWhisperModel],
                ['settings_activeLlamaModel', localLlmModel || ''],
                ['settings_showReasoning', String(showReasoning)],
                ['settings_simulatedToolsEnabled', String(simulatedToolsEnabled)],
                ['settings_streamingChunksEnabled', String(streamingChunksEnabled)],
                ['settings_useGpsForSearch', String(useGpsForSearch)],
                ['settings_searchProvider', searchProvider],
                ['settings_searchBaseUrl', searchBaseUrl],
                ['settings_searchApiKey', searchApiKey],
                ['settings_ddgBaseUrl', ddgBaseUrl],
                ['settings_ddgApiKey', ddgApiKey],
                ['settings_braveBaseUrl', braveBaseUrl],
                ['settings_braveApiKey', braveApiKey],
                ['settings_imageGenProvider', imageGenProvider],
                ['settings_imageGenApiKey', imageGenApiKey],
                ['settings_imageGenBaseUrl', imageGenBaseUrl],
                ['settings_imageGenModel', imageGenModel],
                ['settings_imageGenSize', imageGenSize],
            ]);

            // Update STT Service config - ALWAYS INDEPENDENT
            if (sttProvider === 'api') {
                STTService.setConfig({
                    provider: 'api',
                    apiKey: sttApiKey,
                    baseUrl: sttBaseUrl,
                });
            } else if (sttProvider === 'whisper_local') {
                STTService.setConfig({
                    provider: 'whisper_local',
                    model: activeWhisperModel,
                });
            } else {
                STTService.setConfig({ provider: sttProvider });
            }

            // Update TTS Service config
            TTSService.setConfig({
                provider: ttsProvider,
                voiceId: ttsVoice || 'default',
                apiKey: ttsProvider === 'custom' ? (ttsApiKey || apiKey) : undefined,
                baseUrl: ttsProvider === 'custom' ? ttsBaseUrl : undefined,
                model: ttsProvider === 'custom' ? ttsModel : undefined,
            });

            // Update LLM Service Config with new mode and vision settings
            const visionUseLocal = useSeparateVision && (mode === 'local' || (mode === 'mixed' && visionSourceMixed === 'local'));
            const useLocalLlm = mode === 'local' || (mode === 'mixed' && provider === 'llama_rn');
            const useLocalVision = useSeparateVision && (mode === 'local' || (mode === 'mixed' && visionSourceMixed === 'local'));
            LLMService.setConfig({
                mode,
                provider,
                baseUrl,
                model,
                temperature: parseFloat(temperature),
                maxTokens: parseInt(maxTokens),
                systemPrompt,
                stream: streamEnabled,
                visionConfig: {
                    enabled: true,
                    useSeparate: useSeparateVision,
                    provider: useSeparateVision ? (visionUseLocal ? 'llama_rn' : visionProvider) : provider,
                    model: useSeparateVision ? (visionUseLocal ? (localVisionModel || '') : visionModel) : model,
                    baseUrl: useSeparateVision ? visionBaseUrl : '',
                    apiKey: useSeparateVision ? visionApiKey : '',
                },
                localConfig: (useLocalLlm || useLocalVision) ? {
                    llmModelId: useLocalLlm ? (localLlmModel ?? null) : null,
                    visionModelId: useLocalVision ? (localVisionModel ?? null) : null,
                } : undefined,
                // OpenRouter reasoning tokens: exclude when user hides reasoning, else request medium effort
                reasoning: {
                    exclude: !showReasoning,
                    ...(showReasoning ? { effort: 'medium' as const } : {}),
                },
                simulatedToolsEnabled,
            });

            SettingsBus.emit({
                provider,
                model,
                baseUrl,
                apiKey,
                userName,
                userPersona,
                showReasoning,
                streamingChunksEnabled,
                simulatedToolsEnabled,
            });

            setStatusModal({ visible: true, type: 'success', title: 'Saved', message: 'Settings saved successfully' });
        } catch (error) {
            setStatusModal({ visible: true, type: 'error', title: 'Error', message: 'Failed to save settings' });
        }
    };

    const handleDownloadModel = async (type: 'whisper' | 'llama', modelId: string) => {
        if (downloadProgress[modelId] !== undefined) return;
        setDownloadProgress(prev => ({ ...prev, [modelId]: 0 }));
        try {
            let success = false;
            if (type === 'llama') {
                if (!LOCAL_INFERENCE_ENABLED.LLM || !downloadLlamaModel) {
                    setStatusModal({ visible: true, type: 'info', title: 'Unavailable', message: 'Local LLM models are disabled' });
                    return;
                }
                const allModels = [...EFFICIENT_TEXT_PRESETS, ...VISUAL_MODELS, ...AUDIO_MODELS];
                const modelInfo = allModels.find(m => m.id === modelId);
                if (modelInfo) {
                    const { promise, cancel } = downloadLlamaModel(modelInfo, (p: number) => {
                        setDownloadProgress(prev => ({ ...prev, [modelId]: p }));
                    });
                    downloadCancelRef.current[modelId] = cancel;
                    try {
                        await promise;
                        success = true;
                    } finally {
                        delete downloadCancelRef.current[modelId];
                    }
                }
            } else {
                if (!LOCAL_INFERENCE_ENABLED.STT || !WhisperSTT) {
                    setStatusModal({ visible: true, type: 'info', title: 'Unavailable', message: 'Whisper module is not available in this build' });
                    return;
                }
                const { promise, cancel } = WhisperSTT.downloadModel(modelId, (p: number) => {
                    setDownloadProgress(prev => ({ ...prev, [modelId]: p }));
                });
                downloadCancelRef.current[modelId] = cancel;
                try {
                    success = await promise;
                } finally {
                    delete downloadCancelRef.current[modelId];
                }
            }
            if (success) {
                if (type === 'whisper') {
                    setDownloadedWhisperModels(prev => prev.includes(modelId) ? prev : [...prev, modelId]);
                } else {
                    setDownloadedLlamaModels(prev => prev.some(m => m.id === modelId) ? prev : [...prev, { id: modelId }]);
                }
                await checkModelStatuses();
            }
        } catch (e: any) {
            if (e === LLAMA_CANCELLED || e?.message === 'Download cancelled') return;
            setStatusModal({ visible: true, type: 'error', title: 'Error', message: 'Download failed' });
        } finally {
            setDownloadProgress(prev => { const n = { ...prev }; delete n[modelId]; return n; });
        }
    };

    const handleDeleteModel = async (type: 'whisper' | 'llama', modelId: string) => {
        Alert.alert('Delete Model', 'Remove this model?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        if (type === 'llama') {
                            if (!LOCAL_INFERENCE_ENABLED.LLM || !deleteLlamaModel) return;
                            await deleteLlamaModel(modelId);
                            // If we deleted the active LLM model, clear it
                            if (localLlmModel === modelId) {
                                setLocalLlmModel(null);
                                // Also clear from global
                                if (setGlobalActiveLlama) setGlobalActiveLlama('');
                            }
                            // If we deleted the active vision model, clear it
                            if (localVisionModel === modelId) {
                                setLocalVisionModel(null);
                            }
                        }
                        else {
                            if (!LOCAL_INFERENCE_ENABLED.STT || !WhisperSTT) return;
                            await WhisperSTT.deleteModel(modelId);
                        }

                        await checkModelStatuses();
                    } catch (e) {
                        setStatusModal({ visible: true, type: 'error', title: 'Error', message: 'Delete failed' });
                    }
                }
            }
        ]);
    };

    const handleLoadLocalModel = async (modelId: string) => {
        try {
            setLocalModelLoading(modelId);
            const ok = await LLMService.loadLocalModel(modelId);
            if (!ok) {
                setStatusModal({ visible: true, type: 'error', title: 'Load failed', message: 'Could not load the model into memory.' });
                return;
            }
            setLoadedLocalModelId(modelId);
            setStatusModal({ visible: true, type: 'success', title: 'Model loaded', message: 'Model is loaded into memory.' });
        } catch (e) {
            setStatusModal({ visible: true, type: 'error', title: 'Load failed', message: 'Could not load the model into memory.' });
        } finally {
            setLocalModelLoading(null);
        }
    };

    const handleUnloadLocalModel = async () => {
        try {
            setLocalModelLoading(loadedLocalModelId || 'unload');
            await LLMService.unloadLocalModel();
            setLoadedLocalModelId(null);
            setStatusModal({ visible: true, type: 'success', title: 'Model unloaded', message: 'Model released from memory.' });
        } catch (e) {
            setStatusModal({ visible: true, type: 'error', title: 'Unload failed', message: 'Could not unload the model.' });
        } finally {
            setLocalModelLoading(null);
        }
    };


    const handleLoadCustomModel = async () => {
        if (!LOCAL_INFERENCE_ENABLED.LLM || !loadLlamaModelFromFile) {
            setStatusModal({ visible: true, type: 'info', title: 'Unavailable', message: 'Local LLM models are disabled' });
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (!result.canceled && result.assets[0]) {
                await loadLlamaModelFromFile(result.assets[0].uri, result.assets[0].name);
                await checkModelStatuses();
                setStatusModal({
                    visible: true,
                    type: 'success',
                    title: 'Model Loaded',
                    message: 'Custom model loaded successfully. It has been activated.'
                });
            }
        } catch (e) {
            setStatusModal({
                visible: true,
                type: 'error',
                title: 'Error',
                message: 'Failed to load model file'
            });
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={theme.colors.primary} />
            </SafeAreaView>
        );
    }

    const activeModelName = localLlmModel
        ? downloadedLlamaModels.find(m => m.id === localLlmModel)?.name
        : null;

    const darkThemes = ['monoDark', 'forest', 'sunset'];
    const lightThemes = ['clean', 'monoLight'];
    const isDark = darkThemes.includes(themeName);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 12 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Feather name="arrow-left" size={22} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Settings</Text>
                <Pressable onPress={saveSettings} style={[styles.headerBtn, styles.saveBtn, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <Feather name="check" size={20} color={theme.colors.primary} />
                </Pressable>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 12}
            >
                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >

                    {/* 1. AI Provider Section - Shows based on mode */}
                    <CollapsibleSection
                        title={hasLocalInference() ? (mode === 'mixed' ? 'LLM (choose API or Local)' : mode === 'api' ? 'LLM Configuration' : 'Local Models') : 'LLM Configuration'}
                        icon="cpu"
                        isExpanded={expandedSections.includes('ai_provider')}
                        onToggle={() => toggleSectionWithRefresh('ai_provider')}
                        badge={hasLocalInference() && (mode === 'api' || mode === 'mixed') ? AI_PROVIDERS[provider]?.name : (!hasLocalInference() ? 'Cloud API' : (localLlmModel || 'No model'))}
                        description={hasLocalInference() ? (mode === 'mixed' ? 'Choose API or local LLM independently' : mode === 'api' ? 'Configure cloud AI provider' : 'Manage downloaded local models') : 'Configure your cloud AI provider for text generation'}
                    >
                        {/* Provider Selector - Always show when local inference is disabled or in API/mixed mode */}
                        {(!hasLocalInference() || mode === 'api' || mode === 'mixed') && (
                            <>
                                <ChipSelector
                                    options={Object.entries(AI_PROVIDERS)
                                        .filter(([k]) => hasLocalInference() ? (mode === 'mixed' || k !== 'llama_rn') : k !== 'llama_rn' && k !== 'local')
                                        .map(([k, v]) => ({ key: k, label: v.name }))}
                                    selected={provider}
                                    onSelect={(k: LLMProviderId) => handleProviderChange(k)}
                                />
                                {provider !== 'llama_rn' ? (
                                    <>
                                        <View style={styles.spacer} />
                                        <CompactInput label="Base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="https://..." />
                                        <CompactInput label="API Key" value={apiKey} onChangeText={setApiKey} placeholder="sk-..." secure />
                                        <CompactInput label="Model" value={model} onChangeText={setModel} placeholder="gpt-4" />

                                        {/* Test connection & Load models */}
                                        <View style={styles.apiActionsRow}>
                                            <Pressable
                                                style={[styles.apiActionBtn, { borderColor: theme.colors.border }]}
                                                onPress={testConnection}
                                                disabled={connectionTesting}
                                            >
                                                {connectionTesting ? (
                                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                                ) : (
                                                    <Feather name="wifi" size={16} color={theme.colors.textSecondary} />
                                                )}
                                                <Text style={[styles.apiActionBtnText, { color: theme.colors.textSecondary }]}>
                                                    {connectionTesting ? 'Testing…' : 'Test connection'}
                                                </Text>
                                            </Pressable>
                                            <Pressable
                                                style={[styles.apiActionBtn, { borderColor: theme.colors.border }]}
                                                onPress={loadModelsFromApi}
                                                disabled={apiModelsLoading}
                                            >
                                                {apiModelsLoading ? (
                                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                                ) : (
                                                    <Feather name="list" size={16} color={theme.colors.textSecondary} />
                                                )}
                                                <Text style={[styles.apiActionBtnText, { color: theme.colors.textSecondary }]}>
                                                    {apiModelsLoading ? 'Loading…' : 'Load models'}
                                                </Text>
                                            </Pressable>
                                        </View>

                                        {/* Model list from API */}
                                        {apiModels.length > 0 && (
                                            <View style={[styles.apiModelsSection, { borderColor: theme.colors.border }]}>
                                                <Text style={[styles.apiModelsLabel, { color: theme.colors.textSecondary }]}>
                                                    Select a model
                                                </Text>
                                                <ScrollView style={styles.apiModelsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                                    {apiModels.map((id) => (
                                                        <Pressable
                                                            key={id}
                                                            style={[
                                                                styles.apiModelItem,
                                                                { borderColor: theme.colors.border, backgroundColor: model === id ? theme.colors.surfaceHighlight : 'transparent' }
                                                            ]}
                                                            onPress={() => setModel(id)}
                                                        >
                                                            <Feather
                                                                name={model === id ? 'check-circle' : 'circle'}
                                                                size={18}
                                                                color={model === id ? theme.colors.primary : theme.colors.textTertiary}
                                                            />
                                                            <Text style={[styles.apiModelId, { color: theme.colors.text }]} numberOfLines={1}>
                                                                {id}
                                                            </Text>
                                                        </Pressable>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <View style={styles.spacer} />
                                        <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15' }]}>
                                            <Feather name="info" size={18} color={theme.colors.info} />
                                            <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                                Local GGUF uses downloaded on-device models. Base URL, API key, and model list are not used.
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </>
                        )}

                        {/* Local Mode or Mixed with Local LLM: Model Management - Only show when local inference is enabled */}
                        {hasLocalInference() && (mode === 'local' || (mode === 'mixed' && provider === 'llama_rn')) && (
                            <View style={[styles.localModelContainer, { backgroundColor: theme.colors.surfaceHighlight }]}>
                                {/* Show Text Models for LLM */}
                                <Text style={[styles.categoryLabel, { color: theme.colors.textSecondary }]}>
                                    Text Generation (LLM)
                                </Text>
                                {downloadedLlamaModels.length > 0 ? (
                                    downloadedLlamaModels.map((m: any) => (
                                        <ModelItem
                                            key={m.id}
                                            model={m}
                                            isDownloaded={true}
                                            isActive={localLlmModel === m.id}
                                            isLoaded={loadedLocalModelId === m.id}
                                            isLoading={localModelLoading === m.id}
                                            onDelete={() => handleDeleteModel('llama', m.id)}
                                            onActivate={() => handleActivateLocalModel(m.id, 'llm')}
                                            onLoad={() => handleLoadLocalModel(m.id)}
                                            onUnload={handleUnloadLocalModel}
                                            theme={theme}
                                        />
                                    ))
                                ) : (
                                    <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15' }]}>
                                        <Feather name="info" size={18} color={theme.colors.info} />
                                        <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                            No local models found. Load a GGUF file below to add one.
                                        </Text>
                                    </View>
                                )}

                                {/* Load Custom Model */}
                                <Pressable
                                    style={[styles.loadCustomBtn, { borderColor: theme.colors.border, marginTop: 16 }]}
                                    onPress={handleLoadCustomModel}
                                >
                                    <Feather name="plus-circle" size={18} color={theme.colors.text} />
                                    <Text style={[styles.loadCustomText, { color: theme.colors.text, marginLeft: 8 }]}>
                                        Load Custom GGUF File
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {/* Show coming soon message when local inference is disabled */}
                        {!hasLocalInference() && (
                            <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15', marginTop: 12 }]}>
                                <Feather name="info" size={18} color={theme.colors.info} />
                                <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                    Local LLM models (GGUF) are coming soon. Currently using cloud API providers.
                                </Text>
                            </View>
                        )}
                    </CollapsibleSection>

                    {/* 2. VISION CONFIGURATION (NEW) */}
                    <CollapsibleSection
                        title="Vision Configuration"
                        icon="eye"
                        isExpanded={expandedSections.includes('vision_config')}
                        onToggle={() => toggleSection('vision_config')}
                        badge={useSeparateVision ? 'Separate Model' : 'Same as LLM'}
                        description="Describe images and extract text from photos"
                    >
                        {/* Use Separate Vision Toggle - Only show when local inference is enabled or allow API-only separate vision */}
                        {hasLocalInference() ? (
                            <>
                                <View style={styles.switchRow}>
                                    <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                                        Use separate vision model
                                    </Text>
                                    <Switch
                                        value={useSeparateVision}
                                        onValueChange={setUseSeparateVision}
                                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                        thumbColor={useSeparateVision ? theme.colors.primary : theme.colors.textSecondary}
                                    />
                                </View>

                                <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                                    {useSeparateVision
                                        ? "Use a separate model for describing images and reading text from photos"
                                        : "Same model used for text and for images (describe / read text from photos)"}
                                </Text>
                            </>
                        ) : (
                            <>
                                <View style={styles.switchRow}>
                                    <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                                        Use separate vision model
                                    </Text>
                                    <Switch
                                        value={useSeparateVision}
                                        onValueChange={setUseSeparateVision}
                                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                        thumbColor={useSeparateVision ? theme.colors.primary : theme.colors.textSecondary}
                                    />
                                </View>

                                <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                                    {useSeparateVision
                                        ? "Use a separate model for describing images and reading text from photos"
                                        : "Same model used for text and for images (describe / read text from photos)"}
                                </Text>

                                <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15', marginTop: 12 }]}>
                                    <Feather name="info" size={18} color={theme.colors.info} />
                                    <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                        Local vision models are coming soon. Use API providers for now.
                                    </Text>
                                </View>
                            </>
                        )}

                        {/* Separate Vision Settings - Only shown when enabled */}
                        {useSeparateVision && mode === 'mixed' && hasLocalInference() && (
                            <View style={styles.subsection}>
                                <View style={styles.spacer} />
                                <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                    Vision source
                                </Text>
                                <ChipSelector
                                    options={[
                                        { key: 'api', label: 'API' },
                                        ...(LOCAL_INFERENCE_ENABLED.VISION ? [{ key: 'local', label: 'Local model' }] : []),
                                    ]}
                                    selected={visionSourceMixed}
                                    onSelect={(k: 'api' | 'local') => setVisionSourceMixed(k)}
                                />
                                <View style={styles.spacer} />
                            </View>
                        )}
                        {useSeparateVision && (mode === 'api' || (mode === 'mixed' && visionSourceMixed === 'api')) && (
                            <View style={styles.subsection}>
                                <View style={styles.spacer} />
                                <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                    Vision Provider
                                </Text>
                                <ChipSelector
                                    options={Object.entries(AI_PROVIDERS)
                                        .filter(([k]) => k !== 'llama_rn' && k !== 'local')
                                        .map(([k, v]) => ({ key: k, label: v.name }))}
                                    selected={visionProvider}
                                    onSelect={(k: LLMProviderId) => {
                                        setVisionProvider(k);
                                        setVisionModel(AI_PROVIDERS[k]?.defaultModel || '');
                                        if (AI_PROVIDERS[k]?.baseUrl) setVisionBaseUrl(AI_PROVIDERS[k].baseUrl);
                                    }}
                                />
                                <View style={styles.spacer} />
                                <CompactInput
                                    label="Vision Model"
                                    value={visionModel}
                                    onChangeText={setVisionModel}
                                    placeholder="gpt-4o"
                                />
                                <CompactInput
                                    label="Base URL"
                                    value={visionBaseUrl}
                                    onChangeText={setVisionBaseUrl}
                                    placeholder="https://api.openai.com/v1"
                                />
                                <CompactInput
                                    label="API Key (optional)"
                                    value={visionApiKey}
                                    onChangeText={setVisionApiKey}
                                    placeholder="Uses LLM API key when empty"
                                    secure
                                />
                            </View>
                        )}
                        {useSeparateVision && hasLocalInference() && (mode === 'local' || (mode === 'mixed' && visionSourceMixed === 'local')) && (
                            <View style={styles.subsection}>
                                <View style={styles.spacer} />
                                <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                    Select Vision Model
                                </Text>
                                {downloadedLlamaModels.length > 0 ? (
                                    downloadedLlamaModels.map((m: any) => (
                                        <ModelItem
                                            key={m.id}
                                            model={m}
                                            isDownloaded={true}
                                            isActive={localVisionModel === m.id}
                                            onDelete={() => handleDeleteModel('llama', m.id)}
                                            onActivate={() => handleActivateLocalModel(m.id, 'vision')}
                                            theme={theme}
                                        />
                                    ))
                                ) : (
                                    <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15' }]}>
                                        <Feather name="info" size={18} color={theme.colors.info} />
                                        <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                            No local models found. Load a GGUF file in the LLM section first.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </CollapsibleSection>

                    {/* Image Generation Tool settings */}
                    <CollapsibleSection
                        title="Image Generation"
                        icon="image"
                        isExpanded={expandedSections.includes('image_gen_tool')}
                        onToggle={() => toggleSection('image_gen_tool')}
                        badge={IMAGE_GEN_PROVIDERS[imageGenProvider]?.name || 'OpenAI'}
                        description="Provider and API settings used by the generate_image tool"
                    >
                        <ChipSelector
                            options={Object.entries(IMAGE_GEN_PROVIDERS).map(([k, v]) => ({ key: k, label: v.name }))}
                            selected={imageGenProvider}
                            onSelect={(k: 'openai' | 'openrouter' | 'custom') => handleImageGenProviderChange(k)}
                        />
                        <View style={styles.spacer} />
                        <CompactInput
                            label="Base URL"
                            value={imageGenBaseUrl}
                            onChangeText={setImageGenBaseUrl}
                            placeholder="https://api.openai.com/v1"
                        />
                        <CompactInput
                            label="API Key (optional)"
                            value={imageGenApiKey}
                            onChangeText={setImageGenApiKey}
                            placeholder="Uses LLM API key when empty"
                            secure
                        />
                        <CompactInput
                            label="Image Model"
                            value={imageGenModel}
                            onChangeText={setImageGenModel}
                            placeholder="gpt-image-1"
                        />
                        <Text style={[styles.subLabel, { color: theme.colors.textSecondary, marginTop: 8 }]}>Default size</Text>
                        <ChipSelector
                            options={[
                                { key: '1024x1024', label: '1024x1024' },
                                { key: '1024x1792', label: '1024x1792' },
                                { key: '1792x1024', label: '1792x1024' },
                            ]}
                            selected={imageGenSize}
                            onSelect={(k: '1024x1024' | '1024x1792' | '1792x1024') => setImageGenSize(k)}
                        />
                        <Text style={[styles.ragHint, { color: theme.colors.textTertiary, marginTop: 8 }]}>These settings are used by chat menu Image Gen and the `generate_image` tool.</Text>
                    </CollapsibleSection>

                    {/* 3. SPEECH TO TEXT - Always visible, INDEPENDENT of LLM mode */}
                    <CollapsibleSection
                        title="Speech to Text"
                        icon="mic"
                        isExpanded={expandedSections.includes('stt')}
                        onToggle={() => toggleSectionWithRefresh('stt')}
                        badge={hasLocalInference() && sttProvider === 'whisper_local' ? 'Local' : sttProvider === 'api' ? 'API' : 'Local'}
                        description={`Independent of operation mode. Current: ${STT_PROVIDERS.find(p => p.id === sttProvider)?.name || 'System'}`}
                    >
                        <ChipSelector
                            options={STT_PROVIDERS.map(p => ({
                                key: p.id,
                                label: p.name,
                                description: p.description
                            }))}
                            selected={sttProvider}
                            onSelect={(k: STTProvider) => handleSTTProviderChange(k)}
                        />

                        {/* API Configuration - Only shown when API provider selected */}
                        {sttProvider === 'api' && (
                            <View style={styles.subsection}>
                                <View style={styles.spacer} />
                                <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                    API Configuration
                                </Text>
                                <CompactInput
                                    label="Base URL"
                                    value={sttBaseUrl}
                                    onChangeText={setSttBaseUrl}
                                    placeholder="https://api.openai.com/v1"
                                />
                                <CompactInput
                                    label="API Key"
                                    value={sttApiKey}
                                    onChangeText={setSttApiKey}
                                    placeholder="sk-..."
                                    secure
                                />
                            </View>
                        )}

                        {/* Whisper Models - available whenever local STT is enabled */}
                        {LOCAL_INFERENCE_ENABLED.STT && (
                            <View style={styles.subsection}>
                                <View style={styles.spacer} />
                                <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                                    Local Whisper Models
                                </Text>
                                {sttProvider !== 'whisper_local' && (
                                    <Text style={[styles.ragHint, { color: theme.colors.textTertiary, marginBottom: 8 }]}>
                                        Select "Whisper Local" above to use these models for speech recognition.
                                    </Text>
                                )}
                                {!WhisperSTT && (
                                    <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15', marginTop: 8 }]}>
                                        <Feather name="info" size={18} color={theme.colors.info} />
                                        <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                            Whisper module is not available in this build. Reinstall the app build to enable local models.
                                        </Text>
                                    </View>
                                )}

                                {downloadedWhisperModels.length === 0 && (
                                    <View style={[styles.warningBanner, { backgroundColor: theme.colors.warning + '15' }]}>
                                        <Feather name="alert-triangle" size={18} color={theme.colors.warning} />
                                        <Text style={[styles.warningText, { color: theme.colors.warning }]}>
                                            No models downloaded. Download one below to use local speech recognition.
                                        </Text>
                                    </View>
                                )}

                                {Object.entries(WHISPER_MODELS).map(([id, info]: [string, any]) => {
                                    const isDownloaded = downloadedWhisperModels.includes(id);
                                    const progress = downloadProgress[id];
                                    const isDownloading = progress !== undefined;
                                    const isActive = activeWhisperModel === id;

                                    return (
                                        <View key={id} style={[styles.whisperCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceHighlight }]}>
                                            <View style={styles.whisperHeader}>
                                                <View style={styles.whisperTitleRow}>
                                                    <Text style={[styles.whisperTitle, { color: theme.colors.text }]}>{info.name}</Text>
                                                    {isActive && isDownloaded && (
                                                        <View style={[styles.activeIndicator, { backgroundColor: theme.colors.success + '20' }]}>
                                                            <Text style={[styles.activeIndicatorText, { color: theme.colors.success }]}>Active</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.whisperMeta, { color: theme.colors.textTertiary }]}>
                                                    {info.size} • {info.description}
                                                </Text>
                                            </View>

                                            {isDownloading && (
                                                <View style={styles.progressBarContainer}>
                                                    <View style={[styles.progressBar, { width: `${Math.round((progress || 0) * 100)}%`, backgroundColor: theme.colors.primary }]} />
                                                </View>
                                            )}

                                            <View style={styles.whisperActions}>
                                                {isDownloaded ? (
                                                    <>
                                                        <Pressable
                                                            onPress={() => setActiveWhisperModel(id)}
                                                            style={[
                                                                styles.whisperBtn,
                                                                { backgroundColor: isActive ? theme.colors.success + '20' : theme.colors.primary + '15' }
                                                            ]}
                                                        >
                                                            <Text style={[styles.whisperBtnText, { color: isActive ? theme.colors.success : theme.colors.primary }]}>
                                                                {isActive ? 'Active' : 'Set Active'}
                                                            </Text>
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => handleDeleteModel('whisper', id)}
                                                            style={[styles.whisperBtn, { backgroundColor: theme.colors.error + '15' }]}
                                                        >
                                                            <Text style={[styles.whisperBtnText, { color: theme.colors.error }]}>Delete</Text>
                                                        </Pressable>
                                                    </>
                                                ) : (
                                                    <>
                                                        {isDownloading ? (
                                                            <Pressable
                                                                style={[styles.whisperBtn, { backgroundColor: theme.colors.error }]}
                                                                onPress={() => downloadCancelRef.current[id]?.()}
                                                            >
                                                                <Text style={[styles.whisperBtnText, { color: '#fff' }]}>Cancel</Text>
                                                            </Pressable>
                                                        ) : (
                                                            <Pressable
                                                                style={[styles.whisperBtn, { backgroundColor: theme.colors.primary }]}
                                                                onPress={() => handleDownloadModel('whisper', id)}
                                                            >
                                                                <Text style={[styles.whisperBtnText, { color: '#fff' }]}>Download</Text>
                                                            </Pressable>
                                                        )}
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Show coming soon message when local STT is disabled */}
                        {!hasLocalInference() && (
                            <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15', marginTop: 12 }]}>
                                <Feather name="info" size={18} color={theme.colors.info} />
                                <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                    Local speech recognition (Whisper) is coming soon. Currently using system/expo/API providers.
                                </Text>
                            </View>
                        )}

                        {/* System provider info */}
                    </CollapsibleSection>

                    {/* 3. Text to Speech Section */}
                    <CollapsibleSection
                        title="Text to Speech"
                        icon="volume-2"
                        isExpanded={expandedSections.includes('tts')}
                        onToggle={() => toggleSectionWithRefresh('tts')}
                        badge={ttsProvider === 'custom' ? 'API' : 'System'}
                        description={`Independent of operation mode. Current: ${TTS_PROVIDERS.find(p => p.id === ttsProvider)?.name || 'System'}`}
                    >
                        <ChipSelector
                            options={TTS_PROVIDERS.map(p => ({ key: p.id, label: p.name }))}
                            selected={ttsProvider}
                            onSelect={(k: TTSProviderId) => setTtsProvider(k)}
                        />

                        {ttsProvider === 'custom' && (
                            <View style={styles.subsection}>
                                <View style={styles.spacer} />
                                <CompactInput
                                    label="TTS Endpoint"
                                    value={ttsBaseUrl}
                                    onChangeText={setTtsBaseUrl}
                                    placeholder="https://api.openai.com/v1/audio/speech"
                                />
                                <CompactInput
                                    label="API Key (optional)"
                                    value={ttsApiKey}
                                    onChangeText={setTtsApiKey}
                                    placeholder="Uses LLM API key when empty"
                                    secure
                                />
                                <CompactInput
                                    label="Model"
                                    value={ttsModel}
                                    onChangeText={setTtsModel}
                                    placeholder="tts-1"
                                />
                                <CompactInput
                                    label="Voice"
                                    value={ttsVoice}
                                    onChangeText={setTtsVoice}
                                    placeholder="alloy"
                                />
                            </View>
                        )}

                        {ttsProvider === 'system' && (
                            <View style={[styles.infoBanner, { backgroundColor: theme.colors.info + '15', marginTop: 12 }]}>
                                <Feather name="info" size={18} color={theme.colors.info} />
                                <Text style={[styles.infoText, { color: theme.colors.info }]}>
                                    Uses your device's built-in TTS voices. No additional setup required.
                                </Text>
                            </View>
                        )}
                    </CollapsibleSection>

                    {/* 4. Appearance Section */}
                    <CollapsibleSection
                        title="Appearance"
                        icon="eye"
                        isExpanded={expandedSections.includes('appearance')}
                        onToggle={() => toggleSection('appearance')}
                        badge={themeName}
                    >
                        <View style={styles.themeGrid}>
                            {([
                                { id: 'clean', label: 'Clean', icon: 'zap' },
                                { id: 'monoDark', label: 'Dark', icon: 'moon' },
                                { id: 'monoLight', label: 'Light', icon: 'sun' },
                                { id: 'forest', label: 'Forest', icon: 'anchor' },
                                { id: 'sunset', label: 'Sunset', icon: 'sunset' },
                            ] as { id: ThemeName; label: string; icon: any }[]).map(item => (
                                <Pressable
                                    key={item.id}
                                    style={[
                                        styles.themeOption,
                                        {
                                            backgroundColor: themeName === item.id ? `${theme.colors.primary}15` : theme.colors.surfaceHighlight,
                                            borderColor: themeName === item.id ? theme.colors.primary : theme.colors.border,
                                        }
                                    ]}
                                    onPress={() => setThemeName(item.id)}
                                >
                                    <Feather
                                        name={item.icon}
                                        size={14}
                                        color={themeName === item.id ? theme.colors.primary : theme.colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.themeText,
                                        { color: themeName === item.id ? theme.colors.primary : theme.colors.text }
                                    ]}>
                                        {item.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </CollapsibleSection>

                    {/* 5. Persona Section */}
                    <CollapsibleSection
                        title="Persona"
                        icon="user"
                        isExpanded={expandedSections.includes('persona')}
                        onToggle={() => toggleSection('persona')}
                        badge={userName || 'Default'}
                        description="Customize your identity for the AI"
                    >
                        <CompactInput
                            label="Your Name"
                            value={userName}
                            onChangeText={setUserName}
                            placeholder="How the AI should address you"
                        />
                        <CompactInput
                            label="Persona Description"
                            value={userPersona}
                            onChangeText={setUserPersona}
                            placeholder="Describe yourself (optional)"
                            multiline
                        />
                        <View style={styles.spacer} />
                        <CompactInput
                            label="System Prompt"
                            value={systemPrompt}
                            onChangeText={setSystemPrompt}
                            placeholder="Enter custom system prompt (e.g., You are a helpful assistant...)"
                            multiline
                        />
                        <Text style={[styles.switchDescription, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                            This information helps the AI personalize its responses to you.
                        </Text>
                    </CollapsibleSection>

                    {/* Chat behaviour: show/hide LLM reasoning */}
                    <CollapsibleSection
                        title="Chat"
                        icon="message-circle"
                        isExpanded={expandedSections.includes('chat')}
                        onToggle={() => toggleSection('chat')}
                        badge={showReasoning ? 'Reasoning on' : 'Reasoning off'}
                        description="Display and behaviour"
                    >
                        <View style={styles.switchRow}>
                            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                                Show LLM reasoning
                            </Text>
                            <Switch
                                value={showReasoning}
                                onValueChange={setShowReasoning}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={showReasoning ? theme.colors.primary : theme.colors.textSecondary}
                            />
                        </View>
                        <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                            When on, the model's thinking/reasoning (e.g. from o1, Solar, or {'<think>'} tags) is shown in a collapsible block above the answer.
                        </Text>
                        <View style={styles.switchRow}>
                            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                                Tools for non-native models
                            </Text>
                            <Switch
                                value={simulatedToolsEnabled}
                                onValueChange={setSimulatedToolsEnabled}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={simulatedToolsEnabled ? theme.colors.primary : theme.colors.textSecondary}
                            />
                        </View>
                        <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                            When on, models that don't support native tool calls (e.g. local GGUF) can still use tools via instructions in the prompt; the app parses the model's text for tool calls. Turn off to disable tools for those models.
                        </Text>
                        <View style={styles.switchRow}>
                            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                                Stream replies live
                            </Text>
                            <Switch
                                value={streamingChunksEnabled}
                                onValueChange={setStreamingChunksEnabled}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={streamingChunksEnabled ? theme.colors.primary : theme.colors.textSecondary}
                            />
                        </View>
                        <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                            When off, replies appear all at once with a fade-in (no streaming chunks).
                        </Text>
                        <View style={styles.switchRow}>
                            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>
                                Use GPS for search results
                            </Text>
                            <Switch
                                value={useGpsForSearch}
                                onValueChange={setUseGpsForSearch}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={useGpsForSearch ? theme.colors.primary : theme.colors.textSecondary}
                            />
                        </View>
                        <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                            When on, web search tries to localize results using your device location. Turn off for global results only.
                        </Text>
                    </CollapsibleSection>

                    {/* Search providers */}
                    <CollapsibleSection
                        title="Search"
                        icon="search"
                        isExpanded={expandedSections.includes('search')}
                        onToggle={() => toggleSection('search')}
                        badge={searchProvider === 'searxng' ? 'SearXNG' : 'Built-in'}
                        description="Choose a web search provider for more accurate results"
                    >
                        <Text style={[styles.subLabel, { color: theme.colors.textSecondary }]}>
                            Provider
                        </Text>
                        <ChipSelector
                            options={[
                                { key: 'headless', label: 'Built-in (Headless)' },
                                { key: 'searxng', label: 'SearXNG (JSON)' },
                                { key: 'duckduckgo', label: 'DuckDuckGo (API)' },
                                { key: 'brave', label: 'Brave Search (API)' },
                            ]}
                            selected={searchProvider}
                            onSelect={(k: 'headless' | 'searxng' | 'duckduckgo' | 'brave') => setSearchProvider(k)}
                        />
                        {searchProvider === 'searxng' && (
                            <>
                                <View style={styles.spacer} />
                                <CompactInput
                                    label="Base URL"
                                    value={searchBaseUrl}
                                    onChangeText={setSearchBaseUrl}
                                    placeholder="https://your-searxng.instance"
                                />
                                <CompactInput
                                    label="API Key (optional)"
                                    value={searchApiKey}
                                    onChangeText={setSearchApiKey}
                                    placeholder="x-api-key"
                                    secure
                                />
                                <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                                    If base URL is empty, the app falls back to the built-in headless search.
                                </Text>
                            </>
                        )}
                        {searchProvider === 'duckduckgo' && (
                            <>
                                <View style={styles.spacer} />
                                <CompactInput
                                    label="Base URL"
                                    value={ddgBaseUrl}
                                    onChangeText={setDdgBaseUrl}
                                    placeholder="https://api.duckduckgo.com"
                                />
                                <CompactInput
                                    label="API Key (optional)"
                                    value={ddgApiKey}
                                    onChangeText={setDdgApiKey}
                                    placeholder="x-api-key"
                                    secure
                                />
                                <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                                    Uses DuckDuckGo Instant Answer API by default. If base URL is empty, falls back to headless.
                                </Text>
                            </>
                        )}
                        {searchProvider === 'brave' && (
                            <>
                                <View style={styles.spacer} />
                                <CompactInput
                                    label="Base URL"
                                    value={braveBaseUrl}
                                    onChangeText={setBraveBaseUrl}
                                    placeholder="https://api.search.brave.com/res/v1/web/search"
                                />
                                <CompactInput
                                    label="API Key"
                                    value={braveApiKey}
                                    onChangeText={setBraveApiKey}
                                    placeholder="Brave API Key"
                                    secure
                                />
                                <Text style={[styles.switchDescription, { color: theme.colors.textSecondary }]}>
                                    Requires a Brave Search API key. If missing, falls back to headless.
                                </Text>
                            </>
                        )}
                    </CollapsibleSection>

                    <View style={{ height: insets.bottom + 20 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <StatusModal
                visible={statusModal.visible}
                type={statusModal.type}
                title={statusModal.title}
                message={statusModal.message}
                onDismiss={() => setStatusModal(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    headerBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtn: {
        // Dynamic color handled in render
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 6,
    },
    section: {
        borderWidth: 1,
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sectionTitleContainer: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    sectionDescription: {
        fontSize: 12,
        marginTop: 2,
        lineHeight: 16,
    },
    sectionContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 4,
    },
    inputWrapper: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    input: {
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 15,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 8,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    chipDescription: {
        fontSize: 11,
        marginTop: 2,
        fontWeight: '400',
    },
    spacer: {
        height: 16,
    },
    apiActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    apiActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
    },
    apiActionBtnText: {
        fontSize: 14,
        fontWeight: '500',
    },
    apiModelsSection: {
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        maxHeight: 220,
    },
    apiModelsLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    apiModelsList: {
        maxHeight: 180,
    },
    apiModelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: 4,
    },
    apiModelId: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    subsection: {
        marginTop: 8,
    },
    subLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    themeOption: {
        width: '47%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    themeText: {
        fontSize: 14,
        fontWeight: '600',
    },
    // Local model container
    localModelContainer: {
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    activeModelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    activeModelInfo: {
        marginLeft: 12,
        flex: 1,
    },
    activeModelLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    activeModelName: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 2,
    },
    activeModelHint: {
        fontSize: 13,
        marginTop: 2,
    },
    categoryLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    // Model item styles
    modelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    modelCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    modelInfo: {
        flex: 1,
    },
    modelNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modelName: {
        fontSize: 15,
        fontWeight: '600',
    },
    modelMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    modelDescription: {
        fontSize: 12,
        marginTop: 4,
    },
    modelActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        flexWrap: 'wrap',
    },
    modelActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 6,
        minWidth: 110,
    },
    modelActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    modelProgressText: {
        fontSize: 12,
        marginTop: 6,
    },
    whisperCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
    },
    whisperHeader: {
        gap: 4,
    },
    whisperTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    whisperTitle: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    whisperMeta: {
        fontSize: 12,
    },
    whisperActions: {
        marginTop: 10,
        flexDirection: 'row',
        gap: 8,
    },
    whisperBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    whisperBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    actionBtnSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    downloadBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressBarContainer: {
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginTop: 8,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
    },
    activeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    activeIndicatorText: {
        fontSize: 10,
        fontWeight: '700',
    },
    loadCustomBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    loadCustomText: {
        fontSize: 14,
        fontWeight: '600',
    },
    // Banner styles
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginTop: 12,
    },
    warningText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginTop: 12,
    },
    infoText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    // Switch row styles
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    switchLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    switchDescription: {
        fontSize: 12,
        marginTop: -8,
        marginBottom: 8,
    },
    ragStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    ragStatusText: {
        fontSize: 14,
        fontWeight: '500',
    },
    ragHint: {
        fontSize: 12,
        marginTop: 8,
        marginBottom: 4,
    },
    saveButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    deleteButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});

export default SettingsScreen;
