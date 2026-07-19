import React, { useState } from 'react';
import { Radio, ShieldAlert, Send, Terminal, Play, Circle, Trash2, CheckCircle } from 'lucide-react';
import { MqttConfig, MqttMessage, DeviceState } from '../types';

interface MqttPanelProps {
  mqttConfig: MqttConfig;
  messages: MqttMessage[];
  deviceState: DeviceState;
  onClearLogs: () => void;
  onSendMessage: (topic: string, payload: string) => void;
  onSimulateTelemetry: (volume: number) => void;
}

export const MqttPanel: React.FC<MqttPanelProps> = ({
  mqttConfig,
  messages,
  deviceState,
  onClearLogs,
  onSendMessage,
  onSimulateTelemetry,
}) => {
  const [pubTopic, setPubTopic] = useState(mqttConfig.topicPump);
  const [pubPayload, setPubPayload] = useState('ON');
  const [simVolume, setSimVolume] = useState<number>(650);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubTopic.trim() || !pubPayload.trim()) return;
    onSendMessage(pubTopic, pubPayload);
  };

  const triggerSimTelemetry = () => {
    onSimulateTelemetry(simVolume);
  };

  return (
    <div id="mqtt-panel-section" className="bg-[#080a0e] border border-white/10 rounded-lg p-6 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-widest">
              Panel Integrasi MQTT Broker
            </h3>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
              Uji aliran data nirkabel dua arah antara Digital Twin dan mikrokontroler fisik.
            </p>
          </div>
        </div>

        {/* Broker Status Badges */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase">
            <Circle className="w-2 h-2 fill-current" />
            Broker: Connected
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-white/5 px-2.5 py-1 rounded border border-white/5">
            {mqttConfig.broker}:{mqttConfig.port}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Control Box & Command Console */}
        <div className="lg:col-span-5 space-y-5">
          {/* Simulation Tools */}
          <div className="border border-white/5 bg-white/5 rounded p-4 space-y-4">
            <h4 className="font-mono font-bold text-[10px] uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              Generator Simulasi Telemetri
            </h4>
            <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
              Kirimkan telemetri ketinggian air buatan ke MQTT broker untuk melihat sensor ultrasonic dan indikator bereaksi.
            </p>
            <div className="space-y-3">
              <div>
                <label className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>Simulasi Volume Air</span>
                  <span className="font-bold text-cyan-400">{simVolume}L</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="10"
                    value={simVolume}
                    onChange={(e) => setSimVolume(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-white/10 rounded appearance-none cursor-pointer accent-cyan-500"
                    id="slider-sim-volume"
                  />
                  <button
                    onClick={triggerSimTelemetry}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-black font-mono font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    id="btn-send-sim-telemetry"
                  >
                    Kirim
                  </button>
                </div>
              </div>

              {/* Preset Quick Actions */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => { setSimVolume(150); onSimulateTelemetry(150); }}
                  className="px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 text-[9px] font-mono rounded transition-colors uppercase"
                >
                  Rendah (150L)
                </button>
                <button
                  onClick={() => { setSimVolume(500); onSimulateTelemetry(500); }}
                  className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 text-[9px] font-mono rounded transition-colors uppercase"
                >
                  Sedang (500L)
                </button>
                <button
                  onClick={() => { setSimVolume(950); onSimulateTelemetry(950); }}
                  className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono rounded transition-colors uppercase"
                >
                  Penuh (950L)
                </button>
              </div>
            </div>
          </div>

          {/* MQTT Publish Console Form */}
          <div className="border border-white/5 bg-white/5 rounded p-4">
            <h4 className="font-mono font-bold text-[10px] uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-3">
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              Kirim Pesan Manual (Publish)
            </h4>
            <form onSubmit={handlePublish} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Topic</label>
                <input
                  type="text"
                  value={pubTopic}
                  onChange={(e) => setPubTopic(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:outline-none focus:border-cyan-500 text-slate-200"
                  placeholder="e.g. tank/pump"
                  id="form-pub-topic"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-1">Payload</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pubPayload}
                    onChange={(e) => setPubPayload(e.target.value)}
                    className="flex-1 text-xs font-mono px-3 py-2 border border-white/10 bg-[#05070a] rounded focus:outline-none focus:border-cyan-500 text-slate-200"
                    placeholder="ON / OFF / AUTO"
                    id="form-pub-payload"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-black font-bold font-mono rounded text-xs flex items-center gap-1 cursor-pointer transition-colors uppercase tracking-wider"
                  >
                    Publish
                  </button>
                </div>
              </div>
              {/* Quick payload buttons */}
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => setPubPayload('ON')}
                  className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-slate-400 hover:bg-white/5 uppercase"
                >
                  "ON"
                </button>
                <button
                  type="button"
                  onClick={() => setPubPayload('OFF')}
                  className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-slate-400 hover:bg-white/5 uppercase"
                >
                  "OFF"
                </button>
                <button
                  type="button"
                  onClick={() => setPubPayload('AUTO')}
                  className="px-2 py-0.5 border border-white/10 rounded text-[9px] font-mono text-slate-400 hover:bg-white/5 uppercase"
                >
                  "AUTO"
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Live Logs / Terminal */}
        <div className="lg:col-span-7 flex flex-col h-[320px] lg:h-auto border border-white/10 rounded-lg overflow-hidden bg-[#05070a] text-slate-300">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0a0c10] border-b border-white/10">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Live MQTT Message Logger</span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={onClearLogs}
                className="text-[10px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:bg-white/5 px-2 py-0.5 rounded transition-colors uppercase"
                id="btn-clear-mqtt-logs"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Log
              </button>
            )}
          </div>

          {/* Terminal Logs View */}
          <div className="flex-1 p-4 overflow-auto font-mono text-xs space-y-2.5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 font-mono text-center">
                <Terminal className="w-8 h-8 text-slate-800 mb-2" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Menunggu transmisi pesan MQTT...</p>
                <p className="text-[9px] text-slate-600 max-w-xs mt-1">
                  Pesan telemetri dan kontrol nirkabel akan didekripsi dan dicatat di sini secara real-time.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                let badgeClass = '';
                let textClass = 'text-slate-300';
                
                if (msg.type === 'incoming') {
                  badgeClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                } else if (msg.type === 'outgoing') {
                  badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                } else {
                  badgeClass = 'bg-white/5 text-slate-500 border border-white/5';
                  textClass = 'text-slate-500';
                }

                return (
                  <div key={msg.id} className="border-b border-white/5 pb-2 flex items-start gap-2 animate-fadeIn">
                    <span className="text-[9px] text-slate-600 shrink-0 select-none mt-0.5">{msg.timestamp}</span>
                    <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}>
                      {msg.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-cyan-400 mr-1.5 select-all">{msg.topic}</span>
                      <span className="text-slate-600 mr-1.5">➔</span>
                      <span className={`${textClass} break-all select-all font-semibold`}>{msg.payload}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Status Overlay Footer */}
          <div className="px-4 py-2.5 bg-[#0a0c10]/80 border-t border-white/10 text-[9px] font-mono uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Simulated Wi-Fi: <strong className="text-slate-400">Connected (RSSI: -58dBm)</strong></span>
            <span>Total Log: <strong className="text-slate-400">{messages.length} pesan</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
