export const MAP_THEMES = {
    mapcn: {
        dark: true,
        backgroundColor: '#000000', // True Black for seamless tile blending
        cardBackground: '#09090B', // Zinc 950
        borderColor: '#18181B', // Zinc 900
        accent: '#2DD4BF', // Teal 400 (Neon)
        textPrimary: '#FAFAFA',
        textSecondary: '#A1A1AA',
        // Carto Dark Matter (High Contrast)
        tileUrl: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png", // @2x for Retina/High DPI
    },
    osm_standard: {
        dark: false,
        backgroundColor: '#F4F4F5',
        cardBackground: '#FFFFFF',
        borderColor: '#E4E4E7',
        accent: '#3B82F6',
        textPrimary: '#18181B',
        textSecondary: '#71717A',
        // OSM Direct tiles block apps without User-Agent. Using Carto Voyager (OSM based) as a reliable alternative.
        tileUrl: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    },
    google: {
        dark: false,
        backgroundColor: '#F4F4F5', // Zinc 100
        cardBackground: '#FFFFFF',
        borderColor: '#E4E4E7', // Zinc 200
        accent: '#3B82F6', // Blue 500
        textPrimary: '#18181B',
        textSecondary: '#71717A',
        tileUrl: undefined, // Type compatibility
    }
};

// Custom JSON style for Google Maps to make it slightly cleaner but still "normal"
// Removes some clutter while keeping it recognizable
export const GOOGLE_MAP_STANDARD_STYLE = [
    {
        "featureType": "poi",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#747474" }]
    },
    {
        "featureType": "road.local",
        "elementType": "labels",
        "stylers": [{ "visibility": "simplified" }]
    }
];
