/**
 * Search Screen
 * Research/deep search with clean white interface
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    StatusBar,
    Pressable,
    ScrollView,
    Platform,
    Animated,
    Easing,
    Keyboard,
    FlatList,
    Dimensions,
    KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatabaseService } from '../services/DatabaseService';
import { ToolRegistry } from '../services/tools/ToolRegistry';
import { LLMService } from '../services/llm/LLMService';
import { ConfigService } from '../services/ConfigService';
import { SourcesPanel } from '../components/molecules/SourcesPanel';
import { RelatedQuestions } from '../components/molecules/RelatedQuestions';
import { AnswerView } from '../components/molecules/AnswerView';
import { Sidebar } from '../components/organisms/Sidebar';
import { Drawer } from '../components/organisms/Drawer';
import { useTheme } from '../context/ThemeContext';
import { ReportPreviewCard } from '../components/molecules/ReportPreviewCard';
import { ReportViewerModal } from '../components/organisms/ReportViewerModal';
import { generateMarkdownReport } from '../services/ReportService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Focus modes
const FOCUS_MODES = [
    { id: 'all', label: 'All', icon: 'globe', color: '#3B82F6' },
    { id: 'academic', label: 'Academic', icon: 'book-open', color: '#7C3AED' },
    { id: 'writing', label: 'Writing', icon: 'edit-3', color: '#F59E0B' },
    { id: 'video', label: 'Video', icon: 'play-circle', color: '#EF4444' },
    { id: 'social', label: 'Social', icon: 'message-circle', color: '#10B981' },
] as const;

// Complexity levels for research depth
const COMPLEXITY_LEVELS = [
    { id: 'quick', label: 'Quick', sources: 2, depth: 'basic', icon: 'zap', description: '2 sources, basic scrape' },
    { id: 'standard', label: 'Standard', sources: 4, depth: 'normal', icon: 'search', description: '4 sources, normal depth' },
    { id: 'deep', label: 'Deep Research', sources: 8, depth: 'thorough', icon: 'layers', description: '8 sources, thorough analysis' },
    { id: 'exhaustive', label: 'Exhaustive', sources: 15, depth: 'comprehensive', icon: 'database', description: '15 sources, comprehensive' },
] as const;

// Trending suggestions - Generic, timeless topics
const SUGGESTIONS = [
    { icon: 'trending-up', text: 'Latest technology trends', color: '#3B82F6' },
    { icon: 'book-open', text: 'How to learn programming', color: '#8B5CF6' },
    { icon: 'zap', text: 'Renewable energy sources', color: '#F59E0B' },
    { icon: 'globe', text: 'Space exploration missions', color: '#10B981' },
    { icon: 'heart', text: 'Mental health tips', color: '#EF4444' },
    { icon: 'dollar-sign', text: 'Personal finance basics', color: '#14B8A6' },
];

/* Types */
interface SearchMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: any[];
    relatedQuestions?: string[];
    isThinking?: boolean;
    thinking?: string;
}

