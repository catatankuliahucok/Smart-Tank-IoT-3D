import React, { useState } from 'react';
import { Cpu, Wifi, Radio, Sliders, Check, Copy, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { WifiConfig, MqttConfig, HardwareConfig, TankConfig } from '../types';

interface CodeGeneratorProps {
  wifiConfig: WifiConfig;
  onWifiChange: (wifi: WifiConfig) => void;
  mqttConfig: MqttConfig;
  onMqttChange: (mqtt: MqttConfig) => void;
  hardwareConfig: HardwareConfig;
  onHardwareChange: (hw: HardwareConfig) => void;
  tankConfig: TankConfig;
}

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({
  wifiConfig,
  onWifiChange,
  mqttConfig,
  onMqttChange,
  hardwareConfig,
  onHardwareChange,
  tankConfig,
}) => {
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const generateCode = async () => {
    setLoading(true);
    setError('');
    setGeneratedCode('');
    
    const messages = [
      'Menghubungkan ke Google Gemini AI...',
      'Membaca konfigurasi pin hardware...',
      'Mengintegrasikan protokol MQTT PubSubClient...',
      'Menyusun logika kontrol histeresis...',
      'Menyelesaikan penulisan firmware ESP32...'
    ];

    let currentMsgIdx = 0;
    setStatusMessage(messages[currentMsgIdx]);

    const interval = setInterval(() => {
      if (currentMsgIdx < messages.length - 1) {
        currentMsgIdx++;
        setStatusMessage(messages[currentMsgIdx]);
      }
    }, 1500);

    try {
      const response = await fetch('/api/generate-esp32', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wifiConfig,
          mqttConfig,
          hardwareConfig,
          tankConfig,
        }),
      });

      const data = await response.json();
      clearInterval(interval);

      if (response.ok) {
        setGeneratedCode(data.code || data.fallback);
        if (!data.code && data.fallback) {
          setError('Gagal memanggil Gemini. Menampilkan kode cadangan presisi tinggi.');
        }
      } else {
        setError(data.error || 'Terjadi kesalahan sistem.');
        setGeneratedCode(data.fallback || '');
      }
    } catch (err: any) {
      clearInterval(interval);
      setError('Gagal menyambung ke server API. Menampilkan kode cadangan offline.');
      // Offline fallback code generator
      const code = generateOfflineCode(wifiConfig, mqttConfig, hardwareConfig, tankConfig);
      setGeneratedCode(code);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadFile = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SmartWaterTank_ESP32.ino';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateOfflineCode = (
    wifi: WifiConfig,
    mqtt: MqttConfig,
    hw: HardwareConfig,
    tank: TankConfig
  ) => {
    // Basic fallback C++ code
    return `// Offline Generated Smart Water Tank Firmware for ESP32
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "${wifi.ssid}";
const char* password = "${wifi.pass}";
const char* mqtt_server = "${mqtt.broker}";
const int mqtt_port = ${mqtt.port};

#define PIN_TRIG ${hw.pinTrig}
#define PIN_ECHO ${hw.pinEcho}
#define PIN_RELAY ${hw.pinRelay}

// Logic Thresholds
const float TANK_MAX_VOLUME = ${tank.maxVolume};
const float LEVEL_HIGH = ${tank.highThreshold};
const float LEVEL_LOW = ${tank.lowThreshold};

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, LOW);
}

void loop() {
  // Logic execution loop
  delay(1000);
}`;
  };

  return (
    <div id="code-generator-section" className="bg-[#080a0e] border border-white/10 rounded-lg p-6 transition-all">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-mono text-xs font-bold text-white uppercase tracking-widest">
            Generator Firmware ESP32 (Gemini Powered)
          </h3>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
            Sesuaikan parameter hardware, Wi-Fi, dan MQTT lalu hasilkan kode siap pakai untuk mikrokontroler Anda.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Wi-Fi Configuration */}
          <div className="border border-white/5 bg-white/5 rounded p-4 space-y-3.5">
            <h4 className="font-mono font-bold text-[10px] uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              Konfigurasi Wi-Fi
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">SSID WiFi</label>
                <input
                  type="text"
                  value={wifiConfig.ssid}
                  onChange={(e) => onWifiChange({ ...wifiConfig, ssid: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  placeholder="SSID Wi-Fi Anda"
                  id="wifi-ssid-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={wifiConfig.pass}
                  onChange={(e) => onWifiChange({ ...wifiConfig, pass: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  placeholder="Password Wi-Fi"
                  id="wifi-pass-input"
                />
              </div>
            </div>
          </div>

          {/* MQTT Configuration */}
          <div className="border border-white/5 bg-white/5 rounded p-4 space-y-3.5">
            <h4 className="font-mono font-bold text-[10px] uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              Protokol MQTT Broker
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Broker Host</label>
                <input
                  type="text"
                  value={mqttConfig.broker}
                  onChange={(e) => onMqttChange({ ...mqttConfig, broker: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  placeholder="e.g. broker.emqx.io"
                  id="mqtt-broker-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Port</label>
                <input
                  type="number"
                  value={mqttConfig.port}
                  onChange={(e) => onMqttChange({ ...mqttConfig, port: parseInt(e.target.value) || 1883 })}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  placeholder="1883"
                  id="mqtt-port-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">MQTT Client ID</label>
              <input
                type="text"
                value={mqttConfig.clientId}
                onChange={(e) => onMqttChange({ ...mqttConfig, clientId: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                id="mqtt-client-id-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Topic Volume</label>
                <input
                  type="text"
                  value={mqttConfig.topicVolume}
                  onChange={(e) => onMqttChange({ ...mqttConfig, topicVolume: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:outline-none focus:border-cyan-500 text-slate-200"
                  id="mqtt-topic-vol-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Topic Pompa</label>
                <input
                  type="text"
                  value={mqttConfig.topicPump}
                  onChange={(e) => onMqttChange({ ...mqttConfig, topicPump: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:outline-none focus:border-cyan-500 text-slate-200"
                  id="mqtt-topic-pump-input"
                />
              </div>
            </div>
          </div>

          {/* Pin Configuration */}
          <div className="border border-white/5 bg-white/5 rounded p-4 space-y-3.5">
            <h4 className="font-mono font-bold text-[10px] uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Pemetaan Pin ESP32 (GPIO)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[9px] font-mono text-slate-400 mb-1 text-center">TRIG Pin</label>
                <input
                  type="number"
                  value={hardwareConfig.pinTrig}
                  onChange={(e) => onHardwareChange({ ...hardwareConfig, pinTrig: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs font-mono px-2 py-1.5 text-center border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  id="pin-trig-input"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono text-slate-400 mb-1 text-center">ECHO Pin</label>
                <input
                  type="number"
                  value={hardwareConfig.pinEcho}
                  onChange={(e) => onHardwareChange({ ...hardwareConfig, pinEcho: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs font-mono px-2 py-1.5 text-center border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  id="pin-echo-input"
                />
              </div>
              <div>
                <label className="block text-[9px] font-mono text-slate-400 mb-1 text-center">Relay Pompa</label>
                <input
                  type="number"
                  value={hardwareConfig.pinRelay}
                  onChange={(e) => onHardwareChange({ ...hardwareConfig, pinRelay: parseInt(e.target.value) || 0 })}
                  className="w-full text-xs font-mono px-2 py-1.5 text-center border border-white/10 bg-[#05070a] rounded focus:border-cyan-500 focus:outline-none text-slate-200"
                  id="pin-relay-input"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={generateCode}
            disabled={loading}
            className={`w-full font-mono font-bold text-xs py-3 px-4 rounded flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 uppercase tracking-widest ${
              loading
                ? 'bg-cyan-600/50 text-black/50 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-700 text-black'
            }`}
            id="btn-generate-firmware"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
            {loading ? 'Sedang Memproses...' : 'Hasilkan Kode dengan AI'}
          </button>
        </div>

        {/* Code View Column */}
        <div className="lg:col-span-7 flex flex-col h-[480px] lg:h-auto border border-white/10 rounded-lg overflow-hidden bg-[#05070a] text-slate-200">
          {/* Terminal / Code Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0a0c10] border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="text-[10px] font-mono text-slate-400 ml-1.5 uppercase tracking-wider">SmartWaterTank_ESP32.ino</span>
            </div>

            {generatedCode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-cyan-400 rounded transition-colors text-[10px] font-mono flex items-center gap-1 uppercase"
                  title="Salin Kode"
                  id="btn-copy-code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
                <button
                  onClick={downloadFile}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-cyan-400 rounded transition-colors text-[10px] font-mono flex items-center gap-1 uppercase"
                  title="Unduh Berkas"
                  id="btn-download-code"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh</span>
                </button>
              </div>
            )}
          </div>

          {/* Terminal Body */}
          <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed relative">
            {loading && (
              <div className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
                <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
                <p className="text-[11px] font-mono text-cyan-400 uppercase tracking-widest">{statusMessage}</p>
                <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider">Gemini sedang menyusun instruksi embedded yang optimal...</p>
              </div>
            )}

            {!loading && !generatedCode && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6 font-mono">
                <Cpu className="w-12 h-12 text-slate-800 mb-3 animate-pulse" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Belum Ada Kode yang Dihasilkan</p>
                <p className="text-[9px] mt-1 max-w-sm leading-relaxed uppercase tracking-normal">
                  Tekan tombol <strong className="text-cyan-400">"Hasilkan Kode dengan AI"</strong> untuk mensintesis kode mikrokontroler presisi tinggi dengan model Gemini 3.5.
                </p>
              </div>
            )}

            {!loading && generatedCode && (
              <div className="relative">
                {error && (
                  <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 flex items-start gap-2 font-mono">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="text-[10px] uppercase tracking-wider">{error}</span>
                  </div>
                )}
                <pre className="whitespace-pre select-all text-slate-300 leading-relaxed font-mono">
                  {generatedCode}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
