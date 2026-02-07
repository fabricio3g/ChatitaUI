declare module 'react-native-sse' {
    export interface EventSourceOptions {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        debug?: boolean;
        pollingInterval?: number;
    }

    export interface MessageEvent {
        type: string;
        data: string | null;
        lastEventId: string | null;
        url: string;
    }

    export interface EventSourceListener {
        (event: MessageEvent): void;
    }

    export default class EventSource {
        constructor(url: string, options?: EventSourceOptions);
        addEventListener(type: string, listener: EventSourceListener): void;
        removeEventListener(type: string, listener: EventSourceListener): void;
        removeAllEventListeners(): void;
        close(): void;
        open(): void;
    }
}
