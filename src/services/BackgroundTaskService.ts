/**
 * Background Task Service
 * Manages long-running tasks like Deep Research
 * Allows users to navigate away and receive notifications when complete
 */

import { ToolResponse } from './tools/types';
import { Message } from '../types/message';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundTask {
    id: string;
    type: 'deep_research' | 'image_generation' | 'web_search' | 'deep_search';
    conversationId: string;
    status: TaskStatus;
    progress: number; // 0-100
    statusMessage: string;
    createdAt: number;
    completedAt?: number;
    result?: ToolResponse;
    error?: string;
    query: string; // Original query for display
}

type TaskListener = (tasks: BackgroundTask[]) => void;

class BackgroundTaskServiceClass {
    private tasks: Map<string, BackgroundTask> = new Map();
    private listeners: Set<TaskListener> = new Set();
    private STORAGE_KEY = 'background_tasks';
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        // Don't load tasks in constructor - call init() explicitly
    }

    /**
     * Initialize the service - must be called before using other methods
     * Returns a promise that resolves when tasks are loaded
     */
    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.loadTasks();
        await this.initPromise;
        this.initialized = true;
        this.initPromise = null;
    }

    /**
     * Ensure the service is initialized before running operations
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        } else if (!this.initialized) {
            await this.init();
        }
    }

    private notifyListeners() {
        const tasksList = Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
        this.listeners.forEach(listener => listener(tasksList));
    }

    subscribe(listener: TaskListener): () => void {
        this.listeners.add(listener);
        // Immediately notify with current state (even if empty during init)
        listener(Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt));
        return () => this.listeners.delete(listener);
    }

    async createTask(
        type: BackgroundTask['type'],
        conversationId: string,
        query: string
    ): Promise<string> {
        await this.ensureInitialized();

        const task: BackgroundTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            conversationId,
            status: 'pending',
            progress: 0,
            statusMessage: 'Initializing...',
            createdAt: Date.now(),
            query
        };

        this.tasks.set(task.id, task);
        await this.saveTasks();
        this.notifyListeners();

        return task.id;
    }

    async startTask(taskId: string) {
        await this.ensureInitialized();

        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'running';
            await this.saveTasks();
            this.notifyListeners();
        }
    }

    async updateProgress(
        taskId: string,
        progress: number,
        statusMessage: string
    ) {
        await this.ensureInitialized();

        const task = this.tasks.get(taskId);
        if (task && task.status === 'running') {
            task.progress = Math.min(100, Math.max(0, progress));
            task.statusMessage = statusMessage;
            await this.saveTasks();
            this.notifyListeners();
        }
    }

    async completeTask(taskId: string, result: ToolResponse) {
        await this.ensureInitialized();

        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.progress = 100;
            task.statusMessage = 'Completed';
            task.completedAt = Date.now();
            task.result = result;
            await this.saveTasks();
            this.notifyListeners();

            // Show notification
            this.showNotification(task);
        }
    }

    async failTask(taskId: string, error: string) {
        await this.ensureInitialized();

        const task = this.tasks.get(taskId);
        if (task) {
            task.status = 'failed';
            task.statusMessage = 'Failed';
            task.completedAt = Date.now();
            task.error = error;
            await this.saveTasks();
            this.notifyListeners();
        }
    }

    async cancelTask(taskId: string) {
        await this.ensureInitialized();

        this.tasks.delete(taskId);
        await this.saveTasks();
        this.notifyListeners();
    }

    async getTask(taskId: string): Promise<BackgroundTask | undefined> {
        await this.ensureInitialized();
        return this.tasks.get(taskId);
    }

    async getTasksForConversation(conversationId: string): Promise<BackgroundTask[]> {
        await this.ensureInitialized();
        return Array.from(this.tasks.values())
            .filter(t => t.conversationId === conversationId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    async getActiveTasks(): Promise<BackgroundTask[]> {
        await this.ensureInitialized();
        return Array.from(this.tasks.values())
            .filter(t => t.status === 'running' || t.status === 'pending')
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    private async showNotification(task: BackgroundTask) {
        // Store notification for in-app display
        const queryPreview = task.query && task.query.length > 0
            ? `"${task.query.substring(0, 50)}..." is ready`
            : 'Task is ready';

        await AsyncStorage.setItem(`notification_${task.id}`, JSON.stringify({
            title: task.type === 'deep_research' ? 'Deep Research Complete' : 'Task Complete',
            body: queryPreview,
            conversationId: task.conversationId,
            taskId: task.id,
            timestamp: Date.now()
        }));
    }

    async getNotifications(): Promise<Array<{
        title: string;
        body: string;
        conversationId: string;
        taskId: string;
        timestamp: number;
    }>> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const notificationKeys = keys.filter(k => k.startsWith('notification_'));
            const notifications = await AsyncStorage.multiGet(notificationKeys);

            return notifications
                .map(([key, value]) => {
                    if (!value) return null;
                    try {
                        return JSON.parse(value);
                    } catch (e) {
                        console.error('[BackgroundTaskService] Failed to parse notification:', key, e);
                        // Remove corrupted notification
                        AsyncStorage.removeItem(key).catch(err =>
                            console.error('[BackgroundTaskService] Failed to remove corrupted notification:', err)
                        );
                        return null;
                    }
                })
                .filter((n): n is Exclude<typeof n, null> => n !== null)
                .sort((a, b) => b.timestamp - a.timestamp);
        } catch (e) {
            console.error('[BackgroundTaskService] Failed to get notifications:', e);
            return [];
        }
    }

    async clearNotification(taskId: string) {
        await AsyncStorage.removeItem(`notification_${taskId}`);
    }

    private async saveTasks() {
        const tasksArray = Array.from(this.tasks.values());
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasksArray));
    }

    private async loadTasks() {
        try {
            const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                let tasks: BackgroundTask[];
                try {
                    tasks = JSON.parse(stored);
                } catch (parseError) {
                    console.error('[BackgroundTaskService] Failed to parse tasks data:', parseError);
                    // Clear corrupted data
                    await AsyncStorage.removeItem(this.STORAGE_KEY);
                    return;
                }

                // Validate that it's an array
                if (!Array.isArray(tasks)) {
                    console.error('[BackgroundTaskService] Tasks data is not an array');
                    await AsyncStorage.removeItem(this.STORAGE_KEY);
                    return;
                }

                // Only load incomplete tasks
                tasks.forEach(task => {
                    // Validate task structure
                    if (task && typeof task === 'object' && task.id && task.status) {
                        if (task.status === 'running') {
                            task.status = 'failed'; // Mark interrupted tasks as failed
                            task.error = 'Task was interrupted';
                            task.completedAt = Date.now();
                        }
                        this.tasks.set(task.id, task);
                    } else {
                        console.warn('[BackgroundTaskService] Invalid task structure:', task);
                    }
                });
            }
        } catch (e) {
            console.error('[BackgroundTaskService] Failed to load tasks:', e);
        }
    }

    async clearCompletedTasks() {
        await this.ensureInitialized();

        const toDelete: string[] = [];
        this.tasks.forEach((task, id) => {
            if (task.status === 'completed' || task.status === 'failed') {
                toDelete.push(id);
            }
        });
        toDelete.forEach(id => this.tasks.delete(id));
        await this.saveTasks();
        this.notifyListeners();
    }
}

export const BackgroundTaskService = new BackgroundTaskServiceClass();
