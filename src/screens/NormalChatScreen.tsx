/**
 * Normal Chat Screen - Clean, Working, Beautiful
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    Linking,
    Keyboard,
    Dimensions,
    Modal,
    Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { safeJSONParse, sanitizeInput } from '../utils/parsing';
import { uuidv4 } from '../utils/uuid';
import { ChunkQueue } from '../utils/ChunkQueue';
import { Attachment } from '../types/document';
import { Message, MessageContentPart } from '../types/message';
import { STTService } from '../services/stt/STTService';
import { TTSService } from '../services/tts/TTSService';
import { DictationOverlay } from '../components/molecules/DictationOverlay';
import { VisionService } from '../services/llm/VisionService';
import { LLMProviderId } from '../services/llm/types';
import { LLMService } from '../services/llm/LLMService';
import { DatabaseService } from '../services/DatabaseService';
import { Drawer } from '../components/organisms/Drawer';
import { Sidebar } from '../components/organisms/Sidebar';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { WelcomeScreen } from '../components/molecules/WelcomeScreen';
import { ToolActivityFeed, ToolActivityEvent } from '../components/molecules/ToolActivityFeed';
import { LinearGradient } from 'expo-linear-gradient';
import { ToolRegistry } from '../services/tools/ToolRegistry';
import { APIToolCall } from '../types/message';
import { AttachmentPreview } from '../components/molecules/AttachmentPreview';
import { ChatInput } from '../components/molecules/ChatInput';
import { ChatInputMenu } from '../components/molecules/ChatInputMenu';
import { QuizMiniApp } from '../components/molecules/QuizMiniApp';
import { MiniAppMode } from '../components/molecules/MiniAppTypes';
import { BrowserBubble } from '../components/molecules/BrowserBubble';
import { ErrorModal } from '../components/molecules/ErrorModal';
import { EditMessageModal } from '../components/molecules/EditMessageModal';
import { MemoizedMessageBubble } from '../components/atoms/MessageBubble';
import { SettingsBus } from '../services/SettingsBus';




// Models with native tool support
const NATIVE_TOOL_MODELS = ['gpt-4', 'gpt-3.5', 'claude', 'llama-3'];

// Check if model supports native tools
const supportsTools = (modelId: string): boolean => {
    const lower = modelId.toLowerCase();
    return NATIVE_TOOL_MODELS.some(m => lower.includes(m));
};

interface VersionHistory {
    [parentId: string]: {
        versions: Message[];
        currentVersion: number;
    };
}

export const NormalChatScreen: React.FC = ({ navigation }: any) => {
    const route = useRoute<RouteProp<{ Chat: { conversationId?: string; initialPrompt?: string; newChat?: boolean } }, 'Chat'>>();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const [localConversationId, setLocalConversationId] = useState<string>(`chat_${uuidv4()}`);
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [conversationCreated, setConversationCreated] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [errorModal, setErrorModal] = useState({ visible: false, message: '' });
    const [activeInAppUrl, setActiveInAppUrl] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const [currentModel, setCurrentModel] = useState('gpt-3.5-turbo');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [toolActivity, setToolActivity] = useState<ToolActivityEvent[]>([]);
    const [versionHistory, setVersionHistory] = useState<VersionHistory>({});

    // Mini-app state
    const [menuVisible, setMenuVisible] = useState(false);
    const [activeMiniApp, setActiveMiniApp] = useState<string | null>(null);
    const [deviceTier, setDeviceTier] = useState<'low' | 'medium' | 'high'>('medium');
    const [isOnline, setIsOnline] = useState(true);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [thinkMode, setThinkMode] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [visionMode, setVisionMode] = useState(false);

    // Dictation state
    const [isDictating, setIsDictating] = useState(false);
    const [dictationLevel, setDictationLevel] = useState(-160);
    const [dictationProvider, setDictationProvider] = useState<'system' | 'expo_speech' | 'api' | 'whisper_local' | null>(null);
    const [dictationStartedAt, setDictationStartedAt] = useState<number | null>(null);
    const [dictationElapsedMs, setDictationElapsedMs] = useState(0);
    const [showReasoning, setShowReasoning] = useState(true);
    const [streamingChunksEnabled, setStreamingChunksEnabled] = useState(true);

    // Performance: Throttle refs
    const pendingUpdateRef = useRef<{ content: string; thinking: string; tokenUsage: any } | null>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const addedToMessagesRef = useRef(false);

    const streamingRef = useRef(false);
    const flatListRef = useRef<FlatList>(null);
    const autoScrollRef = useRef(true);
    const userScrollingRef = useRef(false);
    const lastAutoScrollAtRef = useRef(0);
    // Ref for tool prefs so send sees the tool even if state hasn't updated yet (menu -> send timing)
    const pendingToolPrefsRef = useRef<{ useDeepSearch?: boolean; useWebSearch?: boolean; useImageGen?: boolean } | null>(null);

    const pushToolActivity = useCallback(
        (
            message: string,
            kind: ToolActivityEvent['kind'] = 'tool',
            phase: ToolActivityEvent['phase'] = 'progress'
        ) => {
            if (!message?.trim()) return;
            setToolActivity(prev => {
                const last = prev[prev.length - 1];
                if (last && last.message === message && last.phase === phase && last.kind === kind) {
                    return prev;
                }
                const next = [...prev, { id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, message, kind, phase }];
                return next.slice(-10);
            });
        },
        []
    );

    const clearToolActivity = useCallback(() => {
        setToolActivity([]);
    }, []);

    // Check connection status
    useEffect(() => {
        const checkOnline = async () => {
            try {
                const response = await fetch('https://www.google.com/favicon.ico', {
                    method: 'HEAD',
                    timeout: 3000
                } as any);
                setIsOnline(response.ok);
            } catch {
                setIsOnline(false);
            }
        };
        checkOnline();

        // Simple device tier detection
        const detectDeviceTier = () => {
            // In a real implementation, this would check RAM, GPU, etc.
            // For now, default to medium
            setDeviceTier('medium');
        };
        detectDeviceTier();
    }, []);

    // Load settings and initialize services
    useEffect(() => {
        AsyncStorage.getItem('settings_userName').then(name => name && setUserName(name));
        AsyncStorage.getItem('settings_model').then(model => model && setCurrentModel(model));
        AsyncStorage.getItem('settings_provider').then(p => {
            if (p) checkVisionCapabilities(p as LLMProviderId);
        });
        AsyncStorage.getItem('settings_showReasoning').then(v => {
            const show = v !== 'false';
            setShowReasoning(show);
            // Sync to LLMService so OpenRouter reasoning tokens follow the setting (https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
            LLMService.setConfig({
                reasoning: { exclude: !show, ...(show ? { effort: 'medium' as const } : {}) },
            });
        });
        AsyncStorage.getItem('settings_streamingChunksEnabled').then(v => {
            if (v === null) return;
            setStreamingChunksEnabled(v === 'true');
        });

        // Initialize STT service - auto-detects local Whisper models
        STTService.initialize().catch(err => {
            console.error('[NormalChatScreen] Failed to initialize STT:', err);
        });

        // Initialize TTS service - loads saved settings
        TTSService.initialize().catch(err => {
            console.error('[NormalChatScreen] Failed to initialize TTS:', err);
        });

        // Initialize Vision service
        VisionService.initialize().catch(err => {
            console.error('[NormalChatScreen] Failed to initialize Vision:', err);
        });
    }, []);

    useEffect(() => {
        const unsubscribe = SettingsBus.subscribe(change => {
            if (change.userName !== undefined) setUserName(change.userName);
            if (change.model) setCurrentModel(change.model);
            if (change.provider) checkVisionCapabilities(change.provider as LLMProviderId);
            if (change.showReasoning !== undefined) {
                setShowReasoning(change.showReasoning);
                LLMService.setConfig({
                    reasoning: { exclude: !change.showReasoning, ...(change.showReasoning ? { effort: 'medium' as const } : {}) },
                });
            }
            if (change.streamingChunksEnabled !== undefined) {
                setStreamingChunksEnabled(change.streamingChunksEnabled);
            }
        });
        return unsubscribe;
    }, []);

    const refreshProviderAndModel = useCallback(async () => {
        try {
            // Prefer in-memory config (Settings updates LLMService immediately)
            const cfg = LLMService.getConfig();
            if (cfg?.model) setCurrentModel(cfg.model);
            if (cfg?.provider) checkVisionCapabilities(cfg.provider as LLMProviderId);

            // Fallback to persisted settings (in case service not initialized yet)
            const [savedModel, savedProvider] = await AsyncStorage.multiGet([
                'settings_model',
                'settings_provider',
            ]);
            if (savedModel?.[1]) setCurrentModel(savedModel[1]);
            if (savedProvider?.[1]) checkVisionCapabilities(savedProvider[1] as LLMProviderId);
        } catch (e) {
            console.warn('[NormalChatScreen] Failed to refresh provider/model:', e);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshProviderAndModel();
            AsyncStorage.getItem('settings_streamingChunksEnabled').then(v => {
                if (v === null) return;
                setStreamingChunksEnabled(v === 'true');
            });
        }, [refreshProviderAndModel])
    );

    // Check vision capabilities when provider changes
    const checkVisionCapabilities = async (providerId: LLMProviderId) => {
        const supportsVision = await VisionService.supportsVision(providerId);
        setVisionMode(supportsVision);
    };

    // Handle route params
    useEffect(() => {
        if (route.params?.newChat) {
            setLocalConversationId(`chat_${uuidv4()}`);
            setLocalMessages([]);
            setInputText('');
            setConversationCreated(false);
        } else if (route.params?.conversationId) {
            // Only load if it's a different conversation or we are not in the middle of one?
            // Simplest is to just load it.
            if (route.params.conversationId !== localConversationId) {
                setLocalConversationId(route.params.conversationId);
                loadMessages(route.params.conversationId);
                setConversationCreated(true);
            }
        }

        if (route.params?.initialPrompt) {
            sendMessage(route.params.initialPrompt);
        }

    }, [route.params]);

    const loadMessages = async (convId: string) => {
        const msgs = await DatabaseService.getMessages(convId);
        setLocalMessages(msgs);
    };

    const handleEdit = (msg: Message) => {
        if (isStreaming) {
            streamingRef.current = false;
        }
        setEditingMessage(msg);
        setEditModalVisible(true);
    };

    const handleDelete = async (msgId: string) => {
        setLocalMessages(prev => prev.filter(msg => msg.id !== msgId));
        await DatabaseService.deleteMessage(msgId);
    };

    // No top actions in the input menu

    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleToolSelect = (appId: string) => {
        const toolNames: Record<string, string> = {
            quiz: 'Quiz',
            think: 'Think Mode',
            image_gen: 'Image Gen',
            deep_research: 'Deep Research',
            study: 'Study Mode',
            web_search: 'Web Search',
            canvas: 'Canvas',
            apps: 'Apps',
        };

        // Set active tool for visual feedback (stays until dismissed)
        setActiveTool(toolNames[appId] || appId);

        // Handle specific tools
        switch (appId) {
            case 'quiz':
                setActiveMiniApp('quiz');
                setActiveTool(null);
                setThinkMode(false);
                break;
            case 'think':
                // Toggle think mode
                setThinkMode(prev => {
                    const newMode = !prev;
                    if (newMode) {
                        setActiveTool('Think Mode');
                    } else {
                        setActiveTool(null);
                    }
                    return newMode;
                });
                break;
            case 'deep_research':
                // Just set active tool badge, user types in chat (no MiniApp modal)
                setActiveTool('Deep Research');
                pendingToolPrefsRef.current = { useDeepSearch: true };
                setThinkMode(false);
                break;
            case 'web_search':
                setActiveTool('Web Search');
                pendingToolPrefsRef.current = { useWebSearch: true };
                setThinkMode(false);
                break;
            case 'image_gen':
                setActiveTool('Image Gen');
                pendingToolPrefsRef.current = { useImageGen: true };
                setThinkMode(false);
                setInputText('/image ');
                break;
            case 'apps':
                // For now, just show the active tool badge
                pushToolActivity(`${toolNames[appId]} - Coming soon`, 'tool', 'progress');
                setTimeout(() => clearToolActivity(), 1800);
                setActiveTool(null);
                setThinkMode(false);
                break;
            default:
                break;
        }
    };

    const handleRegenerate = async (msgId: string) => {
        if (isStreaming) {
            streamingRef.current = false;
            // Short delay to ensure the loop breaks before we start a new one
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const msgIndex = localMessages.findIndex(m => m.id === msgId);
        if (msgIndex <= 0) return;

        // Find the user message that triggered this response
        let userMsgIndex = msgIndex - 1;
        while (userMsgIndex >= 0 && localMessages[userMsgIndex].role !== 'user') {
            userMsgIndex--;
        }
        if (userMsgIndex < 0) return;

        const userMsg = localMessages[userMsgIndex];
        const oldAssistantMsg = localMessages[msgIndex];
        const history = localMessages.slice(0, userMsgIndex + 1);

        // Store the old message as a version keyed by user message ID
        setVersionHistory(prev => {
            const existing = prev[userMsg.id];
            if (existing) {
                const alreadyIdx = existing.versions.findIndex(v => v.id === oldAssistantMsg.id);
                const versions = alreadyIdx >= 0 ? existing.versions : [...existing.versions, oldAssistantMsg];
                const currentVersion = alreadyIdx >= 0 ? alreadyIdx : versions.length - 1;
                return {
                    ...prev,
                    [userMsg.id]: {
                        versions,
                        currentVersion
                    }
                };
            }
            // Create new version history with old message as first version
            return {
                ...prev,
                [userMsg.id]: {
                    versions: [oldAssistantMsg],
                    currentVersion: 0
                }
            };
        });

        // Remove the old assistant message and any messages after it
        const messagesToRemove = localMessages.slice(msgIndex);
        for (const msg of messagesToRemove) {
            await DatabaseService.deleteMessage(msg.id);
        }

        setLocalMessages(history);
        clearToolActivity();
        await processConversationStep(history, userMsg.id); // Pass userMsg.id to track versions
    };

    const handleVersionChange = (parentId: string, versionIndex: number) => {
        setVersionHistory(prev => ({
            ...prev,
            [parentId]: { ...prev[parentId], currentVersion: versionIndex }
        }));
    };

    // Parse <think> tags from deepseek/qwen models
    const parseStreamChunk = (text: string, state: { inThink: boolean; buffer: string }) => {
        let content = '';
        let thinking = '';
        let buffer = state.buffer + text;

        // Helper to find partial tag at end of string
        const findPartialTag = (str: string, tag: string): number => {
            for (let i = 1; i < tag.length; i++) {
                if (str.endsWith(tag.substring(0, i))) {
                    return i; // Length of partial match
                }
            }
            return 0;
        };

        // Process loop
        while (buffer.length > 0) {
            if (!state.inThink) {
                const thinkStart = buffer.indexOf('<think>');
                if (thinkStart !== -1) {
                    // Found start tag
                    content += buffer.substring(0, thinkStart);
                    buffer = buffer.substring(thinkStart + 7);
                    state.inThink = true;
                } else {
                    // No full start tag. Check for partial start tag at end.
                    const partialLen = findPartialTag(buffer, '<think>');
                    if (partialLen > 0) {
                        // Keep partial tag in buffer, flush rest
                        content += buffer.substring(0, buffer.length - partialLen);
                        buffer = buffer.substring(buffer.length - partialLen);
                        break; // Wait for next chunk
                    } else {
                        // All content
                        content += buffer;
                        buffer = '';
                    }
                }
            } else {
                const thinkEnd = buffer.indexOf('</think>');
                if (thinkEnd !== -1) {
                    // Found end tag
                    thinking += buffer.substring(0, thinkEnd);
                    buffer = buffer.substring(thinkEnd + 8);
                    state.inThink = false;
                } else {
                    // No full end tag. Check for partial end tag at end.
                    const partialLen = findPartialTag(buffer, '</think>');
                    if (partialLen > 0) {
                        // Keep partial tag in buffer, flush rest
                        thinking += buffer.substring(0, buffer.length - partialLen);
                        buffer = buffer.substring(buffer.length - partialLen);
                        break; // Wait for next chunk
                    } else {
                        // All thinking
                        thinking += buffer;
                        buffer = '';
                    }
                }
            }
        }

        return { content, thinking, newState: { inThink: state.inThink, buffer } };
    };

    // Simplify messages for API (remove UI-only fields)
    const cleanMessageHistory = (messages: Message[]): any[] => {
        return messages.map(m => {
            const clean: any = {
                role: m.role,
                // Handle multimodal content (arrays) or plain text
                content: m.content || null
            };

            // tool_calls are already in the correct API format (APIToolCall)
            // Just copy them over directly
            if (m.tool_calls && m.tool_calls.length > 0) {
                clean.tool_calls = m.tool_calls;
            }

            if (m.tool_call_id) {
                clean.tool_call_id = m.tool_call_id;
            }

            // Mistral/OpenAI: If tool_calls are present, content should be null if empty string
            if (clean.tool_calls && clean.tool_calls.length > 0 && clean.content === '') {
                clean.content = null;
            }

            return clean;
        });
    };

    const isBlankContent = (content: Message['content']): boolean => {
        if (typeof content === 'string') {
            return content.trim() === '';
        }
        return !content || content.length === 0;
    };

    const processConversationStep = async (
        initialMessages: Message[],
        parentUserMsgId?: string,
        toolPrefs?: { useDeepSearch?: boolean; useWebSearch?: boolean; useImageGen?: boolean }
    ) => {
        autoScrollRef.current = true;
        userScrollingRef.current = false;
        let finalInitialMessages = [...initialMessages];

        let currentMessages = cleanMessageHistory(finalInitialMessages);
        let stepCount = 0;
        const MAX_STEPS = 5;
        let pendingToolResponses: any[] = [];

        // Inject tool instructions based on preferences (explicit so model calls the tool)
        if (toolPrefs?.useDeepSearch && currentMessages.length > 0) {
            const lastMsg = currentMessages[currentMessages.length - 1];
            if (lastMsg.role === 'user') {
                lastMsg.content = `[REQUIRED: Call the deep_search tool to research this thoroughly. Extract a clear query and use deep_search(query="...").] ${lastMsg.content}`;
            }
        } else if (toolPrefs?.useWebSearch && currentMessages.length > 0) {
            const lastMsg = currentMessages[currentMessages.length - 1];
            if (lastMsg.role === 'user') {
                lastMsg.content = `[REQUIRED: Call the web_search tool with a query to get current information. Use web_search(query="...") with a short search query. Do not answer from memory—call the tool first.] ${lastMsg.content}`;
            }
        } else if (toolPrefs?.useImageGen && currentMessages.length > 0) {
            const lastMsg = currentMessages[currentMessages.length - 1];
            if (lastMsg.role === 'user') {
                lastMsg.content = `[REQUIRED: Call the generate_image tool to create an image. Use generate_image(prompt="...").] ${lastMsg.content}`;
            }
        }

        // Hoist cleanup function and ref for chunk queue scope
        let chunkQueue: ChunkQueue | null = null;
        const cleanupChunkQueue = () => {
            if (chunkQueue) {
                try {
                    chunkQueue.destroy();
                } catch (e) {
                    console.error('Error destroying chunkQueue:', e);
                }
                chunkQueue = null;
            }
        };

        while (stepCount < MAX_STEPS) {
            stepCount++;
            setIsStreaming(true);
            streamingRef.current = true;

            const availableTools = ToolRegistry.getToolDefinitions();

            // On the last step, disable tools to force a final answer
            const isLastStep = stepCount >= MAX_STEPS - 1;
            if (isLastStep) {
                console.log('[NormalChatScreen] Last step - disabling tools to force final answer');
            }

            try {
                // Check if the last message has images and we need to use vision provider
                const lastMessage = currentMessages[currentMessages.length - 1];
                const hasImages = typeof lastMessage?.content !== 'string' ||
                    (Array.isArray(lastMessage.content) && lastMessage.content.some((c: any) =>
                        c.type === 'image_url' || c.type === 'image'
                    ));

                // Determine which provider to use
                let streamConfig: any = {
                    tools: isLastStep ? [] : availableTools, // Disable tools on last step
                    disableAutoExecution: true
                };

                if (hasImages) {
                    const visionProvider = LLMService.getVisionProvider();
                    const visionConfig = LLMService.getVisionConfig();
                    if (visionConfig?.useSeparate) {
                        streamConfig.provider = visionProvider.id;
                        streamConfig.model = visionConfig.model;
                        if (visionConfig.baseUrl) streamConfig.baseUrl = visionConfig.baseUrl;
                        if (visionConfig.apiKey) streamConfig.apiKey = visionConfig.apiKey;
                        console.log('[processConversationStep] Using separate vision provider:', visionProvider.id);
                    }
                }

                const stream = LLMService.streamChat(currentMessages, streamConfig);

                let fullContent = '';
                let fullThinking = '';
                let accumulatedToolCalls: APIToolCall[] = [];
                let lastTokenUsage = { input: 0, output: 0, total: 0 };
                let parserState = { inThink: false, buffer: '' };

                const assistantMsgId = uuidv4();
                let lastThinkingUpdate = 0;

                const assistantMsg: Message = {
                    id: assistantMsgId,
                    conversationId: localConversationId,
                    role: 'assistant',
                    content: '',
                    timestamp: Date.now(),
                    metadata: { isStreaming: true, thinking: thinkMode ? '' : undefined }
                };

                // Reset the addedToMessages ref for this new message
                addedToMessagesRef.current = false;

                // Create chunk queue for batching stream chunks (if enabled)
                if (streamingChunksEnabled) {
                    chunkQueue = new ChunkQueue(
                        // onBatch: Update message with batched content (or add if first batch)
                        (batch) => {
                            setLocalMessages((prev) => {
                                const exists = prev.find((m) => m.id === assistantMsgId);
                                if (exists) {
                                    // Message already in state, update it
                                    return prev.map((m) => {
                                        if (m.id === assistantMsgId) {
                                            return {
                                                ...m,
                                                content: batch.content,
                                                metadata: {
                                                    ...m.metadata,
                                                    isStreaming: true,
                                                    thinking: fullThinking,
                                                    tokenUsage: lastTokenUsage
                                                }
                                            };
                                        }
                                        return m;
                                    });
                                } else {
                                    // First batch: add message to state with initial content
                                    addedToMessagesRef.current = true;
                                    return [...prev, {
                                        ...assistantMsg,
                                        content: batch.content,
                                        metadata: {
                                            ...assistantMsg.metadata,
                                            isStreaming: true,
                                            thinking: fullThinking,
                                            tokenUsage: lastTokenUsage
                                        }
                                    }];
                                }
                            });

                            // Sync versionHistory if this is a regeneration
                            if (parentUserMsgId) {
                                setVersionHistory((prevvh) => {
                                    const vh = prevvh[parentUserMsgId];
                                    if (!vh) return prevvh;
                                    return {
                                        ...prevvh,
                                        [parentUserMsgId]: {
                                            ...vh,
                                            versions: vh.versions.map((v) => {
                                                if (v.id === assistantMsgId) {
                                                    return {
                                                        ...v,
                                                        content: batch.content,
                                                        metadata: {
                                                            ...v.metadata,
                                                            thinking: fullThinking,
                                                            tokenUsage: lastTokenUsage
                                                        }
                                                    };
                                                }
                                                return v;
                                            })
                                        }
                                    };
                                });
                            }
                        },
                        // onComplete: Mark streaming as done
                        () => {
                            setLocalMessages((prev) => {
                                return prev.map((m) => {
                                    if (m.id === assistantMsgId) {
                                        return { ...m, metadata: { ...m.metadata, isStreaming: false } };
                                    }
                                    return m;
                                });
                            });

                            if (parentUserMsgId) {
                                setVersionHistory((prevvh) => {
                                    const vh = prevvh[parentUserMsgId];
                                    if (!vh) return prevvh;
                                    return {
                                        ...prevvh,
                                        [parentUserMsgId]: {
                                            ...vh,
                                            versions: vh.versions.map((v) => {
                                                if (v.id === assistantMsgId) {
                                                    return { ...v, metadata: { ...v.metadata, isStreaming: false } };
                                                }
                                                return v;
                                            })
                                        }
                                    };
                                });
                            }
                        },
                        {
                            batchSizeChars: 300,        // Larger batches = fewer re-renders (throttled parsing handles smoothness)
                            batchInterval: 150,        // 150ms between batches (works well with 200ms parse throttle)
                            maxFlushDelay: 300         // Flush if idle for 300ms
                        }
                    );
                }

                // NOTE: Do NOT add message to localMessages here.
                // The onBatch callback below will add it on the FIRST batch of content.
                // This prevents an empty placeholder bubble from appearing during tool execution.

                // If this is a regenerated response, add it to version history
                if (parentUserMsgId && stepCount === 1) {
                    setVersionHistory((prevvh) => {
                        const existing = prevvh[parentUserMsgId];
                        if (existing) {
                            if (existing.versions.some(v => v.id === assistantMsg.id)) {
                                return prevvh;
                            }
                            return {
                                ...prevvh,
                                [parentUserMsgId]: {
                                    versions: [...existing.versions, assistantMsg],
                                    currentVersion: existing.versions.length
                                }
                            };
                        }
                        return prevvh;
                    });
                }

                for await (const chunk of stream) {
                    if (!streamingRef.current) {
                        cleanupChunkQueue();
                        break;
                    }

                    const textChunk = chunk.content || '';
                    const reasoningChunk = chunk.reasoning || '';
                    const parsed = parseStreamChunk(textChunk, parserState);

                    // Accumulate full content for final save
                    fullContent += parsed.content;
                    fullThinking += parsed.thinking;
                    if (reasoningChunk) {
                        fullThinking += reasoningChunk;
                    }
                    parserState = parsed.newState;

                    // Smart Auto-Scroll
                    if (autoScrollRef.current && !userScrollingRef.current && (fullContent.length > 0 || fullThinking.length > 0)) {
                        const now = Date.now();
                        if (now - lastAutoScrollAtRef.current > 150) {
                            lastAutoScrollAtRef.current = now;
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }

                    // Handle tool-related chunks
                    if (chunk.toolCalls && chunk.toolCalls.length > 0) {
                        accumulatedToolCalls = chunk.toolCalls;
                        console.log('[NormalChatScreen] Received tool calls:', chunk.toolCalls.length);
                    }
                    if (chunk.tokenUsage) lastTokenUsage = chunk.tokenUsage;

                    // Handle tool status updates (toolStart/toolEnd)
                    if (chunk.toolStart) {
                        if (chunk.toolStart.name === '_thinking') {
                            pushToolActivity('Thinking about your request...', 'thinking', 'start');
                        } else {
                            const name = chunk.toolStart.name.replace(/_/g, ' ');
                            pushToolActivity(chunk.toolStart.ttsMessage || `Using ${name}...`, name.includes('search') ? 'web' : 'tool', 'start');
                        }
                    }
                    if (chunk.toolEnd) {
                        if (chunk.toolEnd.name === '_thinking') continue;
                        pushToolActivity(`${chunk.toolEnd.name.replace(/_/g, ' ')} finished`, chunk.toolEnd.name.includes('search') ? 'web' : 'tool', 'done');
                    }

                    if (parsed.content && streamingChunksEnabled) {
                        chunkQueue?.addChunk(parsed.content);
                    }

                    if (streamingChunksEnabled && (parsed.thinking || reasoningChunk) && !parsed.content) {
                        const now = Date.now();
                        if (now - lastThinkingUpdate > 100) {
                            lastThinkingUpdate = now;
                            setLocalMessages((prev) => {
                                if (!addedToMessagesRef.current) {
                                    addedToMessagesRef.current = true;
                                    return [...prev, {
                                        ...assistantMsg,
                                        content: '',
                                        metadata: {
                                            ...assistantMsg.metadata,
                                            thinking: fullThinking,
                                            isStreaming: true
                                        }
                                    }];
                                }

                                return prev.map((m) => {
                                    if (m.id === assistantMsgId) {
                                        return {
                                            ...m,
                                            metadata: {
                                                ...m.metadata,
                                                thinking: fullThinking,
                                                isStreaming: true
                                            }
                                        };
                                    }
                                    return m;
                                });
                            });

                            if (parentUserMsgId) {
                                setVersionHistory((prevvh) => {
                                    const vh = prevvh[parentUserMsgId];
                                    if (!vh) return prevvh;
                                    return {
                                        ...prevvh,
                                        [parentUserMsgId]: {
                                            ...vh,
                                            versions: vh.versions.map((v) => {
                                                if (v.id === assistantMsgId) {
                                                    return { ...v, metadata: { ...v.metadata, thinking: fullThinking } };
                                                }
                                                return v;
                                            })
                                        }
                                    };
                                });
                            }
                        }
                    }
                }

                // Stream completed or stopped - flush any remaining chunks
                if (chunkQueue) {
                    chunkQueue.complete();
                }

                // Wait a bit for chunk queue to finish batching
                if (streamingChunksEnabled) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }

                // Clean up chunk queue
                cleanupChunkQueue();

                // Wait a bit for chunk queue to finish batching
                if (streamingChunksEnabled) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }

                // Clean up chunk queue
                cleanupChunkQueue();

                // Flush any pending UI updates before finalizing
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current);
                    updateTimeoutRef.current = null;
                }

                // If we ended mid-think tag, flush remaining buffer
                if (parserState.buffer) {
                    if (parserState.inThink) fullThinking += parserState.buffer;
                    else fullContent += parserState.buffer;
                    parserState.buffer = '';
                }

                // If thinking exists but no content (and user didn't request think mode), treat it as the answer
                if (!thinkMode && (!fullContent || fullContent.trim().length === 0) && fullThinking && fullThinking.trim().length > 0) {
                    fullContent = fullThinking;
                    fullThinking = '';
                }

                const groupedToolResponses = pendingToolResponses.length > 0 ? [...pendingToolResponses] : undefined;
                pendingToolResponses = [];

                const finalAssistantMsg: Message = {
                    ...assistantMsg,
                    content: fullContent,
                    timestamp: Date.now(),
                    tool_calls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                    metadata: { isStreaming: false, thinking: fullThinking, tokenUsage: lastTokenUsage, groupedToolResponses, fadeIn: !streamingChunksEnabled }
                };

                const hasContent = (fullContent && fullContent.trim().length > 0) || (fullThinking && fullThinking.trim().length > 0);
                if (hasContent) {
                    await DatabaseService.addMessage(finalAssistantMsg);
                }

                if (addedToMessagesRef.current || hasContent) {
                    setLocalMessages((prev) => {
                        const exists = prev.find((m) => m.id === assistantMsgId);
                        if (exists) {
                            return prev.map((m) => m.id === assistantMsgId ? finalAssistantMsg : m);
                        } else {
                            return hasContent ? [...prev, finalAssistantMsg] : prev;
                        }
                    });
                }

                // Update version history with the final completed message
                if (parentUserMsgId && stepCount === 1) {
                    setVersionHistory((prevvh) => {
                        const existing = prevvh[parentUserMsgId];
                        if (existing) {
                            const updatedVersions = [...existing.versions];
                            const idx = updatedVersions.findIndex(v => v.id === finalAssistantMsg.id);
                            if (idx >= 0) {
                                updatedVersions[idx] = finalAssistantMsg;
                            } else {
                                return prevvh;
                            }
                            return {
                                ...prevvh,
                                [parentUserMsgId]: {
                                    ...existing,
                                    versions: updatedVersions
                                }
                            };
                        }
                        return prevvh;
                    });
                }

                // If user stopped the generation, exit the loop here
                if (!streamingRef.current) {
                    setIsStreaming(false);
                    break;
                }

                // Handle tool calls - execute each tool and continue for next LLM turn
                if (accumulatedToolCalls.length > 0) {
                    if (!streamingRef.current) break;

                    console.log('[NormalChatScreen] Processing', accumulatedToolCalls.length, 'tool call(s)');

                    // Add assistant message with tool_calls to history
                    currentMessages.push({
                        role: 'assistant',
                        content: fullContent || null,
                        tool_calls: accumulatedToolCalls
                            .filter((tc) => tc && tc.function)
                            .map((tc) => ({
                                id: tc.id || `tool_${Date.now()}`,
                                type: tc.type || 'function' as const,
                                function: { name: tc.function!.name, arguments: tc.function!.arguments }
                            }))
                    });

                    // Execute each tool sequentially with UI feedback
                    let toolIndex = 0;
                    for (const toolCall of accumulatedToolCalls) {
                        if (!streamingRef.current || !toolCall || !toolCall.function) continue;
                        toolIndex++;

                        const toolName = toolCall.function.name;
                        const friendlyMessage = ToolRegistry.getTTSMessage(toolName);
                        const suppressIntermediateToolActivity = false;

                        // Show which tool is running (with step number for chaining)
                        if (!suppressIntermediateToolActivity) {
                            pushToolActivity(
                                accumulatedToolCalls.length > 1
                                    ? `Step ${toolIndex}/${accumulatedToolCalls.length}: ${friendlyMessage}`
                                    : friendlyMessage,
                                toolName.includes('search') ? 'web' : 'tool',
                                'start'
                            );
                        }

                        console.log(`[NormalChatScreen] Executing tool: ${toolName}`);

                        try {
                            const toolArgs = safeJSONParse(toolCall.function.arguments, {});
                        const result = await ToolRegistry.executeTool(
                            toolName,
                            toolArgs,
                            {
                                conversationId: localConversationId,
                                onProgress: (status, _currentStep, _totalSteps, meta) => {
                                        if (suppressIntermediateToolActivity) return;
                                        const message = meta?.domain
                                            ? `${status} (${meta.domain})`
                                            : status;
                                        pushToolActivity(message, meta?.tool?.includes('search') ? 'web' : 'tool', 'progress');
                                    }
                                }
                            );

                            if (!streamingRef.current) break;

                        const isToolResponse = result && typeof result === 'object' && 'type' in result && 'content' in result;
                        const toolContent = isToolResponse ? result.content : (typeof result === 'string' ? result : JSON.stringify(result));
                        console.log(`[NormalChatScreen] Tool ${toolName} completed, result length:`, toolContent?.length || 0);
                        pushToolActivity(
                            suppressIntermediateToolActivity
                                ? 'Web browse completed'
                                : `${toolName.replace(/_/g, ' ')} completed`,
                            toolName.includes('search') ? 'web' : 'tool',
                            'done'
                        );
                        if (isToolResponse) {
                            pendingToolResponses.push(result);
                        }

                        currentMessages.push({
                            role: 'tool',
                            content: toolContent,
                                tool_call_id: toolCall.id || `tool_${Date.now()}`,
                            });
                        } catch (e: any) {
                            if (!streamingRef.current) break;
                            console.error(`[NormalChatScreen] Tool ${toolName} error:`, e.message);
                            pushToolActivity(`${toolName.replace(/_/g, ' ')} failed: ${e.message}`, toolName.includes('search') ? 'web' : 'tool', 'error');
                            currentMessages.push({
                                role: 'tool',
                                content: `Error: ${e.message}`,
                                tool_call_id: toolCall.id || `tool_${Date.now()}`,
                            });
                        }
                    }

                    if (!streamingRef.current) break;

                    // Check if we've done too many tool calls - force final answer
                    if (stepCount >= MAX_STEPS - 1) {
                        console.log('[NormalChatScreen] Too many tool calls, forcing final answer');
                        pushToolActivity('Summarizing results...', 'thinking', 'progress');

                        // Add instruction to give final answer
                        currentMessages.push({
                            role: 'user',
                            content: '[SYSTEM: You have gathered enough information. Please provide your final answer now based on the tool results above. Do NOT call any more tools.]'
                        });
                    } else {
                        pushToolActivity('Generating response with tool results...', 'thinking', 'progress');
                    }

                    // Reset for next iteration (tool chaining)
                    accumulatedToolCalls = [];
                    fullContent = '';
                    fullThinking = '';

                    // Continue the while loop to get LLM's response with tool results
                    continue;
                }

                break;
            } catch (error: any) {
                console.error('Stream error:', error);
                cleanupChunkQueue();
                const errorMsg = error.message || '';
                if (errorMsg.includes('503') || errorMsg.includes('No instances') || errorMsg.includes('Provider')) {
                    const errorAssistantMsg: Message = {
                        id: uuidv4(),
                        conversationId: localConversationId,
                        role: 'assistant',
                        content: ` **Provider temporarily unavailable**\n\nThe service is experiencing high demand. Please try again in a moment or switch models.`,
                        timestamp: Date.now(),
                    };
                    await DatabaseService.addMessage(errorAssistantMsg);
                    setLocalMessages((prev) => [...prev, errorAssistantMsg]);
                } else if (errorMsg.includes('404') && errorMsg.includes('tool')) {
                    // This should be handled by LLMService fallback, but if it bubbles up to here:
                    console.warn('[NormalChatScreen] Tool support error bubbled up (should be handled by LLMService):', errorMsg);
                    // Let it slide or show a toast? For now, we rely on LLMService fallback.
                    // If it bubbled, it means fallback failed or something else happened.
                    setErrorModal({ visible: true, message: `Tool Error: ${error.message}. Try disabling tools or switching models.` });
                } else {
                    setErrorModal({ visible: true, message: error.message });
                }
                break;
            }
        }

        cleanupChunkQueue();
        if (!streamingRef.current && !addedToMessagesRef.current) {
            const cancelledMsg: Message = {
                id: uuidv4(),
                conversationId: localConversationId,
                role: 'assistant',
                content: 'Request cancelled.',
                timestamp: Date.now(),
            };
            await DatabaseService.addMessage(cancelledMsg);
            setLocalMessages(prev => [...prev, cancelledMsg]);
        }
        pushToolActivity('Done', 'thinking', 'done');
        setIsStreaming(false);
        streamingRef.current = false;
    };

    const sendMessage = async (text: string) => {
        if ((!text.trim() && attachments.length === 0) || isStreaming) return;

        let finalText = text;
        let useDeepSearch = false;
        let useWebSearch = false;
        let useImageGen = false;

        // 1. Prefer ref (set when user selected tool from menu) so we don't miss due to state timing
        const pending = pendingToolPrefsRef.current;
        if (pending) {
            if (pending.useDeepSearch) useDeepSearch = true;
            if (pending.useWebSearch) useWebSearch = true;
            if (pending.useImageGen) useImageGen = true;
            pendingToolPrefsRef.current = null;
        }
        // 2. Fallback to activeTool state (e.g. if ref was already consumed)
        if (!useDeepSearch && !useWebSearch && !useImageGen) {
            if (activeTool === 'Deep Research') useDeepSearch = true;
            else if (activeTool === 'Web Search') useWebSearch = true;
            else if (activeTool === 'Image Gen' || text.startsWith('/image ')) {
                useImageGen = true;
                if (text.startsWith('/image ')) finalText = text.replace('/image ', '');
            }
        }
        if (useImageGen && typeof finalText === 'string' && finalText.startsWith('/image ')) {
            finalText = finalText.replace('/image ', '');
        }

        // 3. Natural language: detect search intent when no tool was selected
        if (!useWebSearch && !useDeepSearch) {
            const trimmed = (typeof finalText === 'string' ? finalText : '').trim().toLowerCase();
            if (/^(search|look up|find out|google|web search|look for|find)\s+(for\s+)?(about\s+)?/i.test(trimmed) ||
                /\b(search|look up|google|find)\s+(for\s+)?(about\s+)?\w+/i.test(trimmed)) {
                useWebSearch = true;
            }
        }

        // Check if we have images
        const hasImages = attachments.some(a => a.type === 'image');
        let messageContent: string | any;

        if (hasImages) {
            // Use LLMService's vision provider configuration
            const visionProvider = LLMService.getVisionProvider();
            messageContent = await VisionService.formatMessage(finalText, attachments, visionProvider.id as LLMProviderId);
            console.log('[sendMessage] Sending multimodal message with', VisionService.countImages(messageContent), 'images using provider:', visionProvider.id);
        } else {
            // Sanitize user input to remove control characters and limit length
            messageContent = sanitizeInput(finalText, {
                maxLength: 50000, // Reasonable max length (50k chars)
                removeControlChars: true, // Remove null bytes, bell chars, etc.
                trim: true // Trim whitespace
            });
        }

        // Don't send if sanitization resulted in empty content and no attachments
        if (!messageContent && attachments.length === 0) {
            console.warn('[sendMessage] Empty message after sanitization, not sending');
            return;
        }

        // Create conversation if it doesn't exist
        const displayText = typeof messageContent === 'string' ? messageContent : VisionService.extractText(messageContent);
        if (!conversationCreated) {
            await DatabaseService.createConversation(localConversationId, displayText.trim() || 'Image', 'chat');
            setConversationCreated(true);
        } else {
            // Update conversation title to first message
            await DatabaseService.updateConversationTitle(localConversationId, displayText.trim() || 'Image');
        }

        const userMsg: Message = {
            id: uuidv4(),
            conversationId: localConversationId,
            role: 'user',
            content: messageContent,
            timestamp: Date.now(),
        };

        await DatabaseService.addMessage(userMsg);
        setLocalMessages(prev => [...prev, userMsg]);
        setInputText('');
        setAttachments([]); // Clear attachments after sending

        // Build history with system message for think mode
        let history = [...localMessages, userMsg];

        if (thinkMode) {
            // Add system message for think mode
            const thinkSystemMsg: Message = {
                id: `think_sys_${uuidv4()}`,
                conversationId: localConversationId,
                role: 'system',
                content: 'You are in Think Mode. Before answering, wrap your step-by-step reasoning in <think> tags, then provide your final answer. Be thorough and show your work.',
                timestamp: Date.now(),
            };
            history = [thinkSystemMsg, ...history];
        }

        // Clear active tool after sending
        setActiveTool(null);

        // Process with tool preferences
        clearToolActivity();
        pushToolActivity('Understanding your request...', 'thinking', 'start');
        await processConversationStep(history, undefined, {
            useDeepSearch,
            useWebSearch,
            useImageGen,
        });
    };

    const saveEdit = async (newContent: string) => {
        if (!editingMessage || newContent.trim() === editingMessage.content) {
            setEditModalVisible(false);
            return;
        }

        // Sanitize edited content
        const sanitizedContent = sanitizeInput(newContent, {
            maxLength: 50000,
            removeControlChars: true,
            trim: true
        });

        const updated = { ...editingMessage, content: sanitizedContent };
        setLocalMessages(prev => prev.map(msg => msg.id === editingMessage.id ? updated : msg));
        await DatabaseService.updateMessage(editingMessage.id, { content: sanitizedContent });

        setEditModalVisible(false);
        setEditingMessage(null);
    };

    const onRecordingStatusUpdate = useCallback((status: any) => {
        if (status.metering !== undefined) {
            setDictationLevel(status.metering);
        }
    }, []);

    const handleDictationStart = async () => {
        try {
            // Pre-check disponibilidad
            const check = await STTService.checkProviderAvailability();

            if (!check.available) {
                if (check.fallback) {
                    // Auto-switch al fallback
                    await STTService.switchProvider(check.fallback);
                    setErrorModal({
                        visible: true,
                        message: check.message || `Switched to ${check.fallback} provider`
                    });
                    // Intentar nuevamente con el nuevo provider
                } else {
                    setErrorModal({
                        visible: true,
                        message: check.message || 'Speech recognition not available'
                    });
                    return;
                }
            }

            setIsDictating(true);
            setDictationProvider(STTService.getProvider());
            setDictationStartedAt(Date.now());
            setDictationElapsedMs(0);
            STTService.addListener(onRecordingStatusUpdate);
            await STTService.startRecording();
        } catch (e: any) {
            console.error(e);
            setIsDictating(false);
            STTService.removeListener(onRecordingStatusUpdate);
            setDictationStartedAt(null);
            setDictationElapsedMs(0);

            // Mensaje específico según el error
            let errorMessage = 'Failed to start recording.';
            if (e.message?.includes('System Voice is not available')) {
                errorMessage = 'System speech unavailable. Try Expo Speech, Whisper Local, or API in Settings > Speech to Text.';
            } else if (e.message?.includes('expo-speech-recognition') || e.message?.includes('not available')) {
                errorMessage = 'Speech recognition module not available. Try Whisper Local or API in Settings > Speech to Text.';
            } else if (e.message?.includes('permission')) {
                errorMessage = 'Microphone permission denied. Please enable it in settings.';
            }

            setErrorModal({ visible: true, message: errorMessage });
        }
    };

    const handleDictationEnd = async () => {
        setIsDictating(false);
        setDictationLevel(-160);
        setDictationProvider(null);
        STTService.removeListener(onRecordingStatusUpdate);
        setDictationStartedAt(null);
        setDictationElapsedMs(0);

        try {
            const uri = await STTService.stopRecording();
            if (uri) {
                const text = await STTService.transcribe(uri);
                if (text) {
                    setInputText(prev => prev + (prev ? ' ' : '') + text);
                } else {
                    setErrorModal({ visible: true, message: 'No speech detected. Try again.' });
                }
            }
        } catch (e: any) {
            console.error('Dictation error', e);
            if (e.message !== 'Recording stopped') {
                setErrorModal({ visible: true, message: e.message || 'Dictation failed.' });
            }
        }
    };

    // Simulate meter for providers that don't expose audio levels (system/expo_speech)
    useEffect(() => {
        if (!isDictating) return;
        if (dictationProvider !== 'system' && dictationProvider !== 'expo_speech') return;
        const id = setInterval(() => {
            const level = -55 + Math.random() * 45; // -55 to -10 dB
            setDictationLevel(level);
        }, 120);
        return () => clearInterval(id);
    }, [isDictating, dictationProvider]);

    useEffect(() => {
        if (!isDictating || !dictationStartedAt) return;
        const id = setInterval(() => {
            setDictationElapsedMs(Date.now() - dictationStartedAt);
        }, 250);
        return () => clearInterval(id);
    }, [isDictating, dictationStartedAt]);

    // Helper to find parent user message ID for an assistant message
    const findParentUserMsgId = (assistantMsgId: string): string | null => {
        const msgIndex = localMessages.findIndex(m => m.id === assistantMsgId);
        if (msgIndex < 0) return null;

        // Look backwards to find the user message that triggered this response
        for (let i = msgIndex - 1; i >= 0; i--) {
            if (localMessages[i].role === 'user') {
                return localMessages[i].id;
            }
        }
        return null;
    };

    // Get display messages (with version support and tool grouping)
    // Split into multiple memoized stages for better performance
    const messageIds = useMemo(() =>
        localMessages.map(m => m.id).join(','),
        [localMessages]
    );

    // Stage 1: Build parent user lookup map (memoized separately)
    const parentUserMap = useMemo(() => {
        const map = new Map<number, string | null>();
        let lastUserMsgIndex = -1;

        for (let i = 0; i < localMessages.length; i++) {
            if (localMessages[i].role === 'user') {
                lastUserMsgIndex = i;
            }
            map.set(i, lastUserMsgIndex >= 0 ? localMessages[lastUserMsgIndex].id : null);
        }
        return map;
    }, [messageIds]); // Only rebuild when message IDs change

    // Stage 2: Resolve versions (memoized separately)
    const versionedMessages = useMemo(() => {
        return localMessages.map((msg, index) => {
            // Only assistant messages can have versions (regenerated responses)
            if (msg.role !== 'assistant') return msg;

            // Use the lookup map instead of scanning backwards
            const parentUserId = parentUserMap.get(index) || null;

            if (parentUserId) {
                const versionInfo = versionHistory[parentUserId];
                if (versionInfo && versionInfo.versions.length > 0) {
                    // Find the index of current message in versions
                    const currentInVersions = versionInfo.versions.findIndex(v => v.id === msg.id);
                    if (currentInVersions >= 0) {
                        // This message is part of version history, show the selected version
                        return versionInfo.versions[versionInfo.currentVersion];
                    }
                }
            }
            return msg;
        });
    }, [localMessages, messageIds, parentUserMap, versionHistory]);

    // Stage 3: Merge tool messages and filter empty messages (memoized separately)
    const displayMessages = useMemo(() => {
        // 2. Second pass: Merge tool messages with following assistant, hide clutter
        const result: Message[] = [];
        let i = 0;

        while (i < versionedMessages.length) {
            const msg = versionedMessages[i];

            // Case 1: Hide tool messages from chat bubbles (execution appears in live activity feed)
            if (msg.role === 'tool') {
                i++;
                continue;
            }

            // Case 2: Empty assistant message (no content, no tools, no thinking) - skip
            if (
                msg.role === 'assistant' &&
                isBlankContent(msg.content) &&
                !msg.metadata?.thinking &&
                !msg.metadata?.groupedToolResponses &&
                !msg.tool_calls
            ) {
                i++;
                continue;
            }

            // Case 3: Regular message - show it
            result.push(msg);
            i++;
        }

        return result;
    }, [versionedMessages]); // Only depends on versionedMessages, not original inputs

    const handleListScroll = useCallback((event: any) => {
        const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        autoScrollRef.current = distanceFromBottom < 120;
    }, []);

    const handleListScrollBegin = useCallback(() => {
        userScrollingRef.current = true;
    }, []);

    const handleListScrollEnd = useCallback(() => {
        userScrollingRef.current = false;
    }, []);

    const handleContentSizeChange = useCallback(() => {
        if (!autoScrollRef.current || userScrollingRef.current) return;
        const now = Date.now();
        if (now - lastAutoScrollAtRef.current < 150) return;
        lastAutoScrollAtRef.current = now;
        requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        });
    }, []);

    return (
        <Drawer
            visible={sidebarVisible}
            onClose={() => setSidebarVisible(false)}
            onOpen={() => setSidebarVisible(true)}
            drawerContent={
                <Sidebar
                    visible={sidebarVisible}
                    onClose={() => setSidebarVisible(false)}
                    navigation={navigation}
                />
            }
        >
            <View style={styles.container} className="bg-bg">
                <StatusBar style="dark" />

                {/* Background Task Notifications - REMOVED (too intrusive) */}

                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => setSidebarVisible(true)} style={styles.headerBtn}>
                        <Feather name="menu" size={22} color={theme.colors.textSecondary} />
                    </Pressable>
                    <View style={styles.modelContainer}>
                        <Text style={[styles.modelText, { color: theme.colors.text }]} numberOfLines={1}>
                            {currentModel}
                        </Text>
                        {/* Tools supported for all models via simulator */}
                    </View>
                    <Pressable
                        onPress={() => {
                            setLocalConversationId(`chat_${uuidv4()}`);
                            setLocalMessages([]);
                        }}
                        style={styles.headerBtn}
                    >
                        <Feather name="plus" size={22} color={theme.colors.textSecondary} />
                    </Pressable>
                </View>

                <View style={styles.keyboardContainer}>
                    {displayMessages.length === 0 ? (
                        <View style={styles.welcomeWrapper}>
                            <WelcomeScreen userName={userName} />
                        </View>
                    ) : (
                        <View style={styles.listContainer}>
                            <MemoizedMessageList
                                messages={displayMessages}
                                versionHistory={versionHistory}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onRegenerate={handleRegenerate}
                                onVersionChange={handleVersionChange}
                                onLinkPress={setActiveInAppUrl}
                                showReasoning={showReasoning}
                                flatListRef={flatListRef}
                                onScroll={handleListScroll}
                                onScrollBeginDrag={handleListScrollBegin}
                                onScrollEndDrag={handleListScrollEnd}
                                onContentSizeChange={handleContentSizeChange}
                            />
                            <ToolActivityFeed events={toolActivity} />
                            {isStreaming && !displayMessages.some(m => m.role === 'assistant' && m.metadata?.isStreaming) && (
                                <View style={styles.typingIndicator}>
                                    <Image
                                        source={require('../../assets/typing.gif')}
                                        style={styles.typingGif}
                                    />
                                    <Text style={[styles.typingLabel, { color: theme.colors.textSecondary }]}>
                                        Thinking…
                                    </Text>
                                </View>
                            )}
                            {/* Subtle bottom fade for input area */}
                            <LinearGradient
                                colors={[theme.colors.background + '00', theme.colors.background]}
                                style={styles.bottomFade}
                                pointerEvents="none"
                            />
                        </View>
                    )}

                    <KeyboardAvoidingView
                        style={styles.inputDock}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 12}
                    >
                        {/* Floating Input Container */}
                        <View style={styles.floatingInputContainer}>
                                {/* Active Tool Badge */}
                                {(activeTool || thinkMode) && (
                                    <View style={[styles.activeToolBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                                        <Feather name={thinkMode ? "cpu" : "zap"} size={14} color={theme.colors.primary} />
                                        <Text style={[styles.activeToolText, { color: theme.colors.primary }]}>
                                            {activeTool || 'Thinking Mode'} Active
                                        </Text>
                                        <Pressable onPress={() => {
                                            setActiveTool(null);
                                            setThinkMode(false);
                                        }}>
                                            <Feather name="x" size={14} color={theme.colors.primary} />
                                        </Pressable>
                                    </View>
                                )}

                                {/* Attachment Preview */}
                                <AttachmentPreview
                                    attachments={attachments}
                                    onRemove={handleRemoveAttachment}
                                />

                        {/* Vision Mode Indicator */}
                                {attachments.some(a => a.type === 'image') && visionMode && (
                                    <View style={[styles.visionBadge, { backgroundColor: theme.colors.success + '20' }]}>
                                        <Feather name="eye" size={14} color={theme.colors.success} />
                                        <Text style={[styles.visionBadgeText, { color: theme.colors.success }]}>
                                            Vision Mode - Describe image or extract text from photo
                                        </Text>
                                    </View>
                                )}

                        {/* Vision Mode Warning */}
                                {attachments.some(a => a.type === 'image') && !visionMode && (
                                    <View style={[styles.visionBadge, { backgroundColor: theme.colors.warning + '20' }]}>
                                        <Feather name="alert-circle" size={14} color={theme.colors.warning} />
                                        <Text style={[styles.visionBadgeText, { color: theme.colors.warning }]}>
                                            Current model doesn't support images
                                        </Text>
                                    </View>
                                )}

                                <ChatInput
                                    value={inputText}
                                    onChangeText={setInputText}
                                    onSend={() => sendMessage(inputText)}
                                    onCancel={() => {
                                        streamingRef.current = false;
                                        setIsStreaming(false);
                                        pushToolActivity('Cancelled by user', 'tool', 'error');
                                    }}
                                    disabled={isStreaming}
                                    isStreaming={isStreaming}
                                    onMenuPress={() => {
                                        Keyboard.dismiss();
                                        setMenuVisible(true);
                                    }}
                                    onDictationStart={handleDictationStart}
                                    onDictationEnd={handleDictationEnd}
                                    isDictating={isDictating}
                                />

                                <DictationOverlay
                                    visible={isDictating}
                                    level={dictationLevel}
                                    provider={dictationProvider || undefined}
                                    elapsedMs={dictationElapsedMs}
                                />

                        {/* Active Mini-Apps */}
                                {activeMiniApp === 'quiz' && (
                                    <QuizMiniApp
                                        visible={true}
                                        onClose={() => setActiveMiniApp(null)}
                                        onShareToChat={(result) => {
                                            // Add result to chat
                                            const userMsg: Message = {
                                                id: uuidv4(),
                                                conversationId: localConversationId,
                                                role: 'user',
                                                content: result.content,
                                                timestamp: Date.now(),
                                            };
                                            setLocalMessages(prev => [...prev, userMsg]);
                                            DatabaseService.addMessage(userMsg);
                                            setActiveMiniApp(null);
                                        }}
                                        deviceTier={deviceTier}
                                        preferredMode={'auto' as MiniAppMode}
                                        isOnline={isOnline}
                                        conversationId={localConversationId}
                                        messages={localMessages}
                                    />
                                )}

                                {/* Deep Research MiniApp removed - now uses chat-based flow */}
                        </View>
                    </KeyboardAvoidingView>
                </View>

                {/* Mini-app Menu (mounted at screen level to fully block underlying chat touches) */}
                <ChatInputMenu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    onSelect={(appId) => {
                        setMenuVisible(false);
                        handleToolSelect(appId);
                    }}
                    deviceTier={deviceTier}
                    isOnline={isOnline}
                />

                <BrowserBubble
                    url={activeInAppUrl}
                    onClose={() => setActiveInAppUrl(null)}
                />

                <ErrorModal
                    visible={errorModal.visible}
                    message={errorModal.message}
                    onDismiss={() => setErrorModal({ visible: false, message: '' })}
                />

                <EditMessageModal
                    visible={editModalVisible}
                    initialContent={typeof editingMessage?.content === 'string' ? editingMessage.content : ''}
                    onSave={saveEdit}
                    onCancel={() => { setEditModalVisible(false); setEditingMessage(null); }}
                />
            </View>
        </Drawer>
    );
};

