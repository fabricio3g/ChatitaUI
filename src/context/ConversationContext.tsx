import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { Message } from '../types/message';
import { DatabaseService } from '../services/DatabaseService';

interface ConversationContextType {
    // Messages for the currently active view
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    addMessage: (message: Message) => void;
    updateMessage: (id: string, updates: Partial<Message>) => void;
    deleteMessage: (id: string) => void;
    clearMessages: () => void;
    saveConversation: () => Promise<void>;
    conversationId: string;
    switchConversation: (id: string) => void;
    chatConversationId: string;
    setChatConversationId: (id: string) => void;
    allConversations: Record<string, Message[]>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [chatId, setChatId] = useState<string>(`chat_${Date.now()}`);
    const [activeId, setActiveId] = useState<string>(chatId);
    const [messages, setMessagesState] = useState<Message[]>([]);

    // Initialize DB
    useEffect(() => {
        DatabaseService.init().catch(console.error);
    }, []);

    // Load messages when activeId changes
    useEffect(() => {
        loadMessages(activeId);
    }, [activeId]);

    const loadMessages = async (id: string) => {
        const dbMessages = await DatabaseService.getMessages(id);
        setMessagesState(dbMessages);
    };

    const addMessage = async (message: Message) => {
        const withConvId = { ...message, conversationId: activeId };
        setMessagesState(prev => [...prev, withConvId]);
        await DatabaseService.addMessage(withConvId);
    };

    const updateMessage = (id: string, updates: Partial<Message>) => {
        setMessagesState(prev => prev.map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
        ));

        const currentMsg = messages.find(m => m.id === id);
        if (currentMsg) {
            const merged = { ...currentMsg, ...updates, conversationId: activeId };
            DatabaseService.addMessage(merged);
        }
    };

    const deleteMessage = (id: string) => {
        setMessagesState(prev => prev.filter(msg => msg.id !== id));
    };

    const clearMessages = async () => {
        setMessagesState([]);
    };

    const switchConversation = (id: string) => {
        if (id.startsWith('chat_')) {
            setChatId(id);
        }
        setActiveId(id);
    };

    const setChatConversationId = (id: string) => {
        setChatId(id);
        setActiveId(id);
    };

    const allConversations: Record<string, Message[]> = {
        [activeId]: messages
    };

    return (
        <ConversationContext.Provider value={{
            messages,
            setMessages: setMessagesState,
            addMessage,
            updateMessage,
            deleteMessage,
            clearMessages,
            saveConversation: async () => { },
            conversationId: activeId,
            switchConversation,
            chatConversationId: chatId,
            setChatConversationId,
            allConversations
        }}>
            {children}
        </ConversationContext.Provider>
    );
};

export const useConversation = () => {
    const context = useContext(ConversationContext);
    if (!context) {
        throw new Error('useConversation must be used within a ConversationProvider');
    }
    return context;
};
