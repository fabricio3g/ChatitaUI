import * as SQLite from 'expo-sqlite';

// Open the database variable - initialized in init()
let db: SQLite.SQLiteDatabase;

let initPromise: Promise<void> | null = null;

// Serialization Queue to prevent "database is locked" errors
let executionQueue: Promise<any> = Promise.resolve();

// Error handler for database operations
type DatabaseErrorHandler = (error: Error, operation: string) => void;
const errorHandlers: Set<DatabaseErrorHandler> = new Set();

/**
 * Register an error handler for database operations
 * @param handler Callback function that receives errors
 * @returns Unregister function
 */
export const registerDatabaseErrorHandler = (handler: DatabaseErrorHandler) => {
    errorHandlers.add(handler);
    return () => errorHandlers.delete(handler);
};

/**
 * Log database errors to all registered handlers
 */
const notifyErrorHandlers = (error: Error, operation: string) => {
    errorHandlers.forEach(handler => {
        try {
            handler(error, operation);
        } catch (e) {
            console.error('[DatabaseService] Error handler failed:', e);
        }
    });
};

const runSerialized = <T>(operation: () => Promise<T>, operationName: string = 'database operation'): Promise<T> => {
    // Chain the operation to the end of the existing queue
    const result = executionQueue.then(() => {
        return operation();
    });

    // Update the queue to wait for this new operation
    // Log errors but keep queue alive by catching them
    executionQueue = result.catch((error) => {
        // Log the error
        console.error(`[DatabaseService] Error in ${operationName}:`, error);
        notifyErrorHandlers(error instanceof Error ? error : new Error(String(error)), operationName);
        // Return undefined to keep queue alive
        return undefined;
    });

    return result;
};