// Extracted MessageItem component for better memoization
interface MessageItemProps {
    item: Message;
    index: number;
    messages: Message[];
    versionHistory: VersionHistory;
    onEdit: (msg: Message) => void;
    onDelete: (id: string) => void;
    onRegenerate: (id: string) => void;
    onVersionChange: (parentId: string, version: number) => void;
    onLinkPress: (url: string) => void;
    showReasoning: boolean;
}

const MessageItem: React.FC<MessageItemProps> = memo(({
    item,
    index,
    messages,
    versionHistory,
    onEdit,
    onDelete,
    onRegenerate,
    onVersionChange,
    onLinkPress,
    showReasoning,
}) => {
    let msgVersionHistory = undefined;
    let versionKey: string | undefined = undefined;

    if (item.role === 'assistant') {
        for (const [parentId, vh] of Object.entries(versionHistory)) {
            if (vh.versions.some(v => v.id === item.id)) {
                msgVersionHistory = vh;
                versionKey = parentId;
                break;
            }
        }
        if (!versionKey && index > 0) {
            for (let i = index - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    const parentId = messages[i].id;
                    if (versionHistory[parentId]) {
                        msgVersionHistory = versionHistory[parentId];
                        versionKey = parentId;
                    }
                    break;
                }
            }
        }
    }

    return (
        <MemoizedMessageBubble
            message={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            onVersionChange={onVersionChange}
            versionHistory={msgVersionHistory}
            versionHistoryKey={versionKey}
            onLinkPress={onLinkPress}
            showReasoning={showReasoning}
        />
    );
});

