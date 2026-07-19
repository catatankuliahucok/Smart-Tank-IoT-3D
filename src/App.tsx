import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  Wifi,
  Radio,
  Sliders,
  Sun,
  Moon,
  RotateCcw,
  Check,
  Sparkles,
  Droplets,
  Play,
  Pause,
  Terminal,
  Settings,
  AlertTriangle,
  Info,
  HelpCircle,
  Code2
} from 'lucide-react';
import {
  TankConfig,
  MqttConfig,
  WifiConfig,
  HardwareConfig,
  ThemeConfig,
  DeviceState,
  MqttMessage,
  PumpStatus,
  ControlMode
} from './types';
import { ThreeDView } from './components/ThreeDView';
import { MqttPanel } from './components/MqttPanel';
import { CodeGenerator } from './components/CodeGenerator';
import { ThemeManager, THEME_PRESETS } from './components/ThemeManager';

// Initial Factory Defaults
const DEFAULT_TANK_CONFIG: TankConfig = {
  maxVolume: 1000,
  highThreshold: 900,
  lowThreshold: 200,
};

const DEFAULT_MQTT_CONFIG: MqttConfig = {
  broker: 'broker.emqx.io',
  port: 1883,
  clientId: 'ESP32_WaterTank_Twin',
  topicVolume: 'tank/volume',
  topicPump: 'tank/pump',
  topicStatus: 'tank/status',
};

const DEFAULT_WIFI_CONFIG: WifiConfig = {
  ssid: 'Smart_Clinic_WiFi',
  pass: 'AksesMedis2026',
};

const DEFAULT_HARDWARE_CONFIG: HardwareConfig = {
  pinTrig: 5,
  pinEcho: 18,
  pinRelay: 19,
};

const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'auto',
  themePreset: 'blue-tech',
  ambientIntensity: 1.0,
  lightColor: '#38bdf8',
};

