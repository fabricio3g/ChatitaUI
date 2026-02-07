/**
 * Mini-App Types
 * Full-screen interactive apps that launch from the chat input menu
 */

import { Message } from '../../types/message';

export type MiniAppMode = 'local' | 'api' | 'auto';
export type DeviceTier = 'low' | 'medium' | 'high';

export interface DeviceCapabilities {
  tier: DeviceTier;
  canRunLocalLLM: boolean;
  canRunLocalVision: boolean;
  hasGPUSupport: boolean;
  availableRAM: number; // MB
}

export interface MiniAppDefinition {
  id: string;
  label: string;
  icon: string; // Feather icon name
  description: string;
  category: 'primary' | 'secondary';
  modes: {
    local?: boolean;
    api?: boolean;
  };
  requiresInternet?: boolean;
  minDeviceTier?: DeviceTier;
}

export interface MiniAppResult {
  type: 'text' | 'image' | 'quiz_result' | 'canvas_image' | 'study_plan' | 'research_result' | 'deep_research' | 'deep_research_progress';
  content: string;
  data?: any;
}

export interface MiniAppProps {
  visible: boolean;
  onClose: () => void;
  onShareToChat?: (result: MiniAppResult) => void;
  deviceTier: DeviceTier;
  preferredMode: MiniAppMode;
  isOnline: boolean;
  conversationId: string;
  messages: Message[];
}
