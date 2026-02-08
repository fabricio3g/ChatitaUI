/**
 * Sidebar Component - Rich slide-out navigation
 * Contains chat history, model selector, and user menu
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseService } from '../../services/DatabaseService';
import { useTheme } from '../../context/ThemeContext';

// Black & white palette for delete modal (matches app minimal style)
const BW = {
    white: '#FFFFFF',
    black: '#000000',
    gray100: '#F5F5F5',
    gray200: '#EEEEEE',
    gray400: '#AAAAAA',
    gray600: '#666666',
};

interface SidebarProps {
    visible: boolean;
    onClose: () => void;
    navigation: any;
}

interface Conversation {
    id: string;
    title: string;
    timestamp: number;
    type: 'chat' | 'search';
}

// Memoized conversation item for FlashList performance
const ConversationItem = memo<{
    id: string;
    title: string;
    timestamp: number;
    type: 'chat' | 'search';
    formatTime: (ts: number) => string;
    onPress: (id: string, type: 'chat' | 'search') => void;
    onDelete: (id: string) => void;
    theme: any;
}>(({ id, title, timestamp, type, formatTime, onPress, onDelete, theme }) => {
    const handlePress = useCallback(() => {
        onPress(id, type);
    }, [id, type, onPress]);

    const handleDelete = useCallback(() => {
        onDelete(id);
    }, [id, onDelete]);

    return (
        <View style={[styles.conversationRow, { borderBottomColor: theme.colors.border }]}>
            <Pressable
                style={({ pressed }) => [
                    styles.conversationItem,
                    { backgroundColor: pressed ? theme.colors.surfaceHighlight : 'transparent' }
                ]}
                onPress={handlePress}
            >
                    <View style={[styles.convIconWrap, { backgroundColor: theme.colors.surfaceHighlight }]}>
                        <Feather
                            name={type === 'search' ? 'search' : 'message-circle'}
                            size={12}
                            color={theme.colors.textSecondary}
                        />
                    </View>
                <View style={styles.convContent}>
                    <Text style={[styles.convTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={[styles.convTime, { color: theme.colors.textTertiary }]}>
                        {formatTime(timestamp)}
                    </Text>
                </View>
            </Pressable>
            <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
            >
                <Feather name="trash-2" size={14} color={theme.colors.textTertiary} />
            </Pressable>
        </View>
    );
});


export const Sidebar: React.FC<SidebarProps> = ({ visible, onClose, navigation }) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [chatConversations, setChatConversations] = useState<Conversation[]>([]);
    const [researchConversations, setResearchConversations] = useState<Conversation[]>([]);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'research'>('chat');
    const [userName, setUserName] = useState<string>('User');
    const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedUserName = await AsyncStorage.getItem('settings_userName');
                if (savedUserName?.trim()) setUserName(savedUserName.trim());
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        };
        loadSettings();
    }, [visible]);

    const loadConversations = async () => {
        const chats = await DatabaseService.getConversations('chat');
        const formattedChats = chats.map((c: any) => ({
            id: c.id,
            title: c.title || 'New conversation',
            timestamp: c.updatedAt || Date.now(),
            type: 'chat' as const,
        })).sort((a, b) => b.timestamp - a.timestamp);
        setChatConversations(formattedChats);

        const searches = await DatabaseService.getConversations('search');
        const formattedSearches = searches.map((c: any) => ({
            id: c.id,
            title: c.title || 'New research',
            timestamp: c.updatedAt || Date.now(),
            type: 'search' as const,
        })).sort((a, b) => b.timestamp - a.timestamp);
        setResearchConversations(formattedSearches);
    };



    const handleNewChat = () => {
        onClose();
        if (activeTab === 'research') {
            navigation.navigate('Search', { conversationId: null });
        } else {
            // Navigate to Chat with intent to start new
            navigation.navigate('Chat', { conversationId: undefined, newChat: true });
        }
    };

    const handleConversationPress = (conv: Conversation) => {
        onClose();
        if (conv.type === 'search') {
            navigation.navigate('Search', { conversationId: conv.id });
        } else {
            navigation.navigate('Chat', { conversationId: conv.id });
        }
    };

    const handleDeletePress = (conv: Conversation) => {
        setDeleteTarget(conv);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        await DatabaseService.deleteConversation(deleteTarget.id);
        setDeleteTarget(null);
        loadConversations();
    };

    const handleDeleteCancel = () => {
        setDeleteTarget(null);
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        }
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const groupConversations = (conversations: Conversation[]) => {
        const groups: { [key: string]: Conversation[] } = { 'Today': [], 'Yesterday': [], 'Previous 7 Days': [], 'Previous 30 Days': [] };
        conversations.forEach(conv => {
            const diffDays = Math.floor((Date.now() - (conv.timestamp || Date.now())) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) groups['Today'].push(conv);
            else if (diffDays === 1) groups['Yesterday'].push(conv);
            else if (diffDays < 7) groups['Previous 7 Days'].push(conv);
            else groups['Previous 30 Days'].push(conv);
        });
        return groups;
    };

    const currentConversations = activeTab === 'chat' ? chatConversations : researchConversations;
    const grouped = groupConversations(currentConversations);

    // Effect to reload conversations when visible changes
    useEffect(() => {
        if (visible) {
            loadConversations();
        }
    }, [visible]);

    return (
        <View
            style={[styles.container, {
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 10,
            }]}
            className="bg-bg"
        >
            {/* Action Buttons */}
            <View style={{ gap: 8, marginBottom: 16 }}>
                <Pressable
                    style={[styles.newChatButton, { borderColor: theme.colors.border }]}
                    onPress={() => {
                        onClose();
                        navigation.navigate('Chat', { conversationId: undefined, newChat: true });
                    }}
                >
                    <Feather name="message-square" size={18} color={theme.colors.text} />
                    <Text style={[styles.newChatButtonText, { color: theme.colors.text }]}>
                        New chat
                    </Text>
                </Pressable>

                <Pressable
                    style={[styles.newChatButton, { borderColor: theme.colors.border }]}
                    onPress={() => {
                        onClose();
                        navigation.navigate('Search', { conversationId: null });
                    }}
                >
                    <Feather name="globe" size={18} color={theme.colors.text} />
                    <Text style={[styles.newChatButtonText, { color: theme.colors.text }]}>
                        New research
                    </Text>
                </Pressable>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { borderBottomColor: theme.colors.border }]}>
                <Pressable
                    style={[styles.tab, activeTab === 'chat' && { backgroundColor: theme.colors.surfaceHighlight }]}
                    onPress={() => setActiveTab('chat')}
                >
                    <Feather name="message-circle" size={14} color={activeTab === 'chat' ? theme.colors.text : theme.colors.textSecondary} />
                    <Text style={[styles.tabText, { color: activeTab === 'chat' ? theme.colors.text : theme.colors.textSecondary }]}>
                        Chats
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'research' && { backgroundColor: theme.colors.surfaceHighlight }]}
                    onPress={() => setActiveTab('research')}
                >
                    <Feather name="search" size={14} color={activeTab === 'research' ? theme.colors.text : theme.colors.textSecondary} />
                    <Text style={[styles.tabText, { color: activeTab === 'research' ? theme.colors.text : theme.colors.textSecondary }]}>
                        Research
                    </Text>
                </Pressable>
            </View>

            {/* Conversations List - Optimized with FlashList */}
            <View style={styles.conversationList}>
                {currentConversations.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name={activeTab === 'chat' ? 'message-circle' : 'search'} size={32} color={theme.colors.border} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            No {activeTab === 'chat' ? 'chats' : 'research'} yet
                        </Text>
                    </View>
                ) : (
                    <FlashList
                        data={currentConversations}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <ConversationItem
                                id={item.id}
                                title={item.title}
                                timestamp={item.timestamp}
                                type={item.type}
                                formatTime={formatTime}
                                onPress={(id, type) => {
                                    const conv = { id, type } as Conversation;
                                    handleConversationPress(conv);
                                }}
                                onDelete={(id) => {
                                    const conv = currentConversations.find(c => c.id === id);
                                    if (conv) handleDeletePress(conv);
                                }}
                                theme={theme}
                            />
                        )}
                        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 120 }}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* Delete confirmation modal - black & white style */}
            <Modal
                visible={!!deleteTarget}
                transparent
                animationType="fade"
                onRequestClose={handleDeleteCancel}
            >
                <View style={sidebarStyles.deleteOverlay}>
                    <View style={sidebarStyles.deleteModal}>
                        <Text style={sidebarStyles.deleteModalTitle}>Delete conversation?</Text>
                        <Text style={sidebarStyles.deleteModalMessage} numberOfLines={2}>
                            {deleteTarget ? `"${deleteTarget.title || 'Untitled'}" will be permanently removed.` : ''}
                        </Text>
                        <View style={sidebarStyles.deleteModalActions}>
                            <Pressable
                                style={[sidebarStyles.deleteModalBtn, sidebarStyles.deleteModalCancel]}
                                onPress={handleDeleteCancel}
                            >
                                <Text style={sidebarStyles.deleteModalCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[sidebarStyles.deleteModalBtn, sidebarStyles.deleteModalConfirm]}
                                onPress={handleDeleteConfirm}
                            >
                                <Text style={sidebarStyles.deleteModalConfirmText}>Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Bottom Actions */}
            <View style={[styles.bottomSection, { borderTopColor: theme.colors.border }]}>


                <Pressable
                    style={styles.bottomItem}
                    onPress={() => { onClose(); navigation.navigate('Settings'); }}
                >
                    <Feather name="settings" size={18} color={theme.colors.textSecondary} />
                    <Text style={[styles.bottomItemText, { color: theme.colors.textSecondary }]}>Settings</Text>
                </Pressable>

                {/* User Profile */}
                <Pressable style={styles.userProfile} onPress={() => setShowUserMenu(!showUserMenu)}>
                    <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.userInitial}>{userName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.userName, { color: theme.colors.text }]} numberOfLines={1}>
                        {userName}
                    </Text>
                </Pressable>
            </View>
        </View>

    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 8 },
    newChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 16,
    },
    newChatButtonText: {
        fontSize: 15,
        fontWeight: '500',
    },
    tabContainer: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
    tabText: { fontSize: 13, fontWeight: '500' },
    conversationList: { flex: 1, paddingHorizontal: 0, paddingTop: 4 },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 14 },
    conversationRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginBottom: 4,
    },
    conversationItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingLeft: 4,
        paddingRight: 6,
        minHeight: 40,
    },
    convIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    convContent: {
        flex: 1,
        justifyContent: 'center',
        minWidth: 0,
    },
    convTitle: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    convTime: {
        fontSize: 12,
        fontWeight: '400',
    },
    deleteBtn: {
        paddingVertical: 6,
        paddingHorizontal: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomSection: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
    bottomItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8 },
    bottomItemText: { fontSize: 14 },
    userProfile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, marginTop: 4, borderRadius: 8 },
    userAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    userInitial: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    userName: { flex: 1, fontSize: 14, fontWeight: '500' },
});

// Black & white delete modal styles (minimal, no accent colors)
const sidebarStyles = StyleSheet.create({
    deleteOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    deleteModal: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: BW.white,
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: BW.gray200,
    },
    deleteModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: BW.black,
        marginBottom: 8,
    },
    deleteModalMessage: {
        fontSize: 14,
        lineHeight: 20,
        color: BW.gray600,
        marginBottom: 24,
    },
    deleteModalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    deleteModalBtn: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteModalCancel: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: BW.gray200,
    },
    deleteModalCancelText: {
        fontSize: 15,
        fontWeight: '500',
        color: BW.gray600,
    },
    deleteModalConfirm: {
        backgroundColor: BW.black,
    },
    deleteModalConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: BW.white,
    },
});

export default Sidebar;
