export interface DetectionSettings {
  useHybridDetection: boolean;
  useCraftPrimary: boolean;
  useDBNet: boolean;
}

const SETTINGS_KEY = 'pptx-converter-settings';

const DEFAULT_SETTINGS: DetectionSettings = {
  useHybridDetection: true,
  useCraftPrimary: false,
  useDBNet: false,
};

export function getDetectionSettings(): DetectionSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        useHybridDetection: parsed.useHybridDetection ?? DEFAULT_SETTINGS.useHybridDetection,
        useCraftPrimary: parsed.useCraftPrimary ?? DEFAULT_SETTINGS.useCraftPrimary,
        useDBNet: parsed.useDBNet ?? DEFAULT_SETTINGS.useDBNet,
      };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  return DEFAULT_SETTINGS;
}

export function saveDetectionSettings(settings: DetectionSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    console.log('Settings saved:', settings);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

export function getUseHybridDetection(): boolean {
  return getDetectionSettings().useHybridDetection;
}

export function getUseCraftPrimary(): boolean {
  return getDetectionSettings().useCraftPrimary;
}

export function getUseDBNet(): boolean {
  return getDetectionSettings().useDBNet;
}