export const SearchHomeScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();

    const [conversationId, setConversationId] = useState<string | null>(route.params?.conversationId || null);
    const [messages, setMessages] = useState<SearchMessage[]>([]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [focusMode, setFocusMode] = useState<string>('all');
    const [complexityLevel, setComplexityLevel] = useState<string>('standard');
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const hasScrolledForStream = useRef<boolean>(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Report generation state
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportContent, setReportContent] = useState('');
    const [reportTitle, setReportTitle] = useState('');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const reportAbortController = useRef<AbortController | null>(null);

    // Animations
    const logoAnim = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const inputAnim = useRef(new Animated.Value(0)).current;
    const suggestionsAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (route.params?.conversationId) {
            setConversationId(route.params.conversationId);
            loadConversation(route.params.conversationId);
        } else {
            setConversationId(null);
            setMessages([]);
            animateEntry();
        }
    }, [route.params?.conversationId]);

    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
            if (Platform.OS === 'android') {
                setKeyboardHeight(e.endCoordinates?.height || 0);
            }
        });
        const hideSub = Keyboard.addListener('keyboardDidHide', () => {
            if (Platform.OS === 'android') {
                setKeyboardHeight(0);
            }
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const animateEntry = () => {
        logoAnim.setValue(0);
        titleAnim.setValue(0);
        inputAnim.setValue(0);
        suggestionsAnim.setValue(0);

        Animated.stagger(120, [
            Animated.spring(logoAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
            Animated.spring(titleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
            Animated.spring(inputAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
            Animated.spring(suggestionsAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();
    };

    const loadConversation = async (id: string) => {
        const dbMessages = await DatabaseService.getMessages(id);
        const formatted: SearchMessage[] = dbMessages.map((m: any) => ({
            id: m.id, role: m.role, content: m.content,
            sources: m.metadata?.sources, relatedQuestions: m.metadata?.relatedQuestions,
            thinking: m.metadata?.thinking
        }));
        setMessages(formatted);
    };

    const handleSearch = async (text: string) => {
        if (!text.trim()) return;
        Keyboard.dismiss();
        setQuery('');

        let currentConvId = conversationId;

        if (!currentConvId) {
            currentConvId = `search_${Date.now()}`;
            setConversationId(currentConvId);
            await DatabaseService.createConversation(currentConvId, text.trim(), 'search');
        }

        const userMsgId = `msg_${Date.now()}_u`;
        setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: text.trim() }]);
        setIsLoading(true);
        
        // Create abort controller for this search
        abortControllerRef.current = new AbortController();

        await DatabaseService.addMessage({
            id: userMsgId, conversationId: currentConvId, role: 'user',
            content: text.trim(), timestamp: Date.now()
        });

        const assistantMsgId = `msg_${Date.now()}_a`;
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', isThinking: true, thinking: 'Searching the web...' }]);

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            // Ensure config is loaded before making LLM calls
            await ConfigService.loadSettings();
            
            const deepSearchTool = ToolRegistry.getTool('deep_search');
            let searchContext = '', sources: any[] = [], wiki: any = null;

            if (deepSearchTool) {
                // Get complexity settings
                const complexity = COMPLEXITY_LEVELS.find(c => c.id === complexityLevel) || COMPLEXITY_LEVELS[1];
                const searchRes = await deepSearchTool.execute({
                    query: text, 
                    num_sources: complexity.sources,
                    depth: complexity.depth,
                    onProgress: (status: string) => {
                        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, thinking: status } : m));
                    }
                });
                if (searchRes.type !== 'error') {
                    sources = searchRes.data.sources || [];
                    wiki = searchRes.data.wiki;
                    searchContext = sources.map((s: any, i: number) => `[${i + 1}] ${s.title}: ${s.snippet}`).join('\n\n');
                    if (wiki) searchContext += `\n\n[Wiki] ${wiki.title}: ${wiki.summary}`;
                }
            }

            console.log('[Search] Sources found:', sources.length);
            console.log('[Search] Search context length:', searchContext.length);

            if (sources.length === 0) {
                setMessages(prev => prev.map(m => m.id === assistantMsgId 
                    ? { ...m, content: 'No search results found. Please try a different query.', isThinking: false } 
                    : m
                ));
                setIsLoading(false);
                return;
            }

            setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, thinking: 'Synthesizing answer...', sources } : m));

            // Check LLM config
            const llmConfig = LLMService.getConfig();
            console.log('[Search] LLM Config:', { provider: llmConfig.provider, model: llmConfig.model, hasApiKey: !!llmConfig.apiKey });

            if (!llmConfig.apiKey && llmConfig.provider !== 'llama_rn') {
                setMessages(prev => prev.map(m => m.id === assistantMsgId 
                    ? { ...m, content: 'Please configure your API key in Settings to get AI-generated summaries.', isThinking: false } 
                    : m
                ));
                setIsLoading(false);
                return;
            }

            const systemPrompt = `You are a research assistant. Answer based on the sources. Use citations [1], [2].\nSources:\n${searchContext}`;
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            history.push({ role: 'user', content: text });

            console.log('[Search] Starting LLM stream...');
            const stream = LLMService.streamChat([{ role: 'system', content: systemPrompt }, ...history] as any, {});

            let fullAnswer = '', fullThinking = '';
            let lastUpdate = 0;
            const THROTTLE_MS = 100;
            let chunkCount = 0;

            for await (const chunk of stream) {
                // Check if search was cancelled
                if (abortControllerRef.current?.signal.aborted) {
                    console.log('[Search] Search cancelled by user');
                    break;
                }
                
                chunkCount++;
                if (chunk.content) {
                    if (chunk.content.includes('<think>')) {
                        fullThinking += chunk.content.replace(/<\/?think>/g, '');
                    } else {
                        fullAnswer += chunk.content.replace(/<\/?think>/g, '');
                    }

                    const now = Date.now();
                    if (now - lastUpdate > THROTTLE_MS) {
                        setMessages(prev => prev.map(m => m.id === assistantMsgId
                            ? { ...m, content: fullAnswer, thinking: fullThinking, sources, isThinking: false }
                            : m
                        ));
                        lastUpdate = now;
                    }
                }
            }

            console.log('[Search] Stream complete. Chunks:', chunkCount, 'Answer length:', fullAnswer.length);

            // If no content was generated, show a message with the sources
            if (!fullAnswer.trim()) {
                fullAnswer = 'I found the following sources for your query. Please check them out:\n\n' + 
                    sources.map((s: any, i: number) => `${i + 1}. [${s.title}](${s.url})`).join('\n');
            }

            setMessages(prev => prev.map(m => m.id === assistantMsgId
                ? { ...m, content: fullAnswer, thinking: fullThinking, sources, isThinking: false }
                : m
            ));

            await DatabaseService.addMessage({
                id: assistantMsgId, conversationId: currentConvId, role: 'assistant',
                content: fullAnswer, timestamp: Date.now(),
                metadata: { sources, wiki, thinking: fullThinking }
            });

            // Generate related questions only if we have a meaningful answer
            if (fullAnswer.length > 50) {
                try {
                    const suggestionPrompt = `Based on the answer below, suggest 3 short follow-up questions.\nAnswer: ${fullAnswer.substring(0, 500)}...\nOutput: JSON array of strings. ONLY output JSON.`;
                    const raw = await LLMService.generateResponse([{ role: 'user', content: suggestionPrompt } as any], {});
                    const match = raw.match(/\[.*\]/s);
                    if (match) {
                        const suggestions = JSON.parse(match[0]);
                        if (Array.isArray(suggestions) && suggestions.length > 0) {
                            setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, relatedQuestions: suggestions } : m));
                            await DatabaseService.updateMessage(assistantMsgId, {
                                metadata: { sources, wiki, thinking: fullThinking, relatedQuestions: suggestions }
                            });
                        }
                    }
                } catch (e) { console.log('Suggestions failed', e); }
            }

        } catch (e: any) {
            console.error('[Search] Error:', e);
            setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
                ...m, 
                content: `Error performing search: ${e.message || 'Unknown error'}`, 
                isThinking: false 
            } : m));
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    // Cancel ongoing search
    const handleCancelSearch = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
    };

    // Report generation handler
    const handleGenerateReport = async () => {
        if (!conversationId) return;

        setIsGeneratingReport(true);
        setReportModalVisible(true);

        try {
            const report = await generateMarkdownReport(conversationId, {
                includeThinking: false,
                includeFullSources: false,
                includeDiagrams: true,
            });

            setReportContent(report);
            const firstQuery = messages.find(m => m.role === 'user')?.content || 'Research Report';
            setReportTitle(firstQuery.length > 50 ? firstQuery.substring(0, 50) + '...' : firstQuery);
        } catch (error) {
            console.error('Error generating report:', error);
            setReportContent('# Error\n\nFailed to generate report. Please try again.');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const renderItem = ({ item, index }: { item: SearchMessage; index: number }) => {
        if (item.role === 'user') {
            return (
                <Animated.View style={styles.userMessageContainer}>
                    <View style={[styles.userMessage, { backgroundColor: theme.colors.userBubble }]}>
                        <Text style={[styles.userMessageText, { color: theme.colors.text }]}>{item.content}</Text>
                    </View>
                </Animated.View>
            );
        }

        return (
            <View style={styles.assistantMessage}>
                {item.isThinking && (
                    <View style={[styles.thinkingContainer, { backgroundColor: theme.colors.surfaceHighlight, borderColor: theme.colors.border }]}>
                        <View style={styles.thinkingDots}>
                            {[0, 1, 2].map(i => (
                                <Animated.View key={i} style={[styles.thinkingDot, {
                                    backgroundColor: theme.colors.primary,
                                    opacity: pulseAnim.interpolate({
                                        inputRange: [0, 0.5, 1],
                                        outputRange: i === 0 ? [0.3, 1, 0.3] : i === 1 ? [0.5, 0.3, 1] : [1, 0.5, 0.3]
                                    })
                                }]} />
                            ))}
                        </View>
                        <Text style={[styles.thinkingText, { color: theme.colors.textSecondary }]}>{item.thinking}</Text>
                    </View>
                )}

                {item.sources && item.sources.length > 0 && !item.isThinking && (
                    <SourcesPanel
                        sources={item.sources.map((s: any, i: number) => ({
                            id: i + 1, title: s.title,
                            domain: new URL(s.url || 'http://x').hostname,
                            url: s.url, snippet: s.snippet || s.content?.substring(0, 100) || ''
                        }))}
                        expanded={true}
                        onToggle={() => { }}
                        onSourcePress={(s) => navigation.navigate('Browser', { url: s.url, title: s.title })}
                    />
                )}

                {!item.isThinking && (
                    <AnswerView
                        content={item.content}
                        thinking={item.thinking || ''}
                        isStreaming={false}
                        sources={item.sources || []}
                        onCitationPress={(id) => {
                            const s = item.sources?.[id - 1];
                            if (s) navigation.navigate('Browser', { url: s.url, title: s.title });
                        }}
                    />
                )}

                {item.relatedQuestions && item.relatedQuestions.length > 0 && (
                    <RelatedQuestions questions={item.relatedQuestions} onPress={handleSearch} />
                )}
            </View>
        );
    };

    // ========== HOME VIEW ==========
    if (messages.length === 0 && !isLoading) {
        const logoScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

        return (
            <Drawer
                visible={sidebarVisible}
                onClose={() => setSidebarVisible(false)}
                onOpen={() => setSidebarVisible(true)}
                drawerContent={
                    <Sidebar
                        visible={true}
                        onClose={() => setSidebarVisible(false)}
                        navigation={navigation}
                    />
                }
            >
                <KeyboardAvoidingView
                    style={[styles.container, { backgroundColor: theme.colors.background }]}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

                    {/* Minimal Header */}
                    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                        <Pressable onPress={() => setSidebarVisible(true)} style={styles.headerBtn}>
                            <Feather name="menu" size={22} color={theme.colors.textSecondary} />
                        </Pressable>
                        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Research</Text>
                        <View style={{ width: 36 }} />
                    </View>

                    <ScrollView
                        contentContainerStyle={[styles.centerContainer, { paddingTop: 40 }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                    {/* Animated Logo */}
                    <Animated.View style={{
                        opacity: logoAnim,
                        transform: [
                            { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                            { scale: logoScale }
                        ]
                    }}>
                        <View style={[styles.logoContainer, { backgroundColor: `${theme.colors.primary}10`, borderColor: `${theme.colors.primary}30` }]}>
                            <Feather name="search" size={36} color={theme.colors.primary} />
                        </View>
                    </Animated.View>

                    {/* Title */}
                    <Animated.View style={{
                        opacity: titleAnim,
                        transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                    }}>
                        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Where knowledge{'\n'}begins</Text>
                        <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
                            Ask anything, get instant answers with sources
                        </Text>
                    </Animated.View>

                    {/* Search Input */}
                    <Animated.View style={{
                        width: '100%',
                        opacity: inputAnim,
                        transform: [{ translateY: inputAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                    }}>
                        <View style={[styles.inputWrapper, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                            <Feather name="search" size={20} color={theme.colors.textTertiary} style={{ marginLeft: 16 }} />
                            <TextInput
                                style={[styles.mainInput, { color: theme.colors.text }]}
                                placeholder="Ask anything..."
                                placeholderTextColor={theme.colors.textTertiary}
                                value={query}
                                onChangeText={setQuery}
                                onSubmitEditing={() => handleSearch(query)}
                                autoFocus={false}
                                returnKeyType="search"
                            />
                            <Pressable
                                style={[styles.searchBtn, { backgroundColor: query.trim() ? theme.colors.primary : theme.colors.surfaceHighlight }]}
                                onPress={() => handleSearch(query)}
                            >
                                <Feather name="arrow-right" size={20} color={query.trim() ? '#FFF' : theme.colors.textTertiary} />
                            </Pressable>
                        </View>

                        {/* Focus Modes */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.focusList} contentContainerStyle={{ paddingRight: 16 }}>
                            {FOCUS_MODES.map(m => (
                                <Pressable
                                    key={m.id}
                                    style={[
                                        styles.focusChip,
                                        {
                                            backgroundColor: focusMode === m.id ? `${m.color}15` : theme.colors.inputBg,
                                            borderColor: focusMode === m.id ? `${m.color}40` : theme.colors.border,
                                        }
                                    ]}
                                    onPress={() => setFocusMode(m.id)}
                                >
                                    <Feather name={m.icon as any} size={14} color={focusMode === m.id ? m.color : theme.colors.textSecondary} />
                                    <Text style={[styles.focusText, { color: focusMode === m.id ? m.color : theme.colors.textSecondary }]}>{m.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        {/* Complexity Levels */}
                        <View style={styles.complexityContainer}>
                            <Text style={[styles.complexityLabel, { color: theme.colors.textSecondary }]}>Research Depth</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.complexityList} contentContainerStyle={{ paddingRight: 16 }}>
                                {COMPLEXITY_LEVELS.map(c => (
                                    <Pressable
                                        key={c.id}
                                        style={[
                                            styles.complexityChip,
                                            {
                                                backgroundColor: complexityLevel === c.id ? theme.colors.primary + '15' : theme.colors.inputBg,
                                                borderColor: complexityLevel === c.id ? theme.colors.primary + '40' : theme.colors.border,
                                            }
                                        ]}
                                        onPress={() => setComplexityLevel(c.id)}
                                    >
                                        <Feather name={c.icon as any} size={12} color={complexityLevel === c.id ? theme.colors.primary : theme.colors.textSecondary} />
                                        <View style={styles.complexityTextContainer}>
                                            <Text style={[styles.complexityText, { color: complexityLevel === c.id ? theme.colors.primary : theme.colors.textSecondary }]}>{c.label}</Text>
                                            <Text style={[styles.complexityDesc, { color: theme.colors.textTertiary }]} numberOfLines={1}>{c.description}</Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </Animated.View>

                    {/* Suggestions */}
                    <Animated.View style={{
                        width: '100%',
                        opacity: suggestionsAnim,
                        transform: [{ translateY: suggestionsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                    }}>
                        <Text style={[styles.suggestionsTitle, { color: theme.colors.textSecondary }]}>Try asking about</Text>
                        <View style={styles.suggestionsGrid}>
                            {SUGGESTIONS.map((s, i) => (
                                <Pressable
                                    key={i}
                                    style={[styles.suggestionCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                                    onPress={() => handleSearch(s.text)}
                                >
                                    <View style={[styles.suggestionIcon, { backgroundColor: `${s.color}10` }]}>
                                        <Feather name={s.icon as any} size={16} color={s.color} />
                                    </View>
                                    <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={2}>{s.text}</Text>
                                    <Feather name="arrow-up-right" size={14} color={theme.colors.textTertiary} />
                                </Pressable>
                            ))}
                        </View>
                    </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Drawer>
        );
    }

    // ========== RESULTS VIEW ==========
    return (
        <Drawer
            visible={sidebarVisible}
            onClose={() => setSidebarVisible(false)}
            onOpen={() => setSidebarVisible(true)}
            drawerContent={
                <Sidebar
                    visible={true}
                    onClose={() => setSidebarVisible(false)}
                    navigation={navigation}
                />
            }
        >
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: theme.colors.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

                {/* Header */}
                <View style={[styles.resultsHeader, { paddingTop: insets.top + 8, borderBottomColor: theme.colors.border }]}>
                    <Pressable onPress={() => {
                        setMessages([]);
                        setConversationId(null);
                        navigation.setParams({ conversationId: null });
                        animateEntry();
                    }} style={styles.headerBtn}>
                        <Feather name="arrow-left" size={22} color={theme.colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{messages[0]?.content || "Search"}</Text>
                    <Pressable onPress={() => { setMessages([]); setConversationId(null); animateEntry(); }} style={styles.headerBtn}>
                        <Feather name="plus" size={22} color={theme.colors.text} />
                    </Pressable>
                </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={[styles.listContent, { paddingBottom: 180 }]}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                    if (isLoading) {
                        if (!hasScrolledForStream.current) {
                            flatListRef.current?.scrollToEnd({ animated: false });
                            hasScrolledForStream.current = true;
                        }
                    } else {
                        hasScrolledForStream.current = false;
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }
                }}
                removeClippedSubviews={false}
                maxToRenderPerBatch={5}
                windowSize={7}
                initialNumToRender={10}
                updateCellsBatchingPeriod={100}
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            />

            {/* Bottom Input */}
            <View style={[styles.bottomBar, {
                paddingBottom: insets.bottom + 12 + (Platform.OS === 'android' ? keyboardHeight : 0),
                backgroundColor: 'transparent',
                borderTopColor: theme.colors.borderLight,
            }]}>
                {/* Report Preview Card - shown when conversation has messages */}
                {messages.length > 0 && (
                    <View style={{ paddingHorizontal: 16 }}>
                        <ReportPreviewCard
                            queryCount={messages.filter(m => m.role === 'user').length}
                            sourceCount={messages.reduce((acc, m) => acc + (m.sources?.length || 0), 0)}
                            onExpand={handleGenerateReport}
                        />
                    </View>
                )}
                <View style={[styles.bottomInputWrapper, { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.border }]}>
                    {isLoading ? (
                        <Pressable
                            style={[styles.cancelBtn, { borderColor: theme.colors.error }]}
                            onPress={handleCancelSearch}
                        >
                            <Feather name="x" size={18} color={theme.colors.error} />
                            <Text style={[styles.cancelBtnText, { color: theme.colors.error }]}>Cancel</Text>
                        </Pressable>
                    ) : (
                        <>
                            <TextInput
                                style={[styles.bottomInput, { color: theme.colors.text }]}
                                placeholder="Ask follow-up..."
                                placeholderTextColor={theme.colors.textTertiary}
                                value={query}
                                onChangeText={setQuery}
                                onSubmitEditing={() => handleSearch(query)}
                                returnKeyType="search"
                            />
                            <Pressable
                                style={[styles.bottomSendBtn, { backgroundColor: query.trim() ? theme.colors.primary : theme.colors.surfaceHighlight }]}
                                onPress={() => handleSearch(query)}
                            >
                                <Feather name="arrow-up" size={18} color={query.trim() ? '#FFF' : theme.colors.textTertiary} />
                            </Pressable>
                        </>
                    )}
                </View>
            </View>
            </KeyboardAvoidingView>

            {/* Report Viewer Modal */}
            <ReportViewerModal
                isVisible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                content={reportContent}
                title={reportTitle}
                isLoading={isGeneratingReport}
            />
        </Drawer>
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
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    centerContainer: { 
        flexGrow: 1, 
        padding: 24, 
        paddingBottom: 100, 
        alignItems: 'center' 
    },
    logoContainer: {
        width: 80, 
        height: 80, 
        borderRadius: 24,
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: 32, 
        overflow: 'hidden',
        borderWidth: 1,
    },
    heroTitle: {
        fontSize: 32, 
        fontWeight: '700',
        textAlign: 'center', 
        marginBottom: 12, 
        lineHeight: 40
    },
    heroSubtitle: {
        fontSize: 15, 
        textAlign: 'center', 
        marginBottom: 40
    },
    inputWrapper: {
        flexDirection: 'row', 
        alignItems: 'center',
        borderRadius: 24, 
        padding: 6, 
        borderWidth: 1,
        overflow: 'hidden'
    },
    mainInput: { 
        flex: 1, 
        fontSize: 17, 
        paddingHorizontal: 12, 
        paddingVertical: 14 
    },
    searchBtn: {
        width: 44, 
        height: 44, 
        borderRadius: 18,
        justifyContent: 'center', 
        alignItems: 'center'
    },
    focusList: { 
        marginTop: 16, 
        flexGrow: 0 
    },
    focusChip: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 14, 
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10, 
        gap: 8,
    },
    focusText: { 
        fontSize: 14, 
        fontWeight: '500' 
    },
    complexityContainer: {
        marginTop: 12,
    },
    complexityLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    complexityList: {
        flexGrow: 0,
    },
    complexityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 8,
        gap: 8,
        minWidth: 140,
    },
    complexityTextContainer: {
        flex: 1,
    },
    complexityText: {
        fontSize: 13,
        fontWeight: '600',
    },
    complexityDesc: {
        fontSize: 10,
        marginTop: 2,
    },
    suggestionsTitle: {
        fontSize: 13, 
        fontWeight: '600',
        marginTop: 40, 
        marginBottom: 16, 
        alignSelf: 'flex-start',
        textTransform: 'uppercase', 
        letterSpacing: 0.5
    },
    suggestionsGrid: { 
        width: '100%', 
        gap: 10 
    },
    suggestionCard: {
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 12,
        borderRadius: 12, 
        padding: 14,
        borderWidth: 1,
    },
    suggestionIcon: {
        width: 36, 
        height: 36, 
        borderRadius: 10,
        justifyContent: 'center', 
        alignItems: 'center'
    },
    suggestionText: { 
        flex: 1, 
        fontSize: 14 
    },
    resultsHeader: {
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingHorizontal: 12, 
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    listContent: { 
        padding: 16, 
        paddingBottom: 120 
    },
    userMessageContainer: { 
        alignSelf: 'flex-end', 
        marginBottom: 24, 
        maxWidth: '85%' 
    },
    userMessage: { 
        borderRadius: 20, 
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    userMessageText: { 
        fontSize: 16, 
        lineHeight: 22 
    },
    assistantMessage: { 
        marginBottom: 32 
    },
    thinkingContainer: {
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10,
        borderRadius: 12, 
        padding: 14,
        borderWidth: 1, 
        marginBottom: 16
    },
    thinkingDots: { 
        flexDirection: 'row', 
        gap: 4 
    },
    thinkingDot: { 
        width: 6, 
        height: 6, 
        borderRadius: 3, 
    },
    thinkingText: { 
        fontSize: 14 
    },
    bottomBar: {
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0,
        paddingHorizontal: 16, 
        paddingTop: 12,
        borderTopWidth: 1,
    },
    bottomInputWrapper: {
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10,
        borderRadius: 24, 
        padding: 6,
        borderWidth: 1,
    },
    bottomInput: {
        flex: 1, 
        height: 40, 
        paddingHorizontal: 16, 
        fontSize: 15
    },
    bottomSendBtn: {
        width: 36, 
        height: 36, 
        borderRadius: 18,
        justifyContent: 'center', 
        alignItems: 'center'
    },
    cancelBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        marginHorizontal: 8,
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
