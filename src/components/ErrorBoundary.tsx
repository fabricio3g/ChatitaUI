/**
 * Error Boundary – catches React render errors and shows fallback UI
 * so the app doesn't show a blank screen or crash silently in release.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View className="flex-1 items-center justify-center bg-bg p-6">
          <Text className="mb-2 text-[18px] font-semibold text-fg">Something went wrong</Text>
          <Text className="mb-6 text-center text-[14px] text-muted" numberOfLines={5}>
            {this.state.error.message}
          </Text>
          <Pressable className="rounded-xl bg-success px-5 py-3" onPress={this.handleRetry}>
            <Text className="text-[16px] font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Wrapper that wraps children in ErrorBoundary (for use in App.tsx) */
export function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
