/**
 * Mini-App Registry
 * Manages all available mini-apps
 */

import { MiniAppDefinition, DeviceTier } from './MiniAppTypes';

// Mini-app definitions (components are separate)
export const MINI_APPS: MiniAppDefinition[] = [
  // Primary menu
  {
    id: 'quiz',
    label: 'Quiz',
    icon: 'help-circle',
    description: 'Interactive quizzes',
    category: 'primary',
    modes: { local: true, api: true },
  },
  {
    id: 'image_gen',
    label: 'Create Image',
    icon: 'image',
    description: 'Generate images with AI',
    category: 'primary',
    modes: { local: false, api: true },
    requiresInternet: true,
  },
  {
    id: 'deep_research',
    label: 'Deep Research',
    icon: 'search',
    description: 'Deep research with sources',
    category: 'primary',
    modes: { local: true, api: true },
  },

  // Secondary menu - only items that are fully implemented
  {
    id: 'web_search',
    label: 'Web Search',
    icon: 'globe',
    description: 'Search for current information',
    category: 'secondary',
    modes: { local: false, api: true },
    requiresInternet: true,
  },
  // TODO: Re-add when implemented:
  // - study (Study & Learn) - needs StudyMiniApp with Active Recall / Spaced Repetition / Feynman
  // - canvas (Canvas) - needs CanvasMiniApp
  // - apps (Explore Apps) - needs app discovery feature
];

// Top action items (optional)
export const TOP_ACTIONS: Array<{ id: string; label: string; icon: string }> = [];

class MiniAppRegistryClass {
  getAll(): MiniAppDefinition[] {
    return MINI_APPS;
  }

  getPrimary(): MiniAppDefinition[] {
    return MINI_APPS.filter(app => app.category === 'primary');
  }

  getSecondary(): MiniAppDefinition[] {
    return MINI_APPS.filter(app => app.category === 'secondary');
  }

  get(id: string): MiniAppDefinition | undefined {
    return MINI_APPS.find(app => app.id === id);
  }

  isAvailable(appId: string, isOnline: boolean, deviceTier: DeviceTier): boolean {
    const app = this.get(appId);
    if (!app) return false;

    // Check internet requirement
    if (app.requiresInternet && !isOnline) return false;

    // Check device tier
    if (app.minDeviceTier) {
      const tiers: DeviceTier[] = ['low', 'medium', 'high'];
      if (tiers.indexOf(deviceTier) < tiers.indexOf(app.minDeviceTier)) {
        return false;
      }
    }

    return true;
  }
}

export const MiniAppRegistry = new MiniAppRegistryClass();
