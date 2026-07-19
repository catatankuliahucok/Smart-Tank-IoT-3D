export interface TankConfig {
  maxVolume: number; // e.g., 1000 Liters
  highThreshold: number; // in Liters
  lowThreshold: number; // in Liters
}

export interface MqttConfig {
  broker: string;
  port: number;
  clientId: string;
  topicVolume: string;
  topicPump: string;
  topicStatus: string;
}

export interface WifiConfig {
  ssid: string;
  pass: string;
}

export interface HardwareConfig {
  pinTrig: number;
  pinEcho: number;
  pinRelay: number;
}

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  themePreset: 'blue-tech' | 'emerald-clean' | 'cyberpunk' | 'monochrome';
  ambientIntensity: number; // 0.1 to 1.5
  lightColor: string; // Hex color for active light
}

export type ControlMode = 'AUTOMATIC' | 'MANUAL';
export type PumpStatus = 'ON' | 'OFF';

export interface DeviceState {
  currentVolume: number; // in Liters
  pumpStatus: PumpStatus;
  controlMode: ControlMode;
  isOnline: boolean;
  lastUpdate: string;
}

export interface MqttMessage {
  id: string;
  topic: string;
  payload: string;
  timestamp: string;
  type: 'incoming' | 'outgoing' | 'system';
}