export const DatabaseService = {
    init: () => {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                // Open DB Asynchronously (Safer for Android)
                db = await SQLite.openDatabaseAsync('kokoro_v1.db');

                // Configure concurrency settings - CRITICAL for preventing locks
                await db.execAsync('PRAGMA busy_timeout = 5000;');
                await db.execAsync('PRAGMA foreign_keys = ON;');
                // WAL mode explicitly DISABLED to prevent NPE on some devices
                // await db.execAsync('PRAGMA journal_mode = WAL;'); 

                await db.withTransactionAsync(async () => {
                    // 1. Characters Table
                    await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS characters (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            description TEXT,
                            avatar TEXT,
                            systemPrompt TEXT,
                            firstMessage TEXT,
                            personality TEXT,
                            tags TEXT,
                            lorebookId TEXT,
                            sourceUrl TEXT,
                            alternate_greetings TEXT,
                            post_history_instructions TEXT,
                            creator_notes TEXT,
                            extensions TEXT,
                            stats TEXT
                        );
                    `);

                    // 2. Conversations Table
                    await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS conversations (
                            id TEXT PRIMARY KEY,
                            title TEXT,
                            lastMessage TEXT,
                            updatedAt INTEGER,
                            type TEXT DEFAULT 'chat'
                        );
                    `);

                    // 3. Participants
                    await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS participants (
                            conversationId TEXT,
                            characterId TEXT,
                            PRIMARY KEY (conversationId, characterId),
                            FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
                            FOREIGN KEY (characterId) REFERENCES characters(id) ON DELETE CASCADE
                        );
                    `);

                    // 4. Messages (with versioning support)
                    await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS messages (
                            id TEXT PRIMARY KEY,
                            conversationId TEXT,
                            role TEXT,
                            content TEXT,
                            timestamp INTEGER,
                            characterId TEXT,
                            metadata TEXT,
                            versions TEXT,
                            currentVersionIndex INTEGER DEFAULT 0,
                            embedding TEXT,
                            FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
                        );
                    `);

                    // Migration: Add versioning columns to existing messages table
                    // These will silently fail if columns already exist
                    try {
                        await db.execAsync(`ALTER TABLE messages ADD COLUMN versions TEXT;`);
                    } catch { } // Ignore if already exists
                    try {
                        await db.execAsync(`ALTER TABLE messages ADD COLUMN currentVersionIndex INTEGER DEFAULT 0;`);
                    } catch { } // Ignore if already exists

                    // 5. Lorebooks
                    await db.execAsync(`
                         CREATE TABLE IF NOT EXISTS lorebooks (
                            id TEXT PRIMARY KEY,
                            name TEXT,
                            description TEXT
                         );
                    `);

                    // 6. Lorebook Entries
                    await db.execAsync(`
                         CREATE TABLE IF NOT EXISTS lorebook_entries (
                            id TEXT PRIMARY KEY,
                            lorebookId TEXT,
                            keys TEXT, -- JSON string array
                            content TEXT,
                            enabled INTEGER, -- Boolean 0/1
                            embedding TEXT,
                            FOREIGN KEY (lorebookId) REFERENCES lorebooks(id) ON DELETE CASCADE
                         );
                    `);

                    // Migration for existing characters table to add new columns if missing
                    // Simple check: try to add columns, ignore if exist
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN lorebookId TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN sourceUrl TEXT;'); } catch (e) { }

                    // V2 Migrations
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN alternate_greetings TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN post_history_instructions TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN creator_notes TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN extensions TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE characters ADD COLUMN stats TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE messages ADD COLUMN embedding TEXT;'); } catch (e) { }
                    try { await db.execAsync('ALTER TABLE lorebook_entries ADD COLUMN embedding TEXT;'); } catch (e) { }
                    try { await db.execAsync("ALTER TABLE conversations ADD COLUMN type TEXT DEFAULT 'chat';"); } catch (e) { }

                });
                console.log('Database initialized successfully (expo-sqlite next)');
            } catch (e) {
                console.error('Failed to init database', e);
                throw e;
            }
        })();
        return initPromise;
    },

    upsertCharacter: async (char: any) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        try {
            await db.runAsync(
                `INSERT OR REPLACE INTO characters (
                    id, name, description, avatar, systemPrompt, firstMessage, personality, tags, 
                    lorebookId, sourceUrl, alternate_greetings, post_history_instructions, creator_notes, extensions, stats
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    char.id,
                    char.name,
                    char.description || '',
                    char.avatar || null,
                    char.systemPrompt || '',
                    char.firstMessage || '',
                    char.personality || '',
                    JSON.stringify(char.tags || []),
                    char.lorebookId || null,
                    char.sourceUrl || null,
                    JSON.stringify(char.alternate_greetings || []),
                    char.post_history_instructions || '',
                    char.creator_notes || '',
                    JSON.stringify(char.extensions || {}),
                    JSON.stringify(char.stats || {})
                ]
            );
        } catch (err) {
            console.error('upsertCharacter Fail', err);
        }
    },

    addMessage: async (msg: any & { type?: string }) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;

        const metadataStr = JSON.stringify(msg.metadata || {});

        // Detect conversation type from explicit param, ID prefix, or default to 'chat'
        const convType = msg.type || (msg.conversationId?.startsWith('search_') ? 'search' : 'chat');

        try {
            // 1. Ensure Conversation Exists (FK Requirement) with proper type
            await db.runAsync(
                `INSERT OR IGNORE INTO conversations (id, title, updatedAt, type) VALUES (?, ?, ?, ?)`,
                [msg.conversationId, 'Chat', msg.timestamp, convType]
            );

            console.log('[Database] Saving message:', msg.id, 'to', msg.conversationId);

            // Serialize versions array as JSON
            const versionsStr = msg.versions ? JSON.stringify(msg.versions) : null;
            const versionIndex = msg.currentVersionIndex || 0;

            // 2. Insert Message (with versioning)
            await db.runAsync(
                `INSERT OR REPLACE INTO messages (id, conversationId, role, content, timestamp, characterId, metadata, versions, currentVersionIndex, embedding)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [msg.id, msg.conversationId, msg.role, msg.content, msg.timestamp, msg.characterId || null, metadataStr, versionsStr, versionIndex, msg.embedding || null]
            );

            // 3. Update Conversation Meta
            await db.runAsync(
                `UPDATE conversations SET lastMessage = ?, updatedAt = ? WHERE id = ?`,
                [msg.content.substring(0, 100), msg.timestamp, msg.conversationId]
            );

        } catch (err) {
            console.error('addMessage Fail', err);
            throw err;
        }
    },

    getMessages: async (conversationId: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;

        try {
            console.log('[Database] getMessages for:', conversationId);
            const rows = await db.getAllAsync<any>(
                `SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC`,
                [conversationId]
            );
            console.log(`[Database] Found ${rows.length} messages`);
            return rows.map((row: any) => ({
                ...row,
                metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                versions: row.versions ? JSON.parse(row.versions) : undefined,
                currentVersionIndex: row.currentVersionIndex || 0
            }));
        } catch (err) {
            console.error('getMessages Fail', err);
            return [];
        }
    },

    createConversation: async (id: string, title: string, type: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `INSERT OR IGNORE INTO conversations (id, title, updatedAt, type) VALUES (?, ?, ?, ?)`,
                    [id, title, Date.now(), type]
                );
            } catch (err) {
                console.error('createConversation Fail', err);
                throw err; // Re-throw to trigger error handler
            }
        }, 'createConversation');
    },

    getConversations: async (type?: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                if (type) {
                    return await db.getAllAsync(
                        `SELECT * FROM conversations WHERE type = ? ORDER BY updatedAt DESC`,
                        [type]
                    );
                }
                return await db.getAllAsync(
                    `SELECT * FROM conversations ORDER BY updatedAt DESC`
                );
            } catch (err) {
                console.error('getConversations Fail', err);
                return [];
            }
        });
    },

    upsertchrCharacter: async (c: any) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `INSERT OR REPLACE INTO characters (
                        id, name, description, avatar, systemPrompt, 
                        firstMessage, personality, tags, lorebookId, sourceUrl
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        c.id, c.name, c.description || '', c.avatar || '', c.systemPrompt || '',
                        c.firstMessage || '', c.personality || '', JSON.stringify(c.tags || []),
                        c.lorebookId || null, c.sourceUrl || ''
                    ]
                );
            } catch (err) {
                console.error('upsertCharacter Fail', err);
            }
        });
    },

    addParticipant: async (conversationId: string, characterId: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                // 1. Ensure Conversation Exists first (FK)
                await db.runAsync(
                    `INSERT OR IGNORE INTO conversations (id, updatedAt) VALUES (?, ?)`,
                    [conversationId, Date.now()]
                );

                // 2. Add Participant
                await db.runAsync(
                    `INSERT OR IGNORE INTO participants (conversationId, characterId) VALUES (?, ?)`,
                    [conversationId, characterId]
                );
            } catch (err) {
                console.error('addParticipant Fail', err);
            }
        });
    },

    getParticipants: async (conversationId: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                const rows = await db.getAllAsync(
                    `SELECT c.* FROM characters c
                     JOIN participants p ON c.id = p.characterId
                     WHERE p.conversationId = ?`,
                    [conversationId]
                );
                return rows.map((r: any) => ({
                    ...r,
                    tags: r.tags ? JSON.parse(r.tags) : [],
                    stats: r.stats ? JSON.parse(r.stats) : undefined,
                    alternate_greetings: r.alternate_greetings ? JSON.parse(r.alternate_greetings) : [],
                    extensions: r.extensions ? JSON.parse(r.extensions) : {},
                    // Parse other JSON fields if needed
                }));
            } catch (err) {
                console.error('getParticipants Fail', err);
                return [];
            }
        });
    },

    deleteConversation: async (conversationId: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `DELETE FROM conversations WHERE id = ?`,
                    [conversationId]
                );
            } catch (err) {
                console.error('deleteConversation Fail', err);
            }
        });
    },

    updateConversationTitle: async (conversationId: string, title: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `UPDATE conversations SET title = ? WHERE id = ?`,
                    [title, conversationId]
                );
            } catch (err) {
                console.error('updateConversationTitle Fail', err);
            }
        });
    },

    updateMessage: async (id: string, updates: { content?: string; metadata?: any }) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                const metadataStr = updates.metadata ? JSON.stringify(updates.metadata) : null;
                if (updates.content !== undefined && metadataStr) {
                    await db.runAsync(
                        `UPDATE messages SET content = ?, metadata = ? WHERE id = ?`,
                        [updates.content, metadataStr, id]
                    );
                } else if (updates.content !== undefined) {
                    await db.runAsync(
                        `UPDATE messages SET content = ? WHERE id = ?`,
                        [updates.content, id]
                    );
                } else if (metadataStr) {
                    await db.runAsync(
                        `UPDATE messages SET metadata = ? WHERE id = ?`,
                        [metadataStr, id]
                    );
                }
            } catch (err) {
                console.error('updateMessage Fail', err);
            }
        });
    },

    deleteMessage: async (id: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `DELETE FROM messages WHERE id = ?`,
                    [id]
                );
            } catch (err) {
                console.error('deleteMessage Fail', err);
            }
        });
    },

    removeParticipant: async (conversationId: string, characterId: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `DELETE FROM participants WHERE conversationId = ? AND characterId = ?`,
                    [conversationId, characterId]
                );
            } catch (err) {
                console.error('removeParticipant Fail', err);
            }
        });
    },

    clearMessages: async (conversationId: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `DELETE FROM messages WHERE conversationId = ?`,
                    [conversationId]
                );
            } catch (err) {
                console.error('clearMessages Fail', err);
            }
        });
    },

    // Helpers for LorebookService
    runQuery: async (sql: string, params: any[] = []) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(() => db.runAsync(sql, params));
    },
    getAllAsync: async (sql: string, params: any[] = []) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(() => db.getAllAsync(sql, params));
    },

    // ===== Search History =====

    saveSearch: async (query: string, focusMode: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                // Create table if not exists
                await db.execAsync(`
                    CREATE TABLE IF NOT EXISTS searches (
                        id TEXT PRIMARY KEY,
                        query TEXT NOT NULL,
                        focusMode TEXT,
                        timestamp INTEGER
                    );
                `);

                const id = `search_${Date.now()}`;
                await db.runAsync(
                    `INSERT INTO searches (id, query, focusMode, timestamp) VALUES (?, ?, ?, ?)`,
                    [id, query, focusMode, Date.now()]
                );
            } catch (err) {
                console.error('saveSearch Fail', err);
            }
        });
    },

    getRecentSearches: async (limit: number = 10) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                // Create table if not exists
                await db.execAsync(`
                    CREATE TABLE IF NOT EXISTS searches (
                        id TEXT PRIMARY KEY,
                        query TEXT NOT NULL,
                        focusMode TEXT,
                        timestamp INTEGER
                    );
                `);

                const rows = await db.getAllAsync<any>(
                    `SELECT * FROM searches ORDER BY timestamp DESC LIMIT ?`,
                    [limit]
                );
                return rows;
            } catch (err) {
                console.error('getRecentSearches Fail', err);
                return [];
            }
        });
    },

    deleteSearch: async (id: string) => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(
                    `DELETE FROM searches WHERE id = ?`,
                    [id]
                );
            } catch (err) {
                console.error('deleteSearch Fail', err);
            }
        });
    },

    clearSearchHistory: async () => {
        if (!initPromise) await DatabaseService.init();
        await initPromise;
        return runSerialized(async () => {
            try {
                await db.runAsync(`DELETE FROM searches`);
            } catch (err) {
                console.error('clearSearchHistory Fail', err);
            }
        });
    }
};