// Memoized FlatList component
interface MessageListProps {
    messages: Message[];
    versionHistory: VersionHistory;
    onEdit: (msg: Message) => void;
    onDelete: (id: string) => void;
    onRegenerate: (id: string) => void;
    onVersionChange: (parentId: string, version: number) => void;
    onLinkPress: (url: string | null) => void;
    showReasoning: boolean;
    flatListRef: React.RefObject<FlatList | null>;
    onScroll: (event: any) => void;
    onScrollBeginDrag: () => void;
    onScrollEndDrag: () => void;
    onContentSizeChange: () => void;
}

const MemoizedMessageList: React.FC<MessageListProps> = memo(({
    messages,
    versionHistory,
    onEdit,
    onDelete,
    onRegenerate,
    onVersionChange,
    onLinkPress,
    showReasoning,
    flatListRef,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onContentSizeChange,
}) => {
    const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => (
        <MessageItem
            item={item}
            index={index}
            messages={messages}
            versionHistory={versionHistory}
            onEdit={onEdit}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            onVersionChange={onVersionChange}
            onLinkPress={(url) => onLinkPress(url)}
            showReasoning={showReasoning}
        />
    ), [messages, versionHistory, onEdit, onDelete, onRegenerate, onVersionChange, onLinkPress, showReasoning]);

    const keyExtractor = useCallback((item: Message, index: number) => item.id, []);

    return (
        <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            // Performance optimizations for large chat histories
            initialNumToRender={10}           // Render 10 items initially (good balance)
            maxToRenderPerBatch={5}            // Render 5 at a time during scroll (reduced from 10)
            windowSize={5}                     // Keep 5 pages worth of items in memory (reduced from 10)
            removeClippedSubviews={true}        // Remove off-screen views from native hierarchy
            onScroll={onScroll}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onContentSizeChange={onContentSizeChange}
            scrollEventThrottle={16}
            // Additional optimizations for 2025
            updateCellsBatchingPeriod={50}      // Batch updates every 50ms (smoother scrolling)
            legacyImplementation={false}        // Use new implementation (better performance)
            onEndReachedThreshold={0.5}         // Trigger earlier for smoother infinite scroll
        />
    );
});