export default function App() {
  // --- Persistent States from Local Storage or Defaults ---
  const [tankConfig, setTankConfig] = useState<TankConfig>(() => {
    const saved = localStorage.getItem('smart_tank_config');
    return saved ? JSON.parse(saved) : DEFAULT_TANK_CONFIG;
  });

  const [mqttConfig, setMqttConfig] = useState<MqttConfig>(() => {
    const saved = localStorage.getItem('smart_mqtt_config');
    return saved ? JSON.parse(saved) : DEFAULT_MQTT_CONFIG;
  });

  const [wifiConfig, setWifiConfig] = useState<WifiConfig>(() => {
    const saved = localStorage.getItem('smart_wifi_config');
    return saved ? JSON.parse(saved) : DEFAULT_WIFI_CONFIG;
  });

  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>(() => {
    const saved = localStorage.getItem('smart_hw_config');
    return saved ? JSON.parse(saved) : DEFAULT_HARDWARE_CONFIG;
  });

  const [theme, setTheme] = useState<ThemeConfig>(() => {
    const saved = localStorage.getItem('smart_theme_config');
    return saved ? JSON.parse(saved) : DEFAULT_THEME_CONFIG;
  });

  // --- Real-Time Device States ---
  const [deviceState, setDeviceState] = useState<DeviceState>({
    currentVolume: 650, // Starts at a realistic volume
    pumpStatus: 'OFF',
    controlMode: 'AUTOMATIC',
    isOnline: true,
    lastUpdate: new Date().toLocaleTimeString(),
  });

  // --- MQTT Simulation Logs ---
  const [mqttMessages, setMqttMessages] = useState<MqttMessage[]>([]);

  // --- Simulator Variables ---
  const [isDraining, setIsDraining] = useState<boolean>(true); // Drainage active by default to see dynamics
  const [drainRate, setDrainRate] = useState<number>(10); // L/s
  const [pumpFlowRate, setPumpFlowRate] = useState<number>(25); // L/s
  
  // Tabs for layout organization
  const [activeTab, setActiveTab] = useState<'dash' | 'mqtt' | 'code' | 'theme'>('dash');
  const [saveToast, setSaveToast] = useState<string>('');
  const [latexCopied, setLatexCopied] = useState<boolean>(false);

  const latexFormula = `% Formula Perhitungan Volume Air pada Tangki Silinder
% Menggunakan pembacaan jarak dari Sensor Ultrasonik HC-SR04

\\begin{equation}
V = \\pi \\cdot r^2 \\cdot h
\\end{equation}

\\text{dimana:} \\\\
h = H_{\\text{total}} - d

\\text{Sehingga, formula lengkapnya adalah:} \\\\
\\begin{equation}
V = \\pi \\cdot r^2 \\cdot (H_{\\text{total}} - d)
\\end{equation}

\\text{Untuk konversi ke satuan Liter (jika dimensi dalam cm):} \\\\
\\begin{equation}
V_{\\text{liter}} = \\frac{\\pi \\cdot r^2 \\cdot (H_{\\text{total}} - d)}{1000}
\\end{equation}`;

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latexFormula);
    setLatexCopied(true);
    setTimeout(() => setLatexCopied(false), 2000);
  };

  const activePreset = THEME_PRESETS.find(p => p.id === theme.themePreset) || THEME_PRESETS[0];

  // Auto-Save Effect
  useEffect(() => {
    localStorage.setItem('smart_tank_config', JSON.stringify(tankConfig));
    localStorage.setItem('smart_mqtt_config', JSON.stringify(mqttConfig));
    localStorage.setItem('smart_wifi_config', JSON.stringify(wifiConfig));
    localStorage.setItem('smart_hw_config', JSON.stringify(hardwareConfig));
    localStorage.setItem('smart_theme_config', JSON.stringify(theme));
    
    // Brief automatic saving indicator
    setSaveToast('Semua perubahan disimpan otomatis');
    const t = setTimeout(() => setSaveToast(''), 1500);
    return () => clearTimeout(t);
  }, [tankConfig, mqttConfig, wifiConfig, hardwareConfig, theme]);

  // --- Physics Simulator Loop ---
  // Updates every 1 second to simulate fluid mechanics and closed loop logic
  useEffect(() => {
    const interval = setInterval(() => {
      setDeviceState((prev) => {
        let nextVol = prev.currentVolume;

        // Apply Pump Inflow
        if (prev.pumpStatus === 'ON') {
          nextVol += pumpFlowRate;
        }

        // Apply Drainage Outflow
        if (isDraining) {
          nextVol -= drainRate;
        }

        // Keep volume within physical bounds [0, maxVolume]
        if (nextVol > tankConfig.maxVolume) nextVol = tankConfig.maxVolume;
        if (nextVol < 0) nextVol = 0;

        let nextPumpStatus = prev.pumpStatus;

        // Apply Closed-Loop Hysteresis Logic under AUTOMATIC Mode
        if (prev.controlMode === 'AUTOMATIC') {
          if (nextVol <= tankConfig.lowThreshold && prev.pumpStatus === 'OFF') {
            nextPumpStatus = 'ON';
            injectMqttMessage(
              mqttConfig.topicStatus,
              `{"event":"hysteresis_trigger","action":"pump_on","reason":"volume(${Math.round(nextVol)}L) <= min(${tankConfig.lowThreshold}L)"}`,
              'system'
            );
            injectMqttMessage(mqttConfig.topicPump, 'ON', 'outgoing');
          } else if (nextVol >= tankConfig.highThreshold && prev.pumpStatus === 'ON') {
            nextPumpStatus = 'OFF';
            injectMqttMessage(
              mqttConfig.topicStatus,
              `{"event":"hysteresis_trigger","action":"pump_off","reason":"volume(${Math.round(nextVol)}L) >= max(${tankConfig.highThreshold}L)"}`,
              'system'
            );
            injectMqttMessage(mqttConfig.topicPump, 'OFF', 'outgoing');
          }
        }

        // Periodic telemetry publication simulation (every tick)
        if (Math.random() > 0.6) {
          injectMqttMessage(mqttConfig.topicVolume, `${Math.round(nextVol)}`, 'incoming');
        }

        return {
          ...prev,
          currentVolume: Math.round(nextVol),
          pumpStatus: nextPumpStatus,
          lastUpdate: new Date().toLocaleTimeString(),
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDraining, drainRate, pumpFlowRate, tankConfig, mqttConfig]);

  // Sync auto theme class to html based on current configuration
  useEffect(() => {
    const applyTheme = () => {
      const html = document.documentElement;
      if (theme.mode === 'dark') {
        html.classList.add('dark');
      } else if (theme.mode === 'light') {
        html.classList.remove('dark');
      } else {
        // Auto: 6pm to 6am is dark
        const hour = new Date().getHours();
        if (hour >= 18 || hour < 6) {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      }
    };
    applyTheme();
  }, [theme.mode]);

  // --- MQTT Log Injector ---
  const injectMqttMessage = (topic: string, payload: string, type: 'incoming' | 'outgoing' | 'system') => {
    const newMsg: MqttMessage = {
      id: Math.random().toString(36).substr(2, 9),
      topic,
      payload,
      timestamp: new Date().toLocaleTimeString(),
      type,
    };
    setMqttMessages((prev) => [newMsg, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  // Triggered when client manually publishes command from MQTT panel
  const handleMqttSendMessage = (topic: string, payload: string) => {
    injectMqttMessage(topic, payload, 'outgoing');
    
    // Command listener emulation (matches ESP32 callback)
    if (topic === mqttConfig.topicPump) {
      const upPayload = payload.toUpperCase();
      if (upPayload === 'ON') {
        setDeviceState((prev) => ({
          ...prev,
          pumpStatus: 'ON',
          controlMode: 'MANUAL', // Manually turning ON overrides auto
        }));
        injectMqttMessage(mqttConfig.topicStatus, '{"mode":"MANUAL","pump":"ON"}', 'system');
      } else if (upPayload === 'OFF') {
        setDeviceState((prev) => ({
          ...prev,
          pumpStatus: 'OFF',
          controlMode: 'MANUAL',
        }));
        injectMqttMessage(mqttConfig.topicStatus, '{"mode":"MANUAL","pump":"OFF"}', 'system');
      } else if (upPayload === 'AUTO') {
        setDeviceState((prev) => ({
          ...prev,
          controlMode: 'AUTOMATIC',
        }));
        injectMqttMessage(mqttConfig.topicStatus, '{"mode":"AUTOMATIC"}', 'system');
      }
    }
  };

  // Simulates external sensor value update
  const handleSimulateTelemetry = (volume: number) => {
    setDeviceState((prev) => ({
      ...prev,
      currentVolume: volume,
    }));
    injectMqttMessage(mqttConfig.topicVolume, `${volume}`, 'incoming');
  };

  const handleToggleMode = () => {
    setDeviceState((prev) => {
      const newMode: ControlMode = prev.controlMode === 'AUTOMATIC' ? 'MANUAL' : 'AUTOMATIC';
      injectMqttMessage(mqttConfig.topicPump, newMode, 'outgoing');
      return {
        ...prev,
        controlMode: newMode,
      };
    });
  };

  const handleTogglePump = () => {
    if (deviceState.controlMode === 'AUTOMATIC') {
      // Prompt user that manual toggle switches them to Manual Mode
      setDeviceState((prev) => {
        const nextStatus: PumpStatus = prev.pumpStatus === 'ON' ? 'OFF' : 'ON';
        injectMqttMessage(mqttConfig.topicPump, nextStatus, 'outgoing');
        return {
          ...prev,
          controlMode: 'MANUAL',
          pumpStatus: nextStatus,
        };
      });
    } else {
      setDeviceState((prev) => {
        const nextStatus: PumpStatus = prev.pumpStatus === 'ON' ? 'OFF' : 'ON';
        injectMqttMessage(mqttConfig.topicPump, nextStatus, 'outgoing');
        return {
          ...prev,
          pumpStatus: nextStatus,
        };
      });
    }
  };

  // Reset entire dashboard back to Factory Settings
  const handleResetToDefaults = () => {
    if (window.confirm('Apakah Anda yakin ingin mengatur ulang semua konfigurasi dan tema ke bawaan pabrik?')) {
      localStorage.removeItem('smart_tank_config');
      localStorage.removeItem('smart_mqtt_config');
      localStorage.removeItem('smart_wifi_config');
      localStorage.removeItem('smart_hw_config');
      localStorage.removeItem('smart_theme_config');
      
      setTankConfig(DEFAULT_TANK_CONFIG);
      setMqttConfig(DEFAULT_MQTT_CONFIG);
      setWifiConfig(DEFAULT_WIFI_CONFIG);
      setHardwareConfig(DEFAULT_HARDWARE_CONFIG);
      setTheme(DEFAULT_THEME_CONFIG);
      setDeviceState({
        currentVolume: 650,
        pumpStatus: 'OFF',
        controlMode: 'AUTOMATIC',
        isOnline: true,
        lastUpdate: new Date().toLocaleTimeString(),
      });
      setMqttMessages([]);
      setSaveToast('Sistem berhasil dipulihkan!');
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-300 font-sans grid-overlay transition-colors duration-300 flex flex-col justify-between">
      <div>
        {/* Technical Dashboard Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-[#0a0c10] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded flex items-center justify-center glow-blue text-cyan-400">
                <Droplets className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-xs font-bold tracking-widest text-white uppercase">
                    Smart-Tank Digital Twin v2.4
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[8px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                    CONNECTED (MQTT)
                  </span>
                </div>
                <p className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase mt-0.5">
                  STATION_ID: XA-9082 // REGION_ONLINE
                </p>
              </div>
            </div>

            {/* Right section with technical live stats */}
            <div className="hidden md:flex gap-6 items-center text-[10px] font-mono mr-4">
              <div className="flex flex-col items-end">
                <span className="text-slate-500 uppercase">Uptime</span>
                <span className="text-white italic font-semibold">12d 04h 22m</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-slate-500 uppercase">API Latency</span>
                <span className="text-emerald-400 italic font-semibold">14ms</span>
              </div>
            </div>

            {/* Nav Links Tabs in technical block style */}
            <nav className="flex items-center gap-1.5 font-mono text-[10px]">
              <button
                onClick={() => setActiveTab('dash')}
                className={`px-3 py-2 rounded font-semibold transition-all cursor-pointer uppercase tracking-widest ${
                  activeTab === 'dash'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
                }`}
                id="tab-dash"
              >
                Twin 3D
              </button>
              <button
                onClick={() => setActiveTab('mqtt')}
                className={`px-3 py-2 rounded font-semibold transition-all cursor-pointer uppercase tracking-widest ${
                  activeTab === 'mqtt'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
                }`}
                id="tab-mqtt"
              >
                MQTT Panel
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-2 rounded font-semibold transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-widest ${
                  activeTab === 'code'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
                }`}
                id="tab-code"
              >
                <Cpu className="w-3.5 h-3.5" />
                ESP32 Code
              </button>
              <button
                onClick={() => setActiveTab('theme')}
                className={`px-3 py-2 rounded font-semibold transition-all cursor-pointer uppercase tracking-widest ${
                  activeTab === 'theme'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                    : 'text-slate-400 hover:text-white border border-transparent hover:bg-white/5'
                }`}
                id="tab-theme"
              >
                Tema
              </button>
            </nav>
          </div>
        </header>

        {/* Technical save notification pop */}
        {saveToast && (
          <div className="fixed bottom-10 right-6 z-50 bg-[#0a0c10] text-cyan-400 text-xs px-4 py-2.5 rounded shadow-lg flex items-center gap-2 border border-cyan-500/30 animate-fadeIn font-mono">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>{saveToast}</span>
          </div>
        )}

        {/* Primary Workspace Stage */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10">
          
          {/* Dynamic Transition Canvas Area */}
          <div className="space-y-6">
            
            {/* TAB 1: TWIN 3D DASHBOARD */}
            {activeTab === 'dash' && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                
                {/* 3D Babylon stage representation */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <ThreeDView
                    deviceState={deviceState}
                    tankConfig={tankConfig}
                    theme={theme}
                    isDraining={isDraining}
                    onThresholdChange={(type, val) => {
                      if (type === 'MIN') {
                        setTankConfig(prev => ({ ...prev, lowThreshold: val }));
                      } else {
                        setTankConfig(prev => ({ ...prev, highThreshold: val }));
                      }
                    }}
                  />

                  {/* Physics Simulator Water Flow Rates controller card */}
                  <div className="bg-[#080a0e] border border-white/10 p-5 rounded-lg grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Laju Aliran Pompa
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={pumpFlowRate}
                          onChange={(e) => setPumpFlowRate(parseInt(e.target.value))}
                          className="flex-1 h-1 bg-white/10 rounded appearance-none cursor-pointer accent-cyan-500"
                          id="slider-pump-flow"
                        />
                        <span className="text-xs font-mono font-bold text-cyan-400 w-12 text-right">
                          +{pumpFlowRate}L/s
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                        <span>Laju Pengurasan Tangki</span>
                        <button
                          onClick={() => setIsDraining(!isDraining)}
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase cursor-pointer ${
                            isDraining
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                              : 'bg-white/5 border-white/10 text-slate-400'
                          }`}
                          id="btn-toggle-drain"
                        >
                          {isDraining ? 'Kran Buka' : 'Kran Tutup'}
                        </button>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="2"
                          value={drainRate}
                          disabled={!isDraining}
                          onChange={(e) => setDrainRate(parseInt(e.target.value))}
                          className="flex-1 h-1 bg-white/10 rounded appearance-none cursor-pointer accent-cyan-500 disabled:opacity-30"
                          id="slider-drain-flow"
                        />
                        <span className={`text-xs font-mono font-bold w-12 text-right ${isDraining ? 'text-cyan-400' : 'text-slate-500'}`}>
                          -{isDraining ? drainRate : 0}L/s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Float digital control panel overlay side columns */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  
                  {/* Gauge & Volume Panel */}
                  <div className="bg-[#080a0e] border border-white/10 rounded-lg p-6 relative overflow-hidden">
                    {/* Glowing background highlights */}
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <h3 className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Volume Air Saat Ini
                        </h3>
                        <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                          Sensor HC-SR04 // TELEMETRIC VALUE
                        </p>
                      </div>
                      <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        SYNC: ACTIVE
                      </span>
                    </div>

                    {/* Circular visual gauge bar */}
                    <div className="flex flex-col items-center justify-center py-6 relative">
                      <div className="relative w-44 h-44 flex items-center justify-center">
                        
                        {/* SVG Gauge Circle */}
                        <svg className="w-full h-full transform -rotate-90">
                          {/* Track ring */}
                          <circle
                            cx="88"
                            cy="88"
                            r="76"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            className="text-white/5"
                          />
                          {/* Active ring */}
                          <circle
                            cx="88"
                            cy="88"
                            r="76"
                            strokeWidth="10"
                            stroke={activePreset.accentColor}
                            strokeDasharray={477.5}
                            strokeDashoffset={477.5 - (477.5 * (deviceState.currentVolume / tankConfig.maxVolume))}
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>

                        {/* Display Texts */}
                        <div className="absolute text-center">
                          <span className="block text-4xl font-light italic font-mono tracking-tight text-white">
                            {deviceState.currentVolume}L
                          </span>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 mt-1 block">
                            {Math.round((deviceState.currentVolume / tankConfig.maxVolume) * 100)}% Ketinggian
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Indicator grid summary */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                      <div className="bg-white/5 border border-white/5 p-3 rounded">
                        <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Status Pompa</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-2 h-2 rounded-full ${deviceState.pumpStatus === 'ON' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-600'}`} />
                          <span className="font-mono font-bold text-xs text-white">
                            {deviceState.pumpStatus}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/5 p-3 rounded">
                        <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">Mode Kontrol</span>
                        <span className="block font-mono font-bold text-xs text-white mt-1">
                          {deviceState.controlMode}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Microcontroller Physical Casing Panel Controls */}
                  <div className="bg-[#080a0e] border border-white/10 rounded-lg p-6">
                    <h3 className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Panel Kontrol Digital Twin
                    </h3>
                    
                    <div className="space-y-4">
                      
                      {/* Mode Toggle Button */}
                      <div className="flex items-center justify-between p-3.5 bg-white/5 rounded border border-white/5">
                        <div>
                          <span className="block font-mono text-xs font-semibold text-white">Mode Sistem</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {deviceState.controlMode === 'AUTOMATIC' 
                              ? 'Otomatisasi penuh via ambang batas histeresis'
                              : 'Pompa dikendalikan secara manual oleh operator'}
                          </p>
                        </div>
                        <button
                          onClick={handleToggleMode}
                          className={`px-3.5 py-1.5 text-[10px] font-mono font-semibold rounded cursor-pointer transition-all border ${
                            deviceState.controlMode === 'AUTOMATIC'
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                          id="btn-toggle-system-mode"
                        >
                          {deviceState.controlMode}
                        </button>
                      </div>

                      {/* Pump Actuator Toggle */}
                      <div className="flex items-center justify-between p-3.5 bg-white/5 rounded border border-white/5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="block font-mono text-xs font-semibold text-white">Relay Pompa Air</span>
                            {deviceState.controlMode === 'AUTOMATIC' && (
                              <span className="text-[8px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/25">AUTO</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Menggerakkan sakelar relay listrik fisik pompa air
                          </p>
                        </div>
                        <button
                          onClick={handleTogglePump}
                          className={`px-3.5 py-1.5 text-[10px] font-mono font-semibold rounded cursor-pointer transition-all border ${
                            deviceState.pumpStatus === 'ON'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                          id="btn-toggle-pump-actuator"
                        >
                          {deviceState.pumpStatus === 'ON' ? 'AKTIF (ON)' : 'MATI (OFF)'}
                        </button>
                      </div>

                      {/* Motorized Valve Control */}
                      <div className="flex items-center justify-between p-3.5 bg-white/5 rounded border border-white/5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="block font-mono text-xs font-semibold text-white">Motorized Valve (Katup Drain)</span>
                            {isDraining && (
                              <span className="text-[8px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/25">OPEN</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Mengatur status kran elektrik motorized valve untuk pembuangan air
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setIsDraining(!isDraining);
                            injectMqttMessage(mqttConfig.topicStatus, `{"event":"valve_toggle","state":"${!isDraining ? 'OPEN' : 'CLOSED'}"}`, 'system');
                          }}
                          className={`px-3.5 py-1.5 text-[10px] font-mono font-semibold rounded cursor-pointer transition-all border ${
                            isDraining
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                          id="btn-toggle-valve-actuator"
                        >
                          {isDraining ? 'BUKA (OPEN)' : 'TUTUP (CLOSED)'}
                        </button>
                      </div>

                      {/* Adjustable Thresholds section */}
                      <div className="border border-white/5 bg-white/5 rounded p-4 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">Ambang Batas Pengaman (Histeresis)</span>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-500" title="Atur batas level air untuk mengaktifkan dan mematikan pompa secara otomatis." />
                        </div>

                        {/* HIGH Threshold */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-rose-400 font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Garis Merah (Ambang Atas - MAX)
                            </span>
                            <span className="font-mono font-bold text-slate-300">
                              {tankConfig.highThreshold}L ({Math.round((tankConfig.highThreshold / tankConfig.maxVolume) * 100)}%)
                            </span>
                          </div>
                          <input
                            type="range"
                            min={tankConfig.lowThreshold + 50}
                            max={tankConfig.maxVolume}
                            step="10"
                            value={tankConfig.highThreshold}
                            onChange={(e) => setTankConfig({ ...tankConfig, highThreshold: parseInt(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-rose-500"
                            id="slider-high-threshold"
                          />
                        </div>

                        {/* LOW Threshold */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-400 font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Garis Kuning (Ambang Bawah - MIN)
                            </span>
                            <span className="font-mono font-bold text-slate-300">
                              {tankConfig.lowThreshold}L ({Math.round((tankConfig.lowThreshold / tankConfig.maxVolume) * 100)}%)
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={tankConfig.highThreshold - 50}
                            step="10"
                            value={tankConfig.lowThreshold}
                            onChange={(e) => setTankConfig({ ...tankConfig, lowThreshold: parseInt(e.target.value) })}
                            className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-amber-500"
                            id="slider-low-threshold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Formula & LaTeX Panel */}
              <div className="mt-6 bg-[#080a0e] border border-white/10 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute -top-12 -left-12 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-white/5">
                  <div>
                    <h3 className="font-mono text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                      Formula Matematika & Kalkulasi Volume Air (LaTeX)
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-mono">
                      Metode Geometri Silinder Terhadap Pembacaan Sensor Ultrasonik HC-SR04
                    </p>
                  </div>
                  
                  <button
                    onClick={handleCopyLatex}
                    className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                      latexCopied
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${latexCopied ? 'block' : 'hidden'}`} />
                    <span>{latexCopied ? 'LaTeX Tersalin!' : 'Salin Kode LaTeX'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Beautiful Math Rendering using standard styled text & flex */}
                  <div className="lg:col-span-7 space-y-5 bg-white/5 border border-white/5 p-5 rounded-lg text-left">
                    <span className="block text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500">Render Persamaan (Tampilan LaTeX)</span>
                    
                    {/* Render 1: h = H_total - d */}
                    <div className="flex flex-col items-center justify-center py-3 bg-black/30 rounded border border-white/5">
                      <div className="font-serif text-lg text-slate-200 italic flex items-center gap-2">
                        <span>h</span>
                        <span>=</span>
                        <span>H<sub>total</sub></span>
                        <span>-</span>
                        <span>d</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-wider">Tinggi kolom air aktual</span>
                    </div>

                    {/* Render 2: V = pi * r^2 * h */}
                    <div className="flex flex-col items-center justify-center py-4 bg-black/30 rounded border border-white/5">
                      <div className="font-serif text-xl text-cyan-300 italic flex items-center gap-1">
                        <span>V</span>
                        <span>=</span>
                        <span className="font-sans font-normal text-lg">π</span>
                        <span>·</span>
                        <span>r<sup>2</sup></span>
                        <span>·</span>
                        <span>(H<sub>total</sub> - d)</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-wider">Volume air dalam tangki silinder</span>
                    </div>

                    {/* Live Calculation block */}
                    <div className="border-t border-white/5 pt-4">
                      <span className="block text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-3">Kalkulasi Numerik Real-Time</span>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="bg-white/5 p-2.5 rounded border border-white/5">
                          <span className="block text-[9px] text-slate-500 uppercase">Tinggi Max (H)</span>
                          <span className="block font-bold text-white mt-0.5">200.0 cm</span>
                        </div>
                        <div className="bg-white/5 p-2.5 rounded border border-white/5">
                          <span className="block text-[9px] text-slate-500 uppercase">Radius (r)</span>
                          <span className="block font-bold text-white mt-0.5">39.89 cm</span>
                        </div>
                        <div className="bg-white/5 p-2.5 rounded border border-white/5">
                          <span className="block text-[9px] text-slate-500 uppercase">Jarak Sensor (d)</span>
                          <span className="block font-bold text-rose-400 mt-0.5">
                            {Math.round(200 * (1 - deviceState.currentVolume / tankConfig.maxVolume) * 10) / 10} cm
                          </span>
                        </div>
                        <div className="bg-white/5 p-2.5 rounded border border-white/5">
                          <span className="block text-[9px] text-slate-500 uppercase">Tinggi Air (h)</span>
                          <span className="block font-bold text-emerald-400 mt-0.5">
                            {Math.round(200 * (deviceState.currentVolume / tankConfig.maxVolume) * 10) / 10} cm
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-cyan-500/5 rounded border border-cyan-500/20 font-mono text-xs text-left">
                        <span className="text-slate-400 block mb-1 uppercase text-[9px] font-bold">Substitusi Nilai Aktual:</span>
                        <div className="text-cyan-400 overflow-x-auto whitespace-nowrap">
                          V = 3.14159 × (39.89 cm)² × ({Math.round(200 * (deviceState.currentVolume / tankConfig.maxVolume) * 10) / 10} cm) ÷ 1000 = <strong className="text-white text-sm">{deviceState.currentVolume} L</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Code Block for LaTeX */}
                  <div className="lg:col-span-5 flex flex-col justify-between text-left">
                    <div className="h-full flex flex-col bg-black/50 border border-white/5 rounded-lg p-4 overflow-hidden">
                      <span className="block text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2">Kode Sumber LaTeX</span>
                      <pre className="text-[10px] font-mono text-purple-300 leading-relaxed overflow-y-auto max-h-[220px] bg-black/40 p-3 rounded border border-white/5 select-all whitespace-pre-wrap">
                        {latexFormula}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
              </>
            )}

            {/* TAB 2: MQTT BROKER SIMULATOR */}
            {activeTab === 'mqtt' && (
              <div className="animate-fadeIn">
                <MqttPanel
                  mqttConfig={mqttConfig}
                  messages={mqttMessages}
                  deviceState={deviceState}
                  onClearLogs={() => setMqttMessages([])}
                  onSendMessage={handleMqttSendMessage}
                  onSimulateTelemetry={handleSimulateTelemetry}
                />
              </div>
            )}

            {/* TAB 3: ESP32 CODE COMPILER */}
            {activeTab === 'code' && (
              <div className="animate-fadeIn">
                <CodeGenerator
                  wifiConfig={wifiConfig}
                  onWifiChange={setWifiConfig}
                  mqttConfig={mqttConfig}
                  onMqttChange={setMqttConfig}
                  hardwareConfig={hardwareConfig}
                  onHardwareChange={setHardwareConfig}
                  tankConfig={tankConfig}
                />
              </div>
            )}

            {/* TAB 4: THEME & COLOR PRESETS */}
            {activeTab === 'theme' && (
              <div className="max-w-2xl mx-auto animate-fadeIn">
                <ThemeManager
                  theme={theme}
                  onChange={setTheme}
                  onReset={handleResetToDefaults}
                />
              </div>
            )}

          </div>

          {/* Technical FAQ informational section */}
          <div className="mt-12 bg-[#080a0e] border border-white/10 rounded-lg p-6">
            <h3 className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Info className="w-5 h-5 text-cyan-400" />
              Panduan & Cara Kerja Sistem Digital Twin
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] font-mono text-slate-400 leading-relaxed">
              <div className="space-y-1.5 border-l-2 border-cyan-500/30 pl-4">
                <h4 className="font-semibold text-white uppercase tracking-wider">1. Sensor Jarak & Volume</h4>
                <p className="text-slate-500">
                  Sensor Ultrasonic HC-SR04 memancarkan gelombang suara ke bawah. Waktu pantul gelombang diukur untuk menghitung tinggi tangki yang kosong, yang kemudian dikonversi secara real-time menjadi volume liter air aktual.
                </p>
              </div>
              <div className="space-y-1.5 border-l-2 border-cyan-500/30 pl-4">
                <h4 className="font-semibold text-white uppercase tracking-wider">2. Logika Kontrol Histeresis</h4>
                <p className="text-slate-500">
                  Saat mode <strong className="text-cyan-400">OTOMATIS</strong> diaktifkan, mikrokontroler (ESP32) mematikan pompa air jika air menyentuh batas atas (MAX) dan menyalakannya lagi hanya jika air menyusut di bawah batas bawah (MIN) guna menghindari hentakan listrik berulang.
                </p>
              </div>
              <div className="space-y-1.5 border-l-2 border-cyan-500/30 pl-4">
                <h4 className="font-semibold text-white uppercase tracking-wider">3. Transmisi Nirkabel MQTT</h4>
                <p className="text-slate-500">
                  ESP32 terhubung ke Wi-Fi dan menyinkronkan data sensor ke Web Digital Twin via MQTT broker. Anda dapat menyalin kode pemrograman yang siap dikompilasi di Arduino IDE dari tab <strong className="text-cyan-400">"ESP32 Code"</strong>.
                </p>
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* Industrial Status Footer */}
      <footer className="h-7 bg-cyan-600 text-[#05070a] px-4 flex items-center justify-between text-[10px] font-mono font-bold uppercase select-none tracking-wider">
        <div className="flex gap-4">
          <span>● TWIN ENGINE OK</span>
          <span>● HARDWARE LINKED // 2.4GHz</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="opacity-80">V-Sync: ONLINE</span>
          <span className="bg-[#05070a]/10 px-2 py-0.5 rounded">0.14ms jitter</span>
        </div>
      </footer>
    </div>
  );
}
