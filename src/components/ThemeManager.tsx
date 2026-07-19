import React, { useState, useEffect } from 'react';
import { Sun, Moon, Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';
import { ThemeConfig } from '../types';

interface ThemeManagerProps {
  theme: ThemeConfig;
  onChange: (newTheme: ThemeConfig) => void;
  onReset: () => void;
}

export const THEME_PRESETS = [
  {
    id: 'blue-tech' as const,
    name: 'Tech Metallic Blue',
    description: 'Nuansa biru metalik dan putih bersih untuk kesan medis & presisi.',
    primaryColor: '#0066cc',
    accentColor: '#38bdf8',
    bgColor: '#f1f5f9',
    cardColor: '#ffffff',
    darkBgColor: '#0f172a',
    darkCardColor: '#1e293b',
  },
  {
    id: 'emerald-clean' as const,
    name: 'Emerald Hygienic Clean',
    description: 'Aksen hijau higienis, bersih, dan segar cocok untuk filtrasi air.',
    primaryColor: '#059669',
    accentColor: '#34d399',
    bgColor: '#f0fdf4',
    cardColor: '#ffffff',
    darkBgColor: '#064e3b',
    darkCardColor: '#022c22',
  },
  {
    id: 'cyberpunk' as const,
    name: 'Cyberpunk Amber Glow',
    description: 'Warna futuristik dengan lampu neon kuning-amber yang mencolok.',
    primaryColor: '#d97706',
    accentColor: '#fbbf24',
    bgColor: '#fdfbf7',
    cardColor: '#ffffff',
    darkBgColor: '#171717',
    darkCardColor: '#262626',
  },
  {
    id: 'monochrome' as const,
    name: 'Classic Monochrome',
    description: 'Estetika minimalis baja perak dan arang hitam tanpa gangguan.',
    primaryColor: '#4b5563',
    accentColor: '#9ca3af',
    bgColor: '#f9fafb',
    cardColor: '#ffffff',
    darkBgColor: '#111827',
    darkCardColor: '#1f2937',
  }
];

export const ThemeManager: React.FC<ThemeManagerProps> = ({ theme, onChange, onReset }) => {
  // Theme preview state for interactive preview
  const [previewTheme, setPreviewTheme] = useState<ThemeConfig>({ ...theme });
  const [showPreviewNotification, setShowPreviewNotification] = useState(false);

  // Sync preview with actual theme when actual theme changes
  useEffect(() => {
    setPreviewTheme({ ...theme });
  }, [theme]);

  // Dark mode auto checker based on local time (6 PM to 6 AM is dark)
  useEffect(() => {
    if (theme.mode === 'auto') {
      const hours = new Date().getHours();
      const isNight = hours >= 18 || hours < 6;
      const html = document.documentElement;
      if (isNight) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    } else if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

  const handleModeChange = (mode: 'light' | 'dark' | 'auto') => {
    const updated = { ...theme, mode };
    onChange(updated);
    setPreviewTheme(updated);
  };

  const handleIntensityChange = (val: number) => {
    const updated = { ...theme, ambientIntensity: val };
    onChange(updated);
    setPreviewTheme(updated);
  };

  // Live Interactive Preview: change preview state, let user click "Terapkan" or auto-save
  const selectPresetForPreview = (presetId: typeof THEME_PRESETS[number]['id']) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      const updated: ThemeConfig = {
        ...previewTheme,
        themePreset: presetId,
        lightColor: preset.accentColor,
      };
      setPreviewTheme(updated);
      
      // Auto-save: apply immediately as requested ("fungsi simpan otomatis untuk setiap modifikasi")
      // and show an interactive live status before applying!
      onChange(updated);
      setShowPreviewNotification(true);
      setTimeout(() => setShowPreviewNotification(false), 2000);
    }
  };

  return (
    <div id="theme-manager-panel" className="bg-[#080a0e] border border-white/10 rounded-lg p-6 shadow-sm relative overflow-hidden transition-all duration-300">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-mono text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
          Kustomisasi Tema & Tampilan
        </h3>
        <button
          onClick={onReset}
          className="text-[10px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-rose-500/15 border border-rose-500/20 uppercase"
          id="btn-restore-theme"
          title="Pulihkan pengaturan awal"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Pulihkan Awal
        </button>
      </div>

      {/* Interactive Preview Status Banner */}
      {showPreviewNotification && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-cyan-500 text-black text-[9px] font-mono font-bold px-3 py-1 rounded shadow-md flex items-center gap-1 animate-bounce z-10 uppercase">
          <Check className="w-3 h-3" />
          <span>Tema {THEME_PRESETS.find(p => p.id === previewTheme.themePreset)?.name} Diterapkan</span>
        </div>
      )}

      {/* Mode Selectors */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <button
          onClick={() => handleModeChange('light')}
          className={`flex flex-col items-center justify-center p-3 rounded border text-[10px] font-mono uppercase gap-1.5 transition-all ${
            theme.mode === 'light'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
              : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}
          id="theme-btn-light"
        >
          <Sun className="w-4 h-4" />
          <span>Mode Terang</span>
        </button>
        <button
          onClick={() => handleModeChange('dark')}
          className={`flex flex-col items-center justify-center p-3 rounded border text-[10px] font-mono uppercase gap-1.5 transition-all ${
            theme.mode === 'dark'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
              : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}
          id="theme-btn-dark"
        >
          <Moon className="w-4 h-4" />
          <span>Mode Gelap</span>
        </button>
        <button
          onClick={() => handleModeChange('auto')}
          className={`flex flex-col items-center justify-center p-3 rounded border text-[10px] font-mono uppercase gap-1.5 transition-all ${
            theme.mode === 'auto'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
              : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}
          id="theme-btn-auto"
        >
          <div className="flex items-center gap-0.5">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <Moon className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span>Otomatis (Jam)</span>
        </button>
      </div>

      {/* Preset Themes Swatches */}
      <div className="mb-6">
        <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2.5">
          Pratinjau & Pilihan Preset Tema
        </label>
        <div className="space-y-2 font-mono">
          {THEME_PRESETS.map((preset) => {
            const isSelected = previewTheme.themePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => selectPresetForPreview(preset.id)}
                className={`w-full flex items-start gap-3 p-3 rounded border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/5 shadow-sm'
                    : 'border-white/5 hover:bg-white/5'
                }`}
                id={`preset-${preset.id}`}
              >
                {/* Visual Swatch Pill */}
                <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
                  <div className="flex gap-1">
                    <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.primaryColor }} />
                    <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.accentColor }} />
                  </div>
                  <div className="flex gap-1">
                    <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.bgColor }} />
                    <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: preset.darkBgColor }} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded uppercase">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 uppercase tracking-normal">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Light Intensity Sliders */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            Intensitas Cahaya 3D
          </label>
          <span className="text-xs font-mono font-bold text-cyan-400">
            {Math.round(theme.ambientIntensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.05"
          value={theme.ambientIntensity}
          onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-cyan-500"
          id="input-ambient-intensity"
        />
        <div className="flex justify-between text-[9px] font-mono uppercase text-slate-500 mt-1">
          <span>Redup (0.1x)</span>
          <span>Normal (1.0x)</span>
          <span>Terang (2.0x)</span>
        </div>
      </div>
    </div>
  );
};
