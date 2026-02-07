import { Tool, ToolDefinition, ToolResponse } from './types';

export class MediaTool implements Tool {
    definition: ToolDefinition = {
        name: 'play_media',
        description: 'Search and play music or videos from Spotify/YouTube.',
        renderType: 'media',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Song name, artist, or video title'
                },
                platform: {
                    type: 'string',
                    enum: ['spotify', 'youtube'],
                    description: 'Preferred platform (default spotify)'
                }
            },
            required: ['query']
        }
    };

    async execute(params: { query: string; platform?: string }): Promise<ToolResponse> {
        const platform = params.platform || 'spotify';

        // Mocked response for demo - In production would verify via API
        // We return data that the UI uses to render a "Now Playing" card

        return {
            type: 'media',
            content: `Found "${params.query}" on ${platform}`,
            data: {
                platform,
                title: params.query,
                artist: 'Unknown Artist', // In real app, fetch this
                coverUrl: platform === 'spotify'
                    ? 'https://misc.scdn.co/liked-songs/liked-songs-64.png'
                    : 'https://img.youtube.com/vi/placeholder/hqdefault.jpg',
                url: platform === 'spotify'
                    ? `https://open.spotify.com/search/${encodeURIComponent(params.query)}`
                    : `https://www.youtube.com/results?search_query=${encodeURIComponent(params.query)}`
            }
        };
    }
}
