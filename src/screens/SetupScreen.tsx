/**
 * First-time setup screen
 * Skippable only on first launch
 */

import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipSelector, CompactInput, CompactSwitch, SettingsSection } from '../components/molecules/SettingsComponents';
import { LOCAL_INFERENCE_ENABLED } from '../config/localInference';
import { LLMService } from '../services/llm/LLMService';
import { Button, Screen } from '../ui';

type ProviderKey = 'openai' | 'openrouter' | 'groq' | 'mistral' | 'deepseek' | 'local' | 'llama_rn';

const PROVIDERS: Record<ProviderKey, { name: string; baseUrl: string; defaultModel: string }> = {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-pro-1.5' },
    groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama3-70b-8192' },
    mistral: { name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-large-latest' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
    local: { name: 'Local (Ollama/LMStudio)', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' },
    llama_rn: { name: 'Local GGUF (On-Device)', baseUrl: '', defaultModel: '' },
};

export const SetupScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const providerOptions = useMemo(() => {
        const base = ['openai', 'openrouter', 'groq', 'mistral', 'deepseek'] as ProviderKey[];
        if (LOCAL_INFERENCE_ENABLED.LLM) {
            base.push('local', 'llama_rn');
        }
        return base;
    }, []);

    const [provider, setProvider] = useState<ProviderKey>('openai');
    const [baseUrl, setBaseUrl] = useState(PROVIDERS.openai.baseUrl);
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState(PROVIDERS.openai.defaultModel);
    const [useGpsForSearch, setUseGpsForSearch] = useState(true);
    const [streamingChunksEnabled, setStreamingChunksEnabled] = useState(true);
    const [apiModelsLoading, setApiModelsLoading] = useState(false);
    const [apiModels, setApiModels] = useState<string[]>([]);

    const isLocalGGUF = provider === 'llama_rn';
    const isLocalApi = provider === 'local';

    const onSelectProvider = (key: ProviderKey) => {
        setProvider(key);
        const preset = PROVIDERS[key];
        if (preset) {
            setBaseUrl(preset.baseUrl);
            setModel(preset.defaultModel);
        }
        setApiModels([]);
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
        if (!url) return;
        if (!isOllamaOrLocal() && !apiKey.trim()) return;
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
        } catch (e) {
            setApiModels([]);
        } finally {
            setApiModelsLoading(false);
        }
    };

    const completeSetup = async (skip = false) => {
        try {
            if (!skip) {
                await AsyncStorage.multiSet([
                    ['settings_provider', provider],
                    ['settings_baseUrl', baseUrl],
                    ['settings_apiKey', apiKey],
                    ['settings_model', model],
                    ['settings_useGpsForSearch', String(useGpsForSearch)],
                    ['settings_streamingChunksEnabled', String(streamingChunksEnabled)],
                ]);

                LLMService.setConfig({
                    provider: provider as any,
                    baseUrl: baseUrl || undefined,
                    apiKey: apiKey || undefined,
                    model: model || undefined,
                });
            }
            await AsyncStorage.setItem('onboarding_completed', 'true');
            navigation.reset({
                index: 0,
                routes: [{ name: 'Chat' }],
            });
        } catch (e) {
            console.error('[SetupScreen] Failed to save setup:', e);
        }
    };

    return (
        <Screen edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View className="flex-row items-start justify-between gap-3 px-5 pb-3 pt-3">
                    <View>
                        <Text className="text-[28px] font-extrabold text-fg">Setup</Text>
                        <Text className="mt-1 text-[13px] leading-[18px] text-muted">
                            Match your provider and preferences to the app.
                        </Text>
                    </View>
                    <Button title="Skip" variant="secondary" size="sm" onPress={() => completeSetup(true)} />
                </View>

                <ScrollView
                    className="flex-1 px-5"
                    contentContainerStyle={{
                        paddingBottom: 28 + insets.bottom + 160,
                        paddingTop: 8,
                        flexGrow: 1,
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <SettingsSection title="LLM Provider" icon="cpu" padContent>
                        <ChipSelector
                            options={providerOptions.map((key) => ({ key, label: PROVIDERS[key].name }))}
                            selected={provider}
                            onSelect={(key) => onSelectProvider(key as ProviderKey)}
                        />

                        {!isLocalGGUF && (
                            <>
                                <CompactInput
                                    label="Base URL"
                                    value={baseUrl}
                                    onChangeText={setBaseUrl}
                                    placeholder="https://..."
                                />
                                <CompactInput
                                    label="API Key"
                                    value={apiKey}
                                    onChangeText={setApiKey}
                                    placeholder="sk-..."
                                    secure
                                />
                                <CompactInput
                                    label="Model"
                                    value={model}
                                    onChangeText={setModel}
                                    placeholder="gpt-4o"
                                />

                                <View className="mt-2">
                                    <Pressable
                                        className="flex-row items-center gap-2 self-start rounded-xl border border-border bg-panel px-3 py-2.5"
                                        onPress={loadModelsFromApi}
                                        disabled={apiModelsLoading}
                                    >
                                        {apiModelsLoading ? (
                                            <ActivityIndicator size="small" color={theme.colors.primary} />
                                        ) : (
                                            <>
                                                <Feather name="list" size={16} color={theme.colors.textSecondary} />
                                                <Text className="text-[12px] font-semibold text-muted">
                                                    Load models
                                                </Text>
                                            </>
                                        )}
                                    </Pressable>
                                    <Text className="mt-1.5 text-[12px] text-muted">
                                        Pulls models from the provider API.
                                    </Text>
                                </View>

                                {apiModels.length > 0 && (
                                    <View className="mt-2.5 rounded-xl border border-border p-1.5">
                                        {apiModels.slice(0, 12).map((id) => (
                                            <Pressable
                                                key={id}
                                                className={model === id ? "flex-row items-center gap-2 rounded-lg bg-panel px-2 py-2" : "flex-row items-center gap-2 rounded-lg px-2 py-2"}
                                                onPress={() => setModel(id)}
                                            >
                                                <Feather
                                                    name={model === id ? 'check-circle' : 'circle'}
                                                    size={16}
                                                    color={model === id ? theme.colors.primary : theme.colors.textTertiary}
                                                />
                                                <Text className="flex-1 text-[12px] text-fg" numberOfLines={1}>
                                                    {id}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}

                        {isLocalGGUF && (
                            <View className="mt-3 flex-row items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 p-3">
                                <Feather name="info" size={16} color={theme.colors.primary} />
                                <Text className="flex-1 text-[12px] text-muted">
                                    Local GGUF runs on-device. Load a GGUF model in Settings → Local Models.
                                </Text>
                            </View>
                        )}

                        {isLocalApi && (
                            <View className="mt-3 flex-row items-center gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 p-3">
                                <Feather name="alert-triangle" size={16} color={theme.colors.warning} />
                                <Text className="flex-1 text-[12px] text-muted">
                                    Local API expects Ollama/LM Studio reachable at your Base URL.
                                </Text>
                            </View>
                        )}
                    </SettingsSection>

                    <SettingsSection title="Preferences" icon="sliders" padContent>
                        <CompactSwitch
                            label="Use GPS for search results"
                            value={useGpsForSearch}
                            onValueChange={setUseGpsForSearch}
                        />
                        <View className="my-2 h-px bg-border" />
                        <CompactSwitch
                            label="Stream replies live"
                            value={streamingChunksEnabled}
                            onValueChange={setStreamingChunksEnabled}
                        />
                    </SettingsSection>

                    <SettingsSection title="Finish" icon="check-circle" padContent>
                        <Button title="Finish setup" onPress={() => completeSetup(false)} />
                        <Text className="mt-2.5 text-center text-[12px] leading-[16px] text-muted">
                            You can change these any time in Settings.
                        </Text>
                    </SettingsSection>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
};

export default SetupScreen;
