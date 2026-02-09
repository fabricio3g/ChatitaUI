# React Native LLM Chat UI

Simple React Native components for rendering LLM chat interfaces. Just the UI - bring your own LLM provider!

## Installation

```bash
npm install react-native-llm-chat-ui
# or
yarn add react-native-llm-chat-ui
```

### Dependencies

This package requires:

```bash
npm install react-native-markdown-display @expo/vector-icons
```

## Quick Start

```tsx
import { MessageBubble, ChatInput, TypingIndicator } from 'react-native-llm-chat-ui';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: '1', role: 'user', content: 'Hello!' },
    { id: '2', role: 'assistant', content: 'Hi there! How can I help you?' },
  ]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSend = async () => {
    // Add user message
    const userMsg = { id: Date.now().toString(), role: 'user', content: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);

    // Call YOUR LLM provider here
    const response = await yourLLMProvider.sendMessage(inputText);
    
    // Add assistant message
    const assistantMsg = { 
      id: (Date.now() + 1).toString(), 
      role: 'assistant', 
      content: response 
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreaming(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble 
            message={item} 
            isStreaming={isStreaming && item.role === 'assistant'}
            onCopy={(text) => console.log('Copied:', text)}
          />
        )}
        keyExtractor={item => item.id}
      />
      
      {isStreaming && <TypingIndicator />}
      
      <ChatInput
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        isStreaming={isStreaming}
      />
    </View>
  );
}
```

## Components

### MessageBubble

Renders a chat message bubble for user or assistant messages.

```tsx
<MessageBubble
  message={{
    id: '1',
    role: 'assistant',
    content: 'Hello! How can I help?',
    metadata: {
      isStreaming: false,
      thinking: 'Let me think about this...' // Optional reasoning
    }
  }}
  isStreaming={false}
  onCopy={(text) => {}}
  onEdit={(message) => {}}
  onDelete={(id) => {}}
  showThinking={true}
/>
```

**Props:**
- `message` (required): Message object with `id`, `role`, `content`
- `theme` (optional): Custom theme override
- `isStreaming` (optional): Shows streaming cursor
- `onCopy` (optional): Callback when copy button pressed
- `onEdit` (optional): Callback when edit button pressed
- `onDelete` (optional): Callback when delete button pressed
- `onLinkPress` (optional): Callback when link pressed
- `showThinking` (optional): Show thinking/reasoning block (default: true)

### ChatInput

Minimalist chat input with send/stop buttons.

```tsx
<ChatInput
  value={inputText}
  onChangeText={setInputText}
  onSend={handleSend}
  onCancel={handleCancel}
  isStreaming={false}
  placeholder="Type a message..."
/>
```

**Props:**
- `value` (required): Input text value
- `onChangeText` (required): Text change callback
- `onSend` (required): Send button callback
- `onCancel` (optional): Cancel/stop button callback
- `isStreaming` (optional): Shows stop button instead of send
- `placeholder` (optional): Placeholder text
- `disabled` (optional): Disable input

### TypingIndicator

Animated three-dot typing indicator.

```tsx
<TypingIndicator />
```

## Theming

Use the default theme or provide your own:

```tsx
import { defaultTheme, darkTheme } from 'react-native-llm-chat-ui';

// Use dark theme
<MessageBubble 
  message={message} 
  theme={darkTheme}
/>

// Or custom theme
<MessageBubble 
  message={message} 
  theme={{
    colors: {
      background: '#fff',
      surface: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      border: '#eee',
      primary: '#000',
      userBubble: '#f5f5f5',
      assistantBubble: 'transparent',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    borderRadius: { sm: 8, md: 12, lg: 16 },
  }}
/>
```

## Features

- ✅ User messages (right-aligned bubbles)
- ✅ Assistant messages (left-aligned plain text)
- ✅ Markdown rendering (bold, italic, lists, links, code)
- ✅ Thinking/reasoning block display
- ✅ Copy, edit, delete actions
- ✅ Streaming indicator
- ✅ Simple black & white design
- ✅ Customizable themes

## License

MIT
