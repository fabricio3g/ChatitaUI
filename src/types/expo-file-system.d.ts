/**
 * Type augmentations for expo-file-system
 * Fixes TypeScript errors where cacheDirectory/documentDirectory are not recognized
 */

declare module 'expo-file-system' {
    export const cacheDirectory: string;
    export const documentDirectory: string;

    export interface FileInfo {
        exists: boolean;
        uri?: string;
        size?: number;
        isDirectory?: boolean;
        modificationTime?: number;
        md5?: string;
    }

    export function getInfoAsync(fileUri: string, options?: { size?: boolean; md5?: boolean }): Promise<FileInfo>;
    export function makeDirectoryAsync(fileUri: string, options?: { intermediates?: boolean }): Promise<void>;
    export function readAsStringAsync(fileUri: string, options?: { encoding?: string }): Promise<string>;
    export function writeAsStringAsync(fileUri: string, contents: string, options?: { encoding?: string }): Promise<void>;
    export function downloadAsync(uri: string, fileUri: string, options?: object): Promise<{ status: number; uri: string }>;
    export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>;

    export function createDownloadResumable(
        uri: string,
        fileUri: string,
        options?: object,
        callback?: (downloadProgress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
        resumeData?: string
    ): {
        downloadAsync(): Promise<{ uri: string } | undefined>;
        pauseAsync(): Promise<object>;
        resumeAsync(): Promise<{ uri: string } | undefined>;
        savable(): object;
    };
}