const styles = StyleSheet.create({
    container: { flex: 1 },
    welcomeWrapper: {
        flex: 1,
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modelText: {
        fontSize: 15,
        fontWeight: '600',
        maxWidth: 180,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '500',
    },
    keyboardContainer: { flex: 1 },
    listContainer: { flex: 1, position: 'relative' },
    messageList: { paddingVertical: 16, paddingBottom: 40 },

    floatingInputContainer: {
        paddingHorizontal: 8,
        paddingBottom: Platform.OS === 'ios' ? 20 : 16,
        paddingTop: 4,
        backgroundColor: 'transparent',
        zIndex: 10,
    },
    bottomFade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        zIndex: 0,
    },
    activeToolBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 8,
        alignSelf: 'center',
    },
    activeToolText: {
        fontSize: 13,
        fontWeight: '600',
    },
    ragBanner: {
        marginBottom: 8,
        marginHorizontal: 12,
    },
    ragChips: {
        flexDirection: 'row',
        gap: 8,
    },
    ragBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    ragBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        alignSelf: 'flex-start',
        marginTop: 6,
    },
    typingGif: {
        width: 36,
        height: 36,
        resizeMode: 'contain',
    },
    typingLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    ragClose: {
        padding: 2,
    },
    visionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 8,
        alignSelf: 'center',
    },
    visionBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
});

export default NormalChatScreen;
