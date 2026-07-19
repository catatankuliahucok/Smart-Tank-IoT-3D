import React, { useRef, useEffect, useState } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  ShadowGenerator,
  DynamicTexture,
} from '@babylonjs/core';
import { DeviceState, TankConfig, ThemeConfig } from '../types';
import { THEME_PRESETS } from './ThemeManager';
import { Cpu, Settings, Droplets, Circle, Terminal } from 'lucide-react';

// Helper function to create a small 3D double chevron arrowhead ">>" representing flow direction
const create3DArrow = (name: string, color: Color3, scene: Scene) => {
  const arrowNode = new Mesh(name, scene);

  // First cone (back)
  const cone1 = MeshBuilder.CreateCylinder(name + '_cone1', {
    height: 0.08,
    diameterTop: 0,
    diameterBottom: 0.09,
    tessellation: 12
  }, scene);
  cone1.position.y = 0;
  cone1.parent = arrowNode;

  // Second cone (front)
  const cone2 = MeshBuilder.CreateCylinder(name + '_cone2', {
    height: 0.08,
    diameterTop: 0,
    diameterBottom: 0.09,
    tessellation: 12
  }, scene);
  cone2.position.y = 0.065;
  cone2.parent = arrowNode;

  const arrowMat = new StandardMaterial(name + '_mat', scene);
  arrowMat.diffuseColor = color;
  arrowMat.emissiveColor = color.scale(1.2); // make them look glowing/neon and highly visible
  arrowMat.specularColor = new Color3(0.1, 0.1, 0.1);
  
  cone1.material = arrowMat;
  cone2.material = arrowMat;

  return arrowNode;
};

interface ThreeDViewProps {
  deviceState: DeviceState;
  tankConfig: TankConfig;
  theme: ThemeConfig;
  isDraining?: boolean;
  onThresholdChange?: (type: 'MIN' | 'MAX', value: number) => void;
}

export const ThreeDView: React.FC<ThreeDViewProps> = ({
  deviceState,
  tankConfig,
  theme,
  isDraining = true,
  onThresholdChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [hoveredObj, setHoveredObj] = useState<string | null>(null);

  const renderHUD = () => {
    const currentVol = deviceState.currentVolume;
    const maxVol = tankConfig.maxVolume;
    const isPumpOn = deviceState.pumpStatus === 'ON';
    const activeDrain = isDraining && currentVol > (maxVol * 0.015);

    const objectsData = [
      {
        id: 'sensor',
        name: 'Sensor HC-SR04',
        fullName: 'Sensor Ultrasonik HC-SR04',
        icon: Cpu,
        color: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]',
        status: 'AKTIF (PINGING)',
        statusColor: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
        desc: 'Mengukur jarak ke permukaan air menggunakan pancaran gelombang ultrasonik untuk kalkulasi volume air.',
        metrics: `Jarak: ${Math.round(200 * (1 - currentVol / maxVol) * 10) / 10} cm | Tinggi Air: ${Math.round(200 * (currentVol / maxVol) * 10) / 10} cm`
      },
      {
        id: 'valve',
        name: 'Motorized Valve',
        fullName: 'Katup Penguras Bermotor',
        icon: Settings,
        color: activeDrain ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
        status: activeDrain ? 'TERBUKA (OPEN)' : 'TERTUTUP (CLOSED)',
        statusColor: activeDrain ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-rose-400 border-rose-500/20 bg-rose-500/10',
        desc: 'Katup mekanis bermotor elektrik yang mengatur aliran pembuangan air dari tangki.',
        metrics: activeDrain ? 'Status: Menguras Air' : 'Status: Siaga Menahan Air'
      },
      {
        id: 'pump',
        name: 'Pompa Air',
        fullName: 'Water Pump Elektrik',
        icon: Droplets,
        color: isPumpOn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-600',
        status: isPumpOn ? 'AKTIF (ON)' : 'STANDBY (OFF)',
        statusColor: isPumpOn ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-slate-400 border-slate-500/20 bg-slate-500/10',
        desc: 'Pompa penyuplai air bersih utama ke dalam tangki, aktif saat air di bawah ambang batas minimum.',
        metrics: isPumpOn ? 'Status: Mengalirkan Air' : 'Status: Siaga / Standby'
      },
      {
        id: 'tank',
        name: 'Tangki Utama',
        fullName: 'Tangki Air Silinder',
        icon: Circle,
        color: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]',
        status: `TERISI ${Math.round((currentVol / maxVol) * 100)}%`,
        statusColor: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
        desc: 'Bejana silinder penyimpanan air berkapasitas total 1000L dengan sirkuit histeresis otomatis.',
        metrics: `Kapasitas: ${currentVol}L / ${maxVol}L`
      },
      {
        id: 'panel',
        name: 'Box Panel',
        fullName: 'Smart Box Panel ESP32',
        icon: Terminal,
        color: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
        status: 'ONLINE',
        statusColor: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
        desc: 'Panel kontrol sirkuit fisik yang menampung modul mikrokontroler ESP32, modul relay, dan visual indikator LED.',
        metrics: 'Uptime: Stabil | Koneksi: MQTT OK'
      }
    ];

    const hoveredData = objectsData.find(o => o.id === hoveredObj);

    return (
      <div className="absolute inset-x-4 bottom-12 z-20 flex flex-col items-center pointer-events-none gap-3">
        {/* Tooltip Content Popover (Animated) */}
        {hoveredData && (
          <div className="w-full max-w-sm bg-[#080a0e]/95 border border-white/10 p-3 rounded-lg shadow-2xl backdrop-blur-md pointer-events-auto animate-fadeIn text-left font-mono text-[10px]">
            <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-white/5">
              <span className="font-bold text-white text-[11px] tracking-wide flex items-center gap-1.5">
                <hoveredData.icon className="w-3.5 h-3.5 text-cyan-400" />
                {hoveredData.fullName}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${hoveredData.statusColor}`}>
                {hoveredData.status}
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed mb-2">
              {hoveredData.desc}
            </p>
            <div className="bg-black/40 p-1.5 rounded border border-white/5 text-[9px] flex items-center justify-between">
              <span className="text-slate-500 uppercase tracking-wider text-[8px]">Data Real-Time</span>
              <span className="text-cyan-400 font-bold">{hoveredData.metrics}</span>
            </div>
          </div>
        )}

        {/* HUD Interactive Bar */}
        <div className="w-full max-w-lg bg-[#080a0e]/90 border border-white/10 rounded-full p-1.5 shadow-lg backdrop-blur-md pointer-events-auto flex items-center justify-between gap-1">
          <span className="hidden sm:inline-block pl-3 text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            Detail Objek:
          </span>
          <div className="flex-1 flex justify-around sm:justify-end gap-1.5">
            {objectsData.map((obj) => (
              <button
                key={obj.id}
                onMouseEnter={() => setHoveredObj(obj.id)}
                onMouseLeave={() => setHoveredObj(null)}
                onClick={() => setHoveredObj(hoveredObj === obj.id ? null : obj.id)}
                className={`relative px-2.5 py-1.5 rounded-full border text-[9px] font-mono font-semibold uppercase flex items-center gap-1 transition-all cursor-pointer ${
                  hoveredObj === obj.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${obj.color}`} />
                <span>{obj.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Keep values in refs to access in the render loop without rebuilding the scene
  const volumeRef = useRef(deviceState.currentVolume);
  const pumpRef = useRef(deviceState.pumpStatus);
  const themeRef = useRef(theme);
  const tankConfigRef = useRef(tankConfig);
  const isDrainingRef = useRef(isDraining);

  useEffect(() => {
    volumeRef.current = deviceState.currentVolume;
  }, [deviceState.currentVolume]);

  useEffect(() => {
    pumpRef.current = deviceState.pumpStatus;
  }, [deviceState.pumpStatus]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    tankConfigRef.current = tankConfig;
  }, [tankConfig]);

  useEffect(() => {
    isDrainingRef.current = isDraining;
  }, [isDraining]);

  useEffect(() => {
    if (!canvasRef.current) return;

    let isAlive = true;
    const canvas = canvasRef.current;
    
    // 1. Initialize Babylon Engine and Scene with error handling
    let engine: Engine;
    let scene: Scene;
    try {
      if (!Engine.isSupported()) {
        throw new Error("Engine.isSupported() returned false");
      }
      engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
      scene = new Scene(engine);
    } catch (err) {
      console.warn("WebGL initialization failed, falling back to 2D view.", err);
      setWebGlSupported(false);
      return;
    }
    
    // Transparent background to show custom dashboard theme
    scene.clearColor = new Color4(0, 0, 0, 0);

    // 2. Camera Setup (Orbit/ArcRotate)
    const camera = new ArcRotateCamera(
      'camera1',
      -Math.PI / 4, // alpha
      Math.PI / 2.8,  // beta
      8.5,            // radius
      new Vector3(0, 0.1, 0), // target
      scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5.0;
    camera.upperRadiusLimit = 15.0;
    camera.wheelPrecision = 45;

    // 3. Dynamic High-fidelity Lighting Setup
    const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene);
    light.intensity = theme.ambientIntensity * 0.95;

    const dirLight = new DirectionalLight('dirLight', new Vector3(-1.2, -2.5, -1.2), scene);
    dirLight.position = new Vector3(6, 12, 6);
    dirLight.intensity = 0.85 * theme.ambientIntensity;

    // Materials dictionary for dynamic updates
    const materials: Record<string, StandardMaterial> = {};

    // Get color settings from theme presets
    const getThemePresetColor = () => {
      const preset = THEME_PRESETS.find(p => p.id === themeRef.current.themePreset) || THEME_PRESETS[0];
      return {
        primary: Color3.FromHexString(preset.primaryColor),
        accent: Color3.FromHexString(preset.accentColor),
        isDark: themeRef.current.mode === 'dark' || 
          (themeRef.current.mode === 'auto' && (new Date().getHours() >= 18 || new Date().getHours() < 6))
      };
    };

    const presetColor = getThemePresetColor();

    // ----------------------------------------------------
    // MATERIALS CONFIGURATION (HIGH-FIDELITY / REALISTIC)
    // ----------------------------------------------------
    
    // Base Plate Plate / Heavy Anodized Steel Material
    const baseMat = new StandardMaterial('baseMat', scene);
    baseMat.diffuseColor = new Color3(0.06, 0.07, 0.1);
    baseMat.specularColor = new Color3(0.25, 0.28, 0.35);
    baseMat.specularPower = 16;
    materials.base = baseMat;

    // Laboratory Stand Backboard (Matte Polypropylene)
    const boardMat = new StandardMaterial('boardMat', scene);
    boardMat.diffuseColor = new Color3(0.09, 0.11, 0.14);
    boardMat.specularColor = new Color3(0.05, 0.05, 0.05);
    materials.board = boardMat;

    // Chrome Steel Struts / Structural Profiles
    const chromeMat = new StandardMaterial('chromeMat', scene);
    chromeMat.diffuseColor = new Color3(0.5, 0.52, 0.55);
    chromeMat.specularColor = new Color3(0.95, 0.95, 1.0);
    chromeMat.specularPower = 128; // highly reflective
    materials.chrome = chromeMat;

    // Polycarbonate Tank Wall (Frosted Glass Look)
    const tankMat = new StandardMaterial('tankMat', scene);
    tankMat.diffuseColor = new Color3(0.85, 0.92, 0.98);
    tankMat.specularColor = new Color3(1.0, 1.0, 1.0);
    tankMat.specularPower = 128;
    tankMat.alpha = 0.14;
    tankMat.backFaceCulling = false;
    materials.tank = tankMat;

    // Dynamic Liquid Material (High specular glossy water)
    const waterMat = new StandardMaterial('waterMat', scene);
    waterMat.diffuseColor = presetColor.accent;
    waterMat.specularColor = new Color3(1.0, 1.0, 1.0);
    waterMat.specularPower = 64;
    waterMat.alpha = 0.65;
    waterMat.backFaceCulling = false;
    materials.water = waterMat;

    // Heavy Industrial Plastic (Matte dark blue/grey for caps, pump base)
    const plasticMat = new StandardMaterial('plasticMat', scene);
    plasticMat.diffuseColor = new Color3(0.12, 0.14, 0.17);
    plasticMat.specularColor = new Color3(0.2, 0.22, 0.25);
    plasticMat.specularPower = 16;
    materials.plastic = plasticMat;

    // Copper Pipeline Material (Polished industrial copper pipes)
    const copperMat = new StandardMaterial('copperMat', scene);
    copperMat.diffuseColor = new Color3(0.72, 0.42, 0.22);
    copperMat.specularColor = new Color3(0.95, 0.75, 0.6);
    copperMat.specularPower = 48;
    materials.copper = copperMat;

    // Flexible conduit / cable sleeve (matte black ribbed rubber)
    const conduitMat = new StandardMaterial('conduitMat', scene);
    conduitMat.diffuseColor = new Color3(0.03, 0.03, 0.04);
    conduitMat.specularColor = new Color3(0.1, 0.1, 0.1);
    materials.conduit = conduitMat;

    // High Threshold (Max) Ring (Translucent Glowing Red)
    const highMat = new StandardMaterial('highMat', scene);
    highMat.diffuseColor = new Color3(0.95, 0.08, 0.08);
    highMat.emissiveColor = new Color3(0.4, 0.02, 0.02);
    highMat.alpha = 0.6;
    materials.high = highMat;

    // Low Threshold (Min) Ring (Translucent Glowing Amber)
    const lowMat = new StandardMaterial('lowMat', scene);
    lowMat.diffuseColor = new Color3(0.95, 0.75, 0.08);
    lowMat.emissiveColor = new Color3(0.4, 0.3, 0.02);
    lowMat.alpha = 0.6;
    materials.low = lowMat;

    // Moving Flow Fluid inside pipelines
    const flowMat = new StandardMaterial('flowMat', scene);
    flowMat.diffuseColor = presetColor.accent;
    flowMat.emissiveColor = presetColor.accent.scale(0.6);
    flowMat.alpha = 0.82;
    materials.flow = flowMat;

    // Microcontroller PCB (Sleek dark green fiberglass)
    const pcbMat = new StandardMaterial('pcbMat', scene);
    pcbMat.diffuseColor = new Color3(0.04, 0.22, 0.08);
    pcbMat.specularColor = new Color3(0.2, 0.2, 0.2);
    materials.pcb = pcbMat;

    // Relay blue shell
    const relayMat = new StandardMaterial('relayMat', scene);
    relayMat.diffuseColor = new Color3(0.08, 0.35, 0.75);
    materials.relay = relayMat;

    // Ultrasonic HC-SR04 ping wave material
    const signalMat = new StandardMaterial('signalMat', scene);
    signalMat.diffuseColor = new Color3(0.3, 0.75, 1.0);
    signalMat.emissiveColor = new Color3(0.15, 0.45, 0.9);
    signalMat.alpha = 0.35;
    materials.signal = signalMat;

    // ----------------------------------------------------
    // GEOMETRY & ASSEMBLY (REAL EQUIPMENT ARRANGEMENT)
    // ----------------------------------------------------
    const bottomY = -2.0;
    const topY = 2.0;
    const tankHeight = topY - bottomY; // 4.0 units
    const tankRadius = 1.15;
    const maxWaterHeight = 3.8;

    // A. Base Workbench Plate
    const basePlate = MeshBuilder.CreateBox('basePlate', { width: 5.6, height: 0.2, depth: 3.6 }, scene);
    basePlate.position.set(0.2, bottomY - 0.1, 0);
    basePlate.material = baseMat;
    basePlate.receiveShadows = true;

    // Rubber mounting feet for base
    const footPositions = [
      [-2.6, -1.7], [2.6, -1.7], [-2.6, 1.7], [2.6, 1.7]
    ];
    footPositions.forEach((pos, idx) => {
      const foot = MeshBuilder.CreateCylinder(`foot_${idx}`, { height: 0.08, diameter: 0.25 }, scene);
      foot.position.set(pos[0], bottomY - 0.24, pos[1]);
      foot.material = plasticMat;
    });

    // B. Laboratory Mounting Board (Unifies the entire frame)
    const backingBoard = MeshBuilder.CreateBox('backingBoard', { width: 5.6, height: 4.8, depth: 0.12 }, scene);
    backingBoard.position.set(0.2, 0.3, -1.7);
    backingBoard.material = boardMat;
    backingBoard.receiveShadows = true;

    // C. Heavy Chrome Mounting Rails (Struts) removed per user request

    // D. Metal Support Bracket Bands (Removed per user request)

    // E. Water Tank Polycarbonate Cylinder
    const tankCylinder = MeshBuilder.CreateCylinder('tankCylinder', {
      height: tankHeight,
      diameter: tankRadius * 2,
      tessellation: 48,
    }, scene);
    tankCylinder.position.y = (bottomY + topY) / 2;
    tankCylinder.material = tankMat;

    // Tank Thick Sealing Base (Bottom collar)
    const tankBase = MeshBuilder.CreateCylinder('tankBase', {
      height: 0.16,
      diameter: (tankRadius + 0.06) * 2,
      tessellation: 36,
    }, scene);
    tankBase.position.y = bottomY + 0.08;
    tankBase.material = plasticMat;

    // Tank Sealing Lid (Top collar)
    const tankLid = MeshBuilder.CreateCylinder('tankLid', {
      height: 0.16,
      diameter: (tankRadius + 0.04) * 2,
      tessellation: 36,
    }, scene);
    tankLid.position.y = topY - 0.08;
    tankLid.material = plasticMat;

    // F. Volumetric Meter Calibrations (Visual Scale ticks on the front of tank)
    const tickMat = new StandardMaterial('tickMat', scene);
    tickMat.diffuseColor = new Color3(0.85, 0.85, 0.9);
    tickMat.emissiveColor = new Color3(0.15, 0.15, 0.2);
    
    for (let i = 1; i <= 9; i++) {
      const tickY = bottomY + 0.1 + (i / 10) * maxWaterHeight;
      const tick = MeshBuilder.CreateBox(`tick_${i}`, { width: 0.14, height: 0.02, depth: 0.015 }, scene);
      tick.position.set(0, tickY, tankRadius + 0.015);
      tick.material = tickMat;
    }

    // G. Dynamic Water Level Cylinder
    const waterCylinder = MeshBuilder.CreateCylinder('waterCylinder', {
      height: 1.0, // Scale Y updated dynamically
      diameter: (tankRadius - 0.02) * 2,
      tessellation: 36,
    }, scene);
    waterCylinder.material = waterMat;

    // H. Water Surface Film (Glossy reflections on top of water)
    const waterSurfaceDisc = MeshBuilder.CreateCylinder('waterSurfaceDisc', {
      height: 0.01,
      diameter: (tankRadius - 0.03) * 2,
      tessellation: 36,
    }, scene);
    const surfaceMat = new StandardMaterial('surfaceMat', scene);
    surfaceMat.diffuseColor = presetColor.accent.scale(1.2);
    surfaceMat.specularColor = new Color3(1.0, 1.0, 1.0);
    surfaceMat.specularPower = 128;
    surfaceMat.alpha = 0.8;
    waterSurfaceDisc.material = surfaceMat;

    // I. Ultrasonic Sensor HC-SR04 Assembly on Lid
    const sensorBody = MeshBuilder.CreateBox('sensorBody', { width: 0.52, height: 0.04, depth: 0.22 }, scene);
    sensorBody.position.set(0, topY + 0.06, 0);
    sensorBody.material = pcbMat;

    const sensorT1 = MeshBuilder.CreateCylinder('sensorT1', { height: 0.12, diameter: 0.13 }, scene);
    sensorT1.position.set(-0.15, -0.06, 0);
    sensorT1.material = chromeMat;
    sensorT1.parent = sensorBody;

    const sensorT2 = MeshBuilder.CreateCylinder('sensorT2', { height: 0.12, diameter: 0.13 }, scene);
    sensorT2.position.set(0.15, -0.06, 0);
    sensorT2.material = chromeMat;
    sensorT2.parent = sensorBody;

    // Concentric horizontal ping rings representing ultrasonic waves
    const signalRing1 = MeshBuilder.CreateTorus('signalRing1', { diameter: 0.22, thickness: 0.015, tessellation: 16 }, scene);
    signalRing1.position.set(0, topY - 0.1, 0);
    signalRing1.material = signalMat;

    const signalRing2 = MeshBuilder.CreateTorus('signalRing2', { diameter: 0.22, thickness: 0.015, tessellation: 16 }, scene);
    signalRing2.position.set(0, topY - 0.1, 0);
    signalRing2.material = signalMat;

    // J. Centrifugal Water Pump Assembly (High-Fidelity Realistic Horizontal Model)
    // Sits on a metal support base at X = 1.8, bottomY
    const pumpBasePlate = MeshBuilder.CreateBox('pumpBasePlate', { width: 0.5, height: 0.08, depth: 0.65 }, scene);
    pumpBasePlate.position.set(1.8, bottomY + 0.04, -0.25);
    pumpBasePlate.material = plasticMat;

    // Pump Teal Material (matching Shimizu/domestic water pump look in reference image)
    const pumpTealMat = new StandardMaterial('pumpTealMat', scene);
    pumpTealMat.diffuseColor = new Color3(0.06, 0.38, 0.38); // Teal-green matching the reference
    pumpTealMat.specularColor = new Color3(0.5, 0.6, 0.6);
    pumpTealMat.specularPower = 32;
    materials.pumpTeal = pumpTealMat;

    // Golden brass plate/ring
    const brassMat = new StandardMaterial('brassMat', scene);
    brassMat.diffuseColor = new Color3(0.85, 0.68, 0.15); // Rich gold/brass
    brassMat.specularColor = new Color3(0.9, 0.8, 0.5);
    brassMat.specularPower = 64;
    materials.brass = brassMat;

    // Dark grey metal for fan cover / screws
    const darkMetalMat = new StandardMaterial('darkMetalMat', scene);
    darkMetalMat.diffuseColor = new Color3(0.22, 0.24, 0.26);
    darkMetalMat.specularColor = new Color3(0.4, 0.4, 0.4);
    materials.darkMetal = darkMetalMat;

    // 1. Horizontal Motor Cylinder (oriented along Z-axis)
    const pumpMotor = MeshBuilder.CreateCylinder('pumpMotor', { height: 0.45, diameter: 0.38, tessellation: 24 }, scene);
    pumpMotor.rotation.x = Math.PI / 2;
    pumpMotor.position.set(1.8, bottomY + 0.22, -0.375);
    pumpMotor.material = pumpTealMat;

    // 2. Cooling Ribs / Fins on the motor body (thin larger cylinders)
    const ribCount = 4;
    for (let i = 0; i < ribCount; i++) {
      const rib = MeshBuilder.CreateCylinder(`pumpRib_${i}`, { height: 0.02, diameter: 0.41, tessellation: 24 }, scene);
      rib.rotation.x = Math.PI / 2;
      rib.position.set(1.8, bottomY + 0.22, -0.22 - (i * 0.1));
      rib.material = pumpTealMat;
    }

    // 3. Black Capacitor Box (mounted on top of motor)
    const capacitorBox = MeshBuilder.CreateBox('capacitorBox', { width: 0.14, height: 0.12, depth: 0.3 }, scene);
    capacitorBox.position.set(1.8, bottomY + 0.42, -0.375);
    const capMat = new StandardMaterial('capMat', scene);
    capMat.diffuseColor = new Color3(0.12, 0.12, 0.14);
    capMat.specularColor = new Color3(0.2, 0.2, 0.2);
    capacitorBox.material = capMat;

    // 4. Yellow/Brass Coupling Ring (at the front of the motor cylinder)
    const pumpCoupling = MeshBuilder.CreateCylinder('pumpCoupling', { height: 0.03, diameter: 0.38, tessellation: 24 }, scene);
    pumpCoupling.rotation.x = Math.PI / 2;
    pumpCoupling.position.set(1.8, bottomY + 0.22, -0.125);
    pumpCoupling.material = brassMat;

    // 5. Pump Head Casting (Front chamber)
    const pumpHead = MeshBuilder.CreateBox('pumpHead', { width: 0.36, height: 0.36, depth: 0.22 }, scene);
    pumpHead.position.set(1.8, bottomY + 0.22, 0);
    pumpHead.material = pumpTealMat;

    // 6. Pump Impeller Cover / Chamber (cylinder on the head, rotated when pump turns on)
    const pumpImpeller = MeshBuilder.CreateCylinder('pumpImpeller', { height: 0.14, diameter: 0.32, tessellation: 24 }, scene);
    pumpImpeller.rotation.x = Math.PI / 2;
    pumpImpeller.position.set(1.8, bottomY + 0.22, 0.11);
    pumpImpeller.material = pumpTealMat;

    // 7. Flange / Fitting on top of pump head (inlet/outlet port)
    const pumpFlangeTop = MeshBuilder.CreateCylinder('pumpFlangeTop', { height: 0.06, diameter: 0.2 }, scene);
    pumpFlangeTop.position.set(1.8, bottomY + 0.43, 0);
    pumpFlangeTop.material = darkMetalMat;

    // 8. Motor Back Fan Cover
    const fanCover = MeshBuilder.CreateCylinder('fanCover', { height: 0.06, diameter: 0.38 }, scene);
    fanCover.rotation.x = Math.PI / 2;
    fanCover.position.set(1.8, bottomY + 0.22, -0.61);
    fanCover.material = darkMetalMat;

    // K. COMPLETE COHERENT PIPELINE CIRCUIT (Copper pipes with elbow fittings)
    
    // 1. Suction Pipeline (Connects Pump Inlet to external water source on the floor)
    // Horizontal pipe extending to the right from the pump head (x = 1.8 to x = 2.4)
    const extInletHoriz = MeshBuilder.CreateCylinder('extInletHoriz', { height: 0.6, diameter: 0.14 }, scene);
    extInletHoriz.position.set(2.1, bottomY + 0.22, 0);
    extInletHoriz.rotation.z = Math.PI / 2;
    extInletHoriz.material = copperMat;

    // Corner Elbow Sphere at the outer end
    const extInletElbow = MeshBuilder.CreateSphere('extInletElbow', { diameter: 0.2 }, scene);
    extInletElbow.position.set(2.4, bottomY + 0.22, 0);
    extInletElbow.material = chromeMat;

    // Vertical pipe going down to the floor
    const extInletVert = MeshBuilder.CreateCylinder('extInletVert', { height: 0.22, diameter: 0.14 }, scene);
    extInletVert.position.set(2.4, bottomY + 0.11, 0);
    extInletVert.material = copperMat;

    // Flange at the floor base
    const extInletFlange = MeshBuilder.CreateCylinder('extInletFlange', { height: 0.04, diameter: 0.24 }, scene);
    extInletFlange.position.set(2.4, bottomY + 0.02, 0);
    extInletFlange.material = chromeMat;

    // Green and Red flow indicator arrows (positioned beside pipes)
    const greenColor = new Color3(0.08, 0.95, 0.08); // high contrast green
    const redColor = new Color3(0.95, 0.08, 0.08);   // high contrast red

    const greenArrow1 = create3DArrow('greenArrow1', greenColor, scene);
    greenArrow1.rotation.z = Math.PI / 2;
    greenArrow1.position.set(2.4, bottomY + 0.22 + 0.18, 0.20);

    const greenArrow2 = create3DArrow('greenArrow2', greenColor, scene);
    greenArrow2.position.set(1.98, bottomY + 0.42, 0.40);

    const greenArrow3 = create3DArrow('greenArrow3', greenColor, scene);
    greenArrow3.position.set(1.98, bottomY + 2.0, 0.40);

    const greenArrow4 = create3DArrow('greenArrow4', greenColor, scene);
    greenArrow4.rotation.z = Math.PI / 2;
    greenArrow4.position.set(1.8, 2.32 + 0.18, 0.20);

    const greenArrow5 = create3DArrow('greenArrow5', greenColor, scene);
    greenArrow5.rotation.z = Math.PI;
    greenArrow5.position.set(0.7 + 0.18, 2.32, 0.20);

    // Red arrows (drain)
    const redArrow1 = create3DArrow('redArrow1', redColor, scene);
    redArrow1.rotation.z = Math.PI / 2;
    redArrow1.position.set(-1.15, bottomY + 0.22 + 0.18, 0.20);

    const redArrow2 = create3DArrow('redArrow2', redColor, scene);
    redArrow2.rotation.z = Math.PI;
    redArrow2.position.set(-1.88 - 0.18, bottomY + 0.22, 0.20);

    // 2. Discharge Pipeline (Connects Pump Outlet to top-side input of Tank)
    const dischargeElbowBottom = MeshBuilder.CreateSphere('dischargeElbowBottom', { diameter: 0.2 }, scene);
    dischargeElbowBottom.position.set(1.8, bottomY + 0.22, 0.25);
    dischargeElbowBottom.material = chromeMat;

    const dischargePipeShort = MeshBuilder.CreateCylinder('dischargePipeShort', { height: 0.25, diameter: 0.14 }, scene);
    dischargePipeShort.position.set(1.8, bottomY + 0.22, 0.12);
    dischargePipeShort.rotation.x = Math.PI / 2;
    dischargePipeShort.material = copperMat;

    // Long vertical pipe rising from pump up to the top level
    const inletPipeVert = MeshBuilder.CreateCylinder('inletPipeVert', { height: 4.1, diameter: 0.14 }, scene);
    inletPipeVert.position.set(1.8, 0.27, 0.25);
    inletPipeVert.material = copperMat;

    const elbowTopRight = MeshBuilder.CreateSphere('elbowTopRight', { diameter: 0.2 }, scene);
    elbowTopRight.position.set(1.8, 2.32, 0.25);
    elbowTopRight.material = chromeMat;

    const inletPipeHoriz1 = MeshBuilder.CreateCylinder('inletPipeHoriz1', { height: 0.25, diameter: 0.14 }, scene);
    inletPipeHoriz1.position.set(1.8, 2.32, 0.12);
    inletPipeHoriz1.rotation.x = Math.PI / 2;
    inletPipeHoriz1.material = copperMat;

    const elbowTopFront = MeshBuilder.CreateSphere('elbowTopFront', { diameter: 0.2 }, scene);
    elbowTopFront.position.set(1.8, 2.32, 0);
    elbowTopFront.material = chromeMat;

    const inletPipeHoriz2 = MeshBuilder.CreateCylinder('inletPipeHoriz2', { height: 1.1, diameter: 0.14 }, scene);
    inletPipeHoriz2.position.set(1.25, 2.32, 0);
    inletPipeHoriz2.rotation.z = Math.PI / 2;
    inletPipeHoriz2.material = copperMat;

    const elbowInletDown = MeshBuilder.CreateSphere('elbowInletDown', { diameter: 0.2 }, scene);
    elbowInletDown.position.set(0.7, 2.32, 0);
    elbowInletDown.material = chromeMat;

    const inletPipeDown = MeshBuilder.CreateCylinder('inletPipeDown', { height: 0.32, diameter: 0.14 }, scene);
    inletPipeDown.position.set(0.7, 2.16, 0);
    inletPipeDown.material = copperMat;

    const flangeTop = MeshBuilder.CreateCylinder('flangeTop', { height: 0.08, diameter: 0.28 }, scene);
    flangeTop.position.set(0.7, 2.04, 0);
    flangeTop.material = chromeMat;

    // Moving Flow indicator inside horizontal copper pipe
    const inletFlow = MeshBuilder.CreateCylinder('inletFlow', { height: 0.4, diameter: 0.08 }, scene);
    inletFlow.position.set(1.25, 2.32, 0);
    inletFlow.rotation.z = Math.PI / 2;
    inletFlow.material = flowMat;

    // 3. Drain/Outlet Pipeline (Connects left side of Tank bottom, goes to base drain)
    const drainFlange = MeshBuilder.CreateCylinder('drainFlange', { height: 0.06, diameter: 0.28 }, scene);
    drainFlange.position.set(-tankRadius - 0.03, bottomY + 0.22, 0);
    drainFlange.rotation.z = Math.PI / 2;
    drainFlange.material = chromeMat;

    const drainPipeHoriz = MeshBuilder.CreateCylinder('drainPipeHoriz', { height: 0.7, diameter: 0.14 }, scene);
    drainPipeHoriz.position.set(-tankRadius - 0.38, bottomY + 0.22, 0);
    drainPipeHoriz.rotation.z = Math.PI / 2;
    drainPipeHoriz.material = copperMat;

    // O. Motorized Valve Assembly (Ball Valve + Actuator Housing + Status LED)
    const valveCenter = -tankRadius - 0.38;
    const valveY = bottomY + 0.22;

    const valveBody = MeshBuilder.CreateCylinder('valveBody', { height: 0.22, diameter: 0.22 }, scene);
    valveBody.position.set(valveCenter, valveY, 0);
    valveBody.rotation.z = Math.PI / 2;
    valveBody.material = chromeMat;

    // Metal coupling hex nuts at the valve body ends
    const valveNutLeft = MeshBuilder.CreateCylinder('valveNutLeft', { height: 0.06, diameter: 0.24, tessellation: 6 }, scene);
    valveNutLeft.position.set(valveCenter - 0.11, valveY, 0);
    valveNutLeft.rotation.z = Math.PI / 2;
    valveNutLeft.material = chromeMat;

    const valveNutRight = MeshBuilder.CreateCylinder('valveNutRight', { height: 0.06, diameter: 0.24, tessellation: 6 }, scene);
    valveNutRight.position.set(valveCenter + 0.11, valveY, 0);
    valveNutRight.rotation.z = Math.PI / 2;
    valveNutRight.material = chromeMat;

    // Connecting stem/neck
    const valveStem = MeshBuilder.CreateCylinder('valveStem', { height: 0.1, diameter: 0.07 }, scene);
    valveStem.position.set(valveCenter, valveY + 0.14, 0);
    valveStem.material = chromeMat;

    // White Actuator Housing
    const plasticWhiteMat = new StandardMaterial('plasticWhiteMat', scene);
    plasticWhiteMat.diffuseColor = new Color3(0.95, 0.95, 0.95);
    plasticWhiteMat.specularColor = new Color3(0.1, 0.1, 0.1);
    plasticWhiteMat.roughness = 0.85;

    const valveActuator = MeshBuilder.CreateBox('valveActuator', { width: 0.28, height: 0.22, depth: 0.28 }, scene);
    valveActuator.position.set(valveCenter, valveY + 0.28, 0);
    valveActuator.material = plasticWhiteMat;

    // Actuator mounting ear columns
    const valveEarLeft = MeshBuilder.CreateCylinder('valveEarLeft', { height: 0.16, diameter: 0.06 }, scene);
    valveEarLeft.position.set(valveCenter - 0.14, valveY + 0.28, 0);
    valveEarLeft.material = plasticWhiteMat;

    const valveEarRight = MeshBuilder.CreateCylinder('valveEarRight', { height: 0.16, diameter: 0.06 }, scene);
    valveEarRight.position.set(valveCenter + 0.14, valveY + 0.28, 0);
    valveEarRight.material = plasticWhiteMat;

    // Valve Status indicator LED
    const valveLed = MeshBuilder.CreateSphere('valveLed', { diameter: 0.04 }, scene);
    valveLed.position.set(valveCenter, valveY + 0.38, 0.09);
    const valveLedMat = new StandardMaterial('valveLedMat', scene);
    valveLedMat.diffuseColor = new Color3(0.9, 0.1, 0.1);
    valveLedMat.emissiveColor = new Color3(0.6, 0.02, 0.02);
    valveLed.material = valveLedMat;

    const drainElbow = MeshBuilder.CreateSphere('drainElbow', { diameter: 0.2 }, scene);
    drainElbow.position.set(-tankRadius - 0.73, bottomY + 0.22, 0);
    drainElbow.material = chromeMat;

    const drainPipeVert = MeshBuilder.CreateCylinder('drainPipeVert', { height: 0.32, diameter: 0.14 }, scene);
    drainPipeVert.position.set(-tankRadius - 0.73, bottomY + 0.06, 0);
    drainPipeVert.material = copperMat;

    // L. Heavy-Duty Pressure Gauge Dial removed per user request

    // M. IP65 Weatherproof Industrial Control Box
    const boxBase = MeshBuilder.CreateBox('boxBase', { width: 1.0, height: 1.3, depth: 0.32 }, scene);
    boxBase.position.set(-1.8, 0.4, -1.4);
    const boxBaseMat = new StandardMaterial('boxBaseMat', scene);
    boxBaseMat.diffuseColor = new Color3(0.16, 0.18, 0.22); // Industrial control box grey
    boxBaseMat.specularColor = new Color3(0.3, 0.3, 0.35);
    boxBase.material = boxBaseMat;

    // Translucent glass polycarbonate cover
    const boxCover = MeshBuilder.CreateBox('boxCover', { width: 1.0, height: 1.3, depth: 0.1 }, scene);
    boxCover.position.set(-1.8, 0.4, -1.19);
    const boxCoverMat = new StandardMaterial('boxCoverMat', scene);
    boxCoverMat.diffuseColor = new Color3(0.9, 0.95, 1.0);
    boxCoverMat.specularColor = new Color3(1.0, 1.0, 1.0);
    boxCoverMat.specularPower = 96;
    boxCoverMat.alpha = 0.22;
    boxCover.material = boxCoverMat;

    // Tiny metal corner assembly bolts
    const boltPositions = [
      [-2.25, 1.0], [-1.35, 1.0], [-2.25, -0.2], [-1.35, -0.2]
    ];
    boltPositions.forEach((pos, idx) => {
      const bolt = MeshBuilder.CreateCylinder(`bolt_${idx}`, { height: 0.04, diameter: 0.05 }, scene);
      bolt.position.set(pos[0], pos[1], -1.14);
      bolt.rotation.x = Math.PI / 2;
      bolt.material = chromeMat;
    });

    // ESP32 Microcontroller inside the enclosure (using setParent to preserve exact positions)
    const espBoard = MeshBuilder.CreateBox('espBoard', { width: 0.1, height: 0.48, depth: 0.28 }, scene);
    espBoard.position.set(-1.95, 0.52, -1.35);
    espBoard.material = pcbMat;

    const espAntenna = MeshBuilder.CreateBox('espAntenna', { width: 0.08, height: 0.08, depth: 0.1 }, scene);
    espAntenna.position.set(-1.95, 0.78, -1.35);
    espAntenna.material = plasticMat;
    espAntenna.setParent(espBoard);

    const espLed = MeshBuilder.CreateSphere('espLed', { diameter: 0.04 }, scene);
    espLed.position.set(-1.9, 0.58, -1.35);
    const espLedMat = new StandardMaterial('espLedMat', scene);
    espLedMat.diffuseColor = new Color3(0.08, 0.95, 0.08);
    espLedMat.emissiveColor = new Color3(0.04, 0.8, 0.04);
    espLed.material = espLedMat;
    espLed.setParent(espBoard);

    // Solid blue relay module inside control box (using setParent to resolve the floating bug!)
    const relayBoard = MeshBuilder.CreateBox('relayBoard', { width: 0.1, height: 0.38, depth: 0.38 }, scene);
    relayBoard.position.set(-1.7, 0.22, -1.35);
    relayBoard.material = pcbMat;

    const relayCube = MeshBuilder.CreateBox('relayCube', { width: 0.12, height: 0.18, depth: 0.18 }, scene);
    relayCube.position.set(-1.7, 0.22, -1.25);
    relayCube.material = relayMat;
    relayCube.setParent(relayBoard);

    // High-fidelity water level LED indicator bar graph on the control box front cover
    const ledMaterials: StandardMaterial[] = [];
    
    // LED panel bezel background
    const ledBezel = MeshBuilder.CreateBox('ledBezel', { width: 0.18, height: 0.8, depth: 0.02 }, scene);
    ledBezel.position.set(-1.5, 0.4, -1.135);
    const bezelMat = new StandardMaterial('bezelMat', scene);
    bezelMat.diffuseColor = new Color3(0.05, 0.06, 0.08);
    bezelMat.specularColor = new Color3(0.1, 0.1, 0.1);
    ledBezel.material = bezelMat;
    ledBezel.setParent(boxCover);

    // Create 5 vertical segment indicators (representing 20%, 40%, 60%, 80%, 100%)
    for (let i = 0; i < 5; i++) {
      const ledSeg = MeshBuilder.CreateBox(`ledSeg_${i}`, { width: 0.1, height: 0.1, depth: 0.01 }, scene);
      ledSeg.position.set(-1.5, 0.12 + (i * 0.14), -1.12);
      
      const ledMat = new StandardMaterial(`ledSegMat_${i}`, scene);
      ledMat.specularColor = new Color3(0.2, 0.2, 0.2);
      ledSeg.material = ledMat;
      ledSeg.setParent(boxCover);
      
      ledMaterials.push(ledMat);
    }

    // Shared DynamicTexture for the high-fidelity red IoT logo
    const iotLogoTex = new DynamicTexture('iotLogoTex', 512, scene, true);
    const logoCtx = iotLogoTex.getContext() as any;
    logoCtx.clearRect(0, 0, 512, 512);

    logoCtx.fillStyle = '#ef231c';
    logoCtx.strokeStyle = '#ef231c';

    // 1. Left vertical pill
    logoCtx.beginPath();
    logoCtx.roundRect(40, 150, 48, 240, 24);
    logoCtx.fill();

    // 2. Connector from pill to oval
    logoCtx.beginPath();
    logoCtx.fillRect(80, 250, 90, 32);

    // 3. Diagonal pipe to top-left ring
    logoCtx.beginPath();
    logoCtx.lineWidth = 24;
    logoCtx.lineCap = 'round';
    logoCtx.moveTo(70, 70);
    logoCtx.lineTo(170, 170);
    logoCtx.stroke();

    // 4. Top-left ring
    logoCtx.beginPath();
    logoCtx.arc(70, 70, 32, 0, Math.PI * 2);
    logoCtx.fill();

    // 5. Outer central oval
    logoCtx.beginPath();
    logoCtx.ellipse(225, 266, 80, 110, 0, 0, Math.PI * 2);
    logoCtx.fill();

    // 6. Horizontal crossbar of 't'
    logoCtx.beginPath();
    logoCtx.fillRect(220, 140, 210, 32);

    // 7. Vertical stem of 't' with curved bottom hook
    logoCtx.beginPath();
    logoCtx.lineWidth = 48;
    logoCtx.lineCap = 'round';
    logoCtx.lineJoin = 'round';
    logoCtx.moveTo(369, 80);
    logoCtx.lineTo(369, 310);
    logoCtx.quadraticCurveTo(369, 350, 420, 350);
    logoCtx.stroke();

    // Cutouts via DESTINATION-OUT to make parts transparent
    logoCtx.globalCompositeOperation = 'destination-out';

    // A. Top-left ring hole
    logoCtx.beginPath();
    logoCtx.arc(70, 70, 14, 0, Math.PI * 2);
    logoCtx.fill();

    // B. Inner cutout of central oval
    logoCtx.beginPath();
    logoCtx.ellipse(225, 266, 40, 70, 0, 0, Math.PI * 2);
    logoCtx.fill();

    // C. Left connector cutout circle
    logoCtx.beginPath();
    logoCtx.arc(105, 266, 12, 0, Math.PI * 2);
    logoCtx.fill();

    // D. Top-right connector cutout circle
    logoCtx.beginPath();
    logoCtx.arc(285, 156, 12, 0, Math.PI * 2);
    logoCtx.fill();

    logoCtx.globalCompositeOperation = 'source-over';

    // Draw "Smart Tank" brand text below the logo
    logoCtx.font = "bold 44px 'Space Grotesk', Arial, sans-serif";
    logoCtx.fillStyle = '#ef231c';
    logoCtx.textAlign = 'center';
    logoCtx.fillText('Smart Tank', 225, 435);

    iotLogoTex.update();

    // Create Logo Material with alpha channel & glow emission
    const iotLogoMat = new StandardMaterial('iotLogoMat', scene);
    iotLogoMat.diffuseTexture = iotLogoTex;
    iotLogoMat.emissiveTexture = iotLogoTex;
    iotLogoMat.diffuseTexture.hasAlpha = true;
    iotLogoMat.useAlphaFromDiffuseTexture = true;
    iotLogoMat.backFaceCulling = true;

    // B. Logo Plane on the Tank Cylinder (front-right, middle height)
    const tankLogo = MeshBuilder.CreatePlane('tankLogo', { width: 0.52, height: 0.52 }, scene);
    const tankLogoAngle = -0.55; // Angle placing the logo on the front-left/center surface, fully visible from camera
    const tankLogoRadius = tankRadius + 0.015;
    tankLogo.position.set(tankLogoRadius * Math.sin(tankLogoAngle), -0.4, tankLogoRadius * Math.cos(tankLogoAngle));
    tankLogo.rotation.y = tankLogoAngle + Math.PI; // Face outward from cylinder center
    tankLogo.material = iotLogoMat;

    // N. Routing Cables & Wiring Conduits
    // Solid corrugated conduit sleeves routing wire cleanly
    // cond1 removed per user request

    const cond2 = MeshBuilder.CreateCylinder('cond2', { height: 1.25, diameter: 0.045 }, scene);
    cond2.position.set(-0.95, 1.6, -1.45);
    cond2.material = conduitMat;

    // Sensor cable from ultrasonic sensor to control box conduit (cond2)
    const curvePoints: Vector3[] = [];
    const startPoint = new Vector3(0, 2.06, -0.05);
    const endPoint = new Vector3(-0.95, 2.225, -1.45);
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startPoint.x + (endPoint.x - startPoint.x) * t;
      const z = startPoint.z + (endPoint.z - startPoint.z) * t;
      const yBase = startPoint.y + (endPoint.y - startPoint.y) * t;
      const sag = -0.15 * Math.sin(t * Math.PI);
      curvePoints.push(new Vector3(x, yBase + sag, z));
    }
    const sensorCable = MeshBuilder.CreateTube('sensorCable', {
      path: curvePoints,
      radius: 0.016,
      tessellation: 12
    }, scene);
    sensorCable.material = conduitMat;

    const cond3 = MeshBuilder.CreateCylinder('cond3', { height: 0.82, diameter: 0.045 }, scene);
    cond3.position.set(-1.38, 1.0, -1.4);
    cond3.rotation.z = Math.PI / 2;
    cond3.material = conduitMat;

    // Pump power wire routing along base
    const pumpWire = MeshBuilder.CreateCylinder('pumpWire', { height: 2.8, diameter: 0.035 }, scene);
    pumpWire.position.set(0.0, bottomY + 0.04, -1.35);
    pumpWire.rotation.z = Math.PI / 2;
    pumpWire.material = conduitMat;

    // O. Dynamic Rising Bubble Particles (Spawned inside the glass tank)
    const bubbleCount = 7;
    const bubbles: Mesh[] = [];
    const bubbleMat = new StandardMaterial('bubbleMat', scene);
    bubbleMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
    bubbleMat.emissiveColor = new Color3(0.5, 0.8, 1.0);
    bubbleMat.alpha = 0.55;
    bubbleMat.specularColor = new Color3(1.0, 1.0, 1.0);
    bubbleMat.specularPower = 32;

    for (let i = 0; i < bubbleCount; i++) {
      const bubble = MeshBuilder.CreateSphere(`bubble_${i}`, { diameter: 0.035 + Math.random() * 0.03 }, scene);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (tankRadius - 0.22);
      bubble.position.set(Math.cos(angle) * dist, bottomY + 0.15 + Math.random() * 3.4, Math.sin(angle) * dist);
      bubble.material = bubbleMat;
      bubbles.push(bubble);
    }

    // P. Dynamic Setpoint Threshold Torus Rings (Adjustable levels)
    const highRing = MeshBuilder.CreateTorus('highRing', { diameter: (tankRadius + 0.02) * 2, thickness: 0.035, tessellation: 36 }, scene);
    highRing.material = highMat;

    const lowRing = MeshBuilder.CreateTorus('lowRing', { diameter: (tankRadius + 0.02) * 2, thickness: 0.035, tessellation: 36 }, scene);
    lowRing.material = lowMat;

    // ----------------------------------------------------
    // Q. REALISTIC SOFT SHADOW GENERATION
    // ----------------------------------------------------
    const shadowGenerator = new ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 24;

    // Add casters
    shadowGenerator.addShadowCaster(tankCylinder);
    shadowGenerator.addShadowCaster(waterCylinder);
    shadowGenerator.addShadowCaster(pumpMotor);
    shadowGenerator.addShadowCaster(pumpHead);
    shadowGenerator.addShadowCaster(pumpImpeller);
    shadowGenerator.addShadowCaster(capacitorBox);
    shadowGenerator.addShadowCaster(fanCover);
    shadowGenerator.addShadowCaster(boxBase);
    shadowGenerator.addShadowCaster(inletPipeVert);
    shadowGenerator.addShadowCaster(inletPipeHoriz2);
    shadowGenerator.addShadowCaster(inletPipeDown);
    shadowGenerator.addShadowCaster(sensorCable);
    shadowGenerator.addShadowCaster(extInletHoriz);
    shadowGenerator.addShadowCaster(extInletVert);
    shadowGenerator.addShadowCaster(valveBody);
    shadowGenerator.addShadowCaster(valveActuator);

    // ----------------------------------------------------
    // R. ANIMATION / SIMULATION RENDER LOOP
    // ----------------------------------------------------
    let signalPulseTimer = 0;
    let frameCount = 0;

    scene.onBeforeRenderObservable.add(() => {
      frameCount++;
      const currentVol = volumeRef.current;
      const isPumpOn = pumpRef.current === 'ON';
      const maxVol = tankConfigRef.current.maxVolume;
      const lowThresh = tankConfigRef.current.lowThreshold;
      const highThresh = tankConfigRef.current.highThreshold;
      const currentTheme = themeRef.current;

      // Reactively adjust dynamic water level colors matching app theme preset
      const updatedColors = getThemePresetColor();
      waterMat.diffuseColor = updatedColors.accent;
      surfaceMat.diffuseColor = updatedColors.accent.scale(1.15);
      flowMat.diffuseColor = updatedColors.accent;
      flowMat.emissiveColor = updatedColors.accent.scale(0.5);
      
      // Update ambient illumination
      light.intensity = currentTheme.ambientIntensity * 0.95;
      dirLight.intensity = 0.85 * currentTheme.ambientIntensity;

      // A. Fluid Volume Calculation & Scaling
      const fillPercentage = Math.min(Math.max(currentVol / maxVol, 0.015), 1.0);
      const targetHeight = fillPercentage * maxWaterHeight;
      
      // Smoothly interpolate height scale to avoid hard snapping
      waterCylinder.scaling.y = waterCylinder.scaling.y * 0.88 + targetHeight * 0.12;
      waterCylinder.position.y = bottomY + 0.05 + (waterCylinder.scaling.y / 2);

      // Top surface film sits directly on top of the dynamic cylinder height
      waterSurfaceDisc.position.y = bottomY + 0.05 + waterCylinder.scaling.y;
      // Gently rotate surface to mimic fluid movement
      waterSurfaceDisc.rotation.y += 0.003;

      // B. Dynamic Bubble Physics Simulation (Bubbles rise when pump flows)
      bubbles.forEach((b, idx) => {
        if (isPumpOn) {
          b.setEnabled(true);
          b.position.y += 0.024 + (idx % 3) * 0.008;
          b.position.x += Math.sin(frameCount * 0.04 + idx) * 0.004;
          b.position.z += Math.cos(frameCount * 0.05 + idx) * 0.004;
          
          // Reset to bottom once surface is breached
          if (b.position.y > (bottomY + waterCylinder.scaling.y)) {
            b.position.y = bottomY + 0.15;
            b.position.x = (Math.random() - 0.5) * (tankRadius - 0.3);
            b.position.z = (Math.random() - 0.5) * (tankRadius - 0.3);
          }
        } else {
          // Slow floating rise then turn off
          if (b.position.y < (bottomY + waterCylinder.scaling.y)) {
            b.position.y += 0.005;
          } else {
            b.setEnabled(false);
          }
        }
      });

      // C. Update Setpoint Rings
      const highPercentage = highThresh / maxVol;
      const lowPercentage = lowThresh / maxVol;
      highRing.position.y = bottomY + 0.05 + (highPercentage * maxWaterHeight);
      lowRing.position.y = bottomY + 0.05 + (lowPercentage * maxWaterHeight);

      // D. Ultrasonic Ping Signal Waves Simulation
      signalPulseTimer += 0.04;
      if (signalPulseTimer > 1.0) signalPulseTimer = 0;

      const waterSurfaceY = bottomY + 0.05 + waterCylinder.scaling.y;
      
      // First wave
      const scale1 = 0.22 + signalPulseTimer * 1.6;
      signalRing1.scaling.set(scale1, 1, scale1);
      signalRing1.position.y = (topY - 0.12) - (signalPulseTimer * ((topY - 0.12) - waterSurfaceY));
      (signalRing1.material as StandardMaterial).alpha = (1.0 - signalPulseTimer) * 0.5;

      // Offset second wave
      let p2Timer = signalPulseTimer + 0.5;
      if (p2Timer > 1.0) p2Timer -= 1.0;
      const scale2 = 0.22 + p2Timer * 1.6;
      signalRing2.scaling.set(scale2, 1, scale2);
      signalRing2.position.y = (topY - 0.12) - (p2Timer * ((topY - 0.12) - waterSurfaceY));
      (signalRing2.material as StandardMaterial).alpha = (1.0 - p2Timer) * 0.5;

      // E. Microcontroller Status Led (Heartbeat)
      if (frameCount % 45 === 0) {
        espLedMat.emissiveColor = new Color3(0.08, 0.95, 0.08);
      } else if (frameCount % 45 === 12) {
        espLedMat.emissiveColor = new Color3(0.01, 0.1, 0.01);
      }

      // F. Liquid Conduit Flow Animation & 3D Flow Arrows
      if (isPumpOn && fillPercentage < 1.0) {
        inletFlow.setEnabled(true);
        // Animate flow direction along horizontal pipe
        inletFlow.position.x -= 0.04;
        if (inletFlow.position.x < 0.75) {
          inletFlow.position.x = 1.75;
        }
        // Rotate horizontal impeller gently along Z-axis
        pumpImpeller.rotation.z += 0.12;

        // Inflow Green Arrows Animation
        greenArrow1.setEnabled(true);
        greenArrow2.setEnabled(true);
        greenArrow3.setEnabled(true);
        greenArrow4.setEnabled(true);
        greenArrow5.setEnabled(true);

        // Green Arrow 1: Horiz inlet (-X)
        greenArrow1.position.x -= 0.015;
        if (greenArrow1.position.x < 1.8) {
          greenArrow1.position.x = 2.4;
        }

        // Green Arrow 2 & 3: Vertical rise (+Y)
        greenArrow2.position.y += 0.02;
        if (greenArrow2.position.y > 2.32) {
          greenArrow2.position.y = bottomY + 0.22;
        }
        greenArrow3.position.y += 0.02;
        if (greenArrow3.position.y > 2.32) {
          greenArrow3.position.y = bottomY + 0.22;
        }

        // Green Arrow 4: Horiz top (-X)
        greenArrow4.position.x -= 0.018;
        if (greenArrow4.position.x < 0.7) {
          greenArrow4.position.x = 1.8;
        }

        // Green Arrow 5: Vert top down (-Y)
        greenArrow5.position.y -= 0.012;
        if (greenArrow5.position.y < 2.04) {
          greenArrow5.position.y = 2.32;
        }
      } else {
        inletFlow.setEnabled(false);
        greenArrow1.setEnabled(false);
        greenArrow2.setEnabled(false);
        greenArrow3.setEnabled(false);
        greenArrow4.setEnabled(false);
        greenArrow5.setEnabled(false);
      }

      // 2. Outflow Red Arrows Animation
      const activeDrain = isDrainingRef.current && fillPercentage > 0.015;
      if (activeDrain) {
        redArrow1.setEnabled(true);
        redArrow2.setEnabled(true);

        // Red Arrow 1: Horiz drain (-X)
        redArrow1.position.x -= 0.015;
        if (redArrow1.position.x < -1.88) {
          redArrow1.position.x = -1.15;
        }

        // Red Arrow 2: Vert drain down (-Y)
        redArrow2.position.y -= 0.015;
        if (redArrow2.position.y < bottomY) {
          redArrow2.position.y = bottomY + 0.22;
        }
      } else {
        redArrow1.setEnabled(false);
        redArrow2.setEnabled(false);
      }

      // Update Motorized Valve LED based on drainage state
      if (activeDrain) {
        valveLedMat.diffuseColor = new Color3(0.1, 0.9, 0.1); // Bright green when valve is open (draining)
        valveLedMat.emissiveColor = new Color3(0.04, 0.7, 0.04);
      } else {
        valveLedMat.diffuseColor = new Color3(0.9, 0.1, 0.1); // Bright red when valve is closed (standby)
        valveLedMat.emissiveColor = new Color3(0.6, 0.02, 0.02);
      }

      // G. Update Water Level LED indicator segment colors on the front of control box
      const ledThresholds = [0.15, 0.35, 0.55, 0.75, 0.92];
      const ledColors = [
        { on: new Color3(0.9, 0.1, 0.1), off: new Color3(0.15, 0.03, 0.03), emOn: new Color3(0.7, 0.05, 0.05), emOff: new Color3(0.02, 0, 0) },   // Segment 0: Red (Low)
        { on: new Color3(0.9, 0.7, 0.1), off: new Color3(0.15, 0.12, 0.02), emOn: new Color3(0.7, 0.45, 0.05), emOff: new Color3(0.02, 0.01, 0) }, // Segment 1: Yellow (Low-Mid)
        { on: new Color3(0.1, 0.9, 0.1), off: new Color3(0.02, 0.15, 0.02), emOn: new Color3(0.05, 0.7, 0.05), emOff: new Color3(0, 0.02, 0) },   // Segment 2: Green (Mid)
        { on: new Color3(0.1, 0.9, 0.1), off: new Color3(0.02, 0.15, 0.02), emOn: new Color3(0.05, 0.7, 0.05), emOff: new Color3(0, 0.02, 0) },   // Segment 3: Green (Mid-High)
        { on: new Color3(0.1, 0.7, 0.9), off: new Color3(0.02, 0.12, 0.15), emOn: new Color3(0.05, 0.45, 0.7), emOff: new Color3(0, 0.01, 0.02) }, // Segment 4: Cyan/Blue (High/Full)
      ];

      for (let i = 0; i < 5; i++) {
        const mat = ledMaterials[i];
        if (mat) {
          const isOn = fillPercentage >= ledThresholds[i];
          mat.diffuseColor = isOn ? ledColors[i].on : ledColors[i].off;
          mat.emissiveColor = isOn ? ledColors[i].emOn : ledColors[i].emOff;
        }
      }
    });

    // Run Render Loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // 12. Handle Resize cleanly (Canvas/Stage Sizing Observer)
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (isAlive) {
          engine.resize();
        }
      });
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup on unmount
    return () => {
      isAlive = false;
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, []); // Run once on mount

  if (!webGlSupported) {
    const maxVol = tankConfig.maxVolume;
    const currentVol = deviceState.currentVolume;
    const lowThresh = tankConfig.lowThreshold;
    const highThresh = tankConfig.highThreshold;
    const isPumpOn = deviceState.pumpStatus;

    const fillPercent = Math.min(Math.max(currentVol / maxVol, 0), 1);
    const lowPercent = Math.min(Math.max(lowThresh / maxVol, 0), 1);
    const highPercent = Math.min(Math.max(highThresh / maxVol, 0), 1);

    const getPresetColors = () => {
      switch (theme.themePreset) {
        case 'emerald-clean':
          return {
            water: '#10b981',
            bg: '#022c22',
            border: '#047857',
            accent: '#34d399',
          };
        case 'cyberpunk':
          return {
            water: '#ec4899',
            bg: '#180026',
            border: '#d946ef',
            accent: '#f43f5e',
          };
        case 'monochrome':
          return {
            water: '#94a3b8',
            bg: '#0f172a',
            border: '#64748b',
            accent: '#cbd5e1',
          };
        case 'blue-tech':
        default:
          return {
            water: '#0ea5e9',
            bg: '#030712',
            border: '#0284c7',
            accent: '#38bdf8',
          };
      }
    };

    const colors = getPresetColors();
    const waterHeight = fillPercent * 340; // Total height is 340px
    const waterY = 440 - waterHeight; // Tank bottom is y=440
    
    const lowY = 440 - lowPercent * 340;
    const highY = 440 - highPercent * 340;

    const activeDrain = isDraining && currentVol > (maxVol * 0.015);

    return (
      <div className="flex flex-col h-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes flow-inflow-discharge {
            0% { stroke-dashoffset: 24; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes flow-drain {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 24; }
          }
          @keyframes spin-rotor {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes float-bubble-1 {
            0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            100% { transform: translate(10px, -150px) scale(1.2); opacity: 0; }
          }
          @keyframes float-bubble-2 {
            0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
            15% { opacity: 0.5; }
            85% { opacity: 0.5; }
            100% { transform: translate(-15px, -200px) scale(1.1); opacity: 0; }
          }
          @keyframes float-bubble-3 {
            0% { transform: translate(0, 0) scale(0.9); opacity: 0; }
            5% { opacity: 0.7; }
            95% { opacity: 0.7; }
            100% { transform: translate(5px, -100px) scale(1.3); opacity: 0; }
          }
          @keyframes pulse-sensor {
            0% { transform: scale(0.8); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .animate-flow-in-2d {
            stroke-dasharray: 8, 4;
            animation: flow-inflow-discharge 1s linear infinite;
          }
          .animate-flow-out-2d {
            stroke-dasharray: 8, 4;
            animation: flow-drain 1s linear infinite;
          }
          .animate-rotor-2d {
            animation: spin-rotor 0.8s linear infinite;
            transform-origin: 625px 435px;
          }
          .animate-bubble-1-2d {
            animation: float-bubble-1 4s infinite linear;
          }
          .animate-bubble-2-2d {
            animation: float-bubble-2 5s infinite linear;
          }
          .animate-bubble-3-2d {
            animation: float-bubble-3 3s infinite linear;
          }
          .animate-sensor-ping-2d {
            animation: pulse-sensor 1.5s infinite ease-out;
            transform-origin: 400px 75px;
          }
        `}} />

        <div className="relative flex-1 bg-[#06080b] border border-white/10 rounded-lg overflow-hidden min-h-[420px] lg:min-h-[520px] flex items-center justify-center p-4">
          {/* Floating Technical Overlay */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none space-y-1.5 font-mono">
            <div className="px-3 py-1 bg-[#080a0e]/95 text-amber-500 rounded border border-white/10 text-[9px] flex items-center gap-1.5 shadow-md">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
              <span>SYSTEM::2D_FALLBACK_ACTIVE (NO_WEBGL)</span>
            </div>
            <div className="px-3 py-2 bg-[#080a0e]/95 rounded text-[10px] shadow-md border border-white/10 pointer-events-auto">
              <p className="text-slate-500 uppercase text-[8px] tracking-wider font-bold">Physical Assembly</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-semibold text-white">INTEGRATED_PLANT: OK</span>
                <span className="text-[9px] text-amber-500 font-mono">(FLOW SIMULATION: ON)</span>
              </div>
            </div>
          </div>

          {/* SVG 2D Interactive schematic of the system */}
          <svg viewBox="0 0 800 600" className="w-full max-w-[720px] h-auto drop-shadow-2xl">
            {/* Grids for professional schematic look */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
              </pattern>
              <linearGradient id="tankGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={colors.water} stopOpacity="0.15" />
                <stop offset="50%" stopColor={colors.water} stopOpacity="0.03" />
                <stop offset="100%" stopColor={colors.water} stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={colors.water} stopOpacity="0.7" />
                <stop offset="50%" stopColor={colors.water} stopOpacity="0.4" />
                <stop offset="100%" stopColor={colors.water} stopOpacity="0.8" />
              </linearGradient>
              <mask id="iotLogoMask2D">
                <rect x="0" y="0" width="512" height="512" fill="#ffffff" />
                <circle cx="70" cy="70" r="14" fill="#000000" />
                <ellipse cx="225" cy="266" rx="40" ry="70" fill="#000000" />
                <circle cx="105" cy="266" r="12" fill="#000000" />
                <circle cx="285" cy="156" r="12" fill="#000000" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* PIPELINE - SUCTION PIPE (From bottom to Pump) */}
            <path d="M 625,520 L 625,435" stroke="#854d0e" strokeWidth="14" fill="none" strokeLinecap="round" />
            <path d="M 625,520 L 625,435" stroke="#b87333" strokeWidth="10" fill="none" strokeLinecap="round" />
            {isPumpOn && fillPercent < 1 && (
              <path d="M 625,520 L 625,435" stroke="#38bdf8" strokeWidth="5" fill="none" className="animate-flow-in-2d" />
            )}

            {/* PIPELINE - DISCHARGE PIPE (From Pump to Top) */}
            <path d="M 625,410 L 625,50 L 400,50 L 400,100" stroke="#854d0e" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 625,410 L 625,50 L 400,50 L 400,100" stroke="#b87333" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {isPumpOn && fillPercent < 1 && (
              <path d="M 625,410 L 625,50 L 400,50 L 400,100" stroke="#38bdf8" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="animate-flow-in-2d" />
            )}

            {/* PIPELINE - OUTFLOW DRAIN PIPE (From Tank bottom-left to floor) */}
            <path d="M 250,420 L 100,420 L 100,520" stroke="#854d0e" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 250,420 L 100,420 L 100,520" stroke="#b87333" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {activeDrain && (
              <path d="M 250,420 L 100,420 L 100,520" stroke="#ef4444" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="animate-flow-out-2d" />
            )}

            {/* 2D MOTORIZED VALVE (Positioned on the Horizontal Drain Pipeline) */}
            <g transform="translate(0, 0)">
              {/* Valve Neck */}
              <rect x="172" y="394" width="6" height="14" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
              
              {/* Triangular Valve body gates */}
              <polygon points="160,410 160,430 175,420" fill="#64748b" stroke="#475569" strokeWidth="1.5" />
              <polygon points="190,410 190,430 175,420" fill="#64748b" stroke="#475569" strokeWidth="1.5" />
              <circle cx="175" cy="420" r="7" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
              
              {/* Actuator Mounting Ears */}
              <rect x="156" y="378" width="4" height="12" rx="1" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
              <rect x="190" y="378" width="4" height="12" rx="1" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />

              {/* Actuator White Housing */}
              <rect x="160" y="374" width="30" height="20" rx="3" fill="#f8fafc" stroke="#475569" strokeWidth="2" />
              
              {/* Status LED Indicator */}
              <circle cx="175" cy="384" r="3.5" fill={activeDrain ? "#22c55e" : "#ef4444"} />
              {activeDrain && (
                <circle cx="175" cy="384" r="3.5" fill="#22c55e" className="animate-ping opacity-75" />
              )}
            </g>

            {/* FLOW INDICATORS (Green >> / Red >> Beside Pipes per user's requests) */}
            {/* Green chevron 1: Suction rise (pointing up) */}
            <g transform="translate(642, 485) rotate(-90)">
              <path d="M-4,-4 L0,0 L-4,4 M1,-4 L5,0 L1,4" stroke="#10b981" strokeWidth="2" fill="none" className={isPumpOn && fillPercent < 1 ? "animate-pulse" : ""} />
            </g>
            {/* Green chevron 2: Discharge rise (pointing up) */}
            <g transform="translate(642, 240) rotate(-90)">
              <path d="M-4,-4 L0,0 L-4,4 M1,-4 L5,0 L1,4" stroke="#10b981" strokeWidth="2" fill="none" className={isPumpOn && fillPercent < 1 ? "animate-pulse" : ""} />
            </g>
            {/* Green chevron 3: Horizontal overhead (pointing left) */}
            <g transform="translate(512, 32) rotate(180)">
              <path d="M-4,-4 L0,0 L-4,4 M1,-4 L5,0 L1,4" stroke="#10b981" strokeWidth="2" fill="none" className={isPumpOn && fillPercent < 1 ? "animate-pulse" : ""} />
            </g>
            {/* Green chevron 4: Tank top down entry (pointing down) */}
            <g transform="translate(418, 80) rotate(90)">
              <path d="M-4,-4 L0,0 L-4,4 M1,-4 L5,0 L1,4" stroke="#10b981" strokeWidth="2" fill="none" className={isPumpOn && fillPercent < 1 ? "animate-pulse" : ""} />
            </g>

            {/* Red chevron 1: Horizontal drain left (pointing left) */}
            <g transform="translate(175, 402) rotate(180)">
              <path d="M-4,-4 L0,0 L-4,4 M1,-4 L5,0 L1,4" stroke="#ef4444" strokeWidth="2" fill="none" className={activeDrain ? "animate-pulse" : ""} />
            </g>
            {/* Red chevron 2: Vertical drain down (pointing down) */}
            <g transform="translate(82, 470) rotate(90)">
              <path d="M-4,-4 L0,0 L-4,4 M1,-4 L5,0 L1,4" stroke="#ef4444" strokeWidth="2" fill="none" className={activeDrain ? "animate-pulse" : ""} />
            </g>

            {/* WATER TANK SHAPE */}
            {/* Tank shadow & body area */}
            <rect x="250" y="100" width="300" height="340" fill="url(#tankGlow)" rx="4" />
            <rect x="250" y="100" width="300" height="340" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.15" rx="4" />

            {/* Dynamic Water Volume filling */}
            {fillPercent > 0.001 && (
              <g>
                <rect x="252" y={waterY} width="296" height={waterHeight - 1} fill="url(#waterGrad)" rx="2" />
                {/* Simulated wavy top boundary of water surface */}
                <ellipse cx="400" cy={waterY} rx="148" ry="8" fill={colors.water} opacity="0.8" />
                
                {/* Bubbles float-up effect when Pump is on */}
                {isPumpOn && fillPercent < 1 && (
                  <g>
                    <circle cx="350" cy={420} r="3" fill="#ffffff" opacity="0.7" className="animate-bubble-1-2d" />
                    <circle cx="380" cy={410} r="4" fill="#ffffff" opacity="0.5" className="animate-bubble-2-2d" />
                    <circle cx="430" cy={430} r="2.5" fill="#ffffff" opacity="0.6" className="animate-bubble-3-2d" />
                    <circle cx="450" cy={400} r="3.5" fill="#ffffff" opacity="0.4" className="animate-bubble-1-2d" />
                    <circle cx="310" cy={430} r="3" fill="#ffffff" opacity="0.6" className="animate-bubble-2-2d" />
                  </g>
                )}
              </g>
            )}

            {/* Tank Scales / Ticks (Liter level metrics) */}
            {Array.from({ length: 9 }).map((_, idx) => {
              const tickVol = Math.round((maxVol / 10) * (idx + 1));
              const tickY = 440 - ((idx + 1) / 10) * 340;
              return (
                <g key={idx} opacity="0.4">
                  <line x1="250" y1={tickY} x2="262" y2={tickY} stroke="#ffffff" strokeWidth="1" />
                  <line x1="538" y1={tickY} x2="550" y2={tickY} stroke="#ffffff" strokeWidth="1" />
                  <text x="268" y={tickY + 3} fill="#ffffff" fontSize="9" fontFamily="monospace" textAnchor="start">
                    {tickVol}L
                  </text>
                </g>
              );
            })}

            {/* MIN THRESHOLD INDICATOR LINE */}
            <line x1="240" y1={lowY} x2="560" y2={lowY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6,4" />
            <text x="565" y={lowY + 4} fill="#f59e0b" fontSize="9" fontFamily="monospace" fontWeight="bold">
              LOW: {Math.round(lowThresh)}L
            </text>

            {/* MAX THRESHOLD INDICATOR LINE */}
            <line x1="240" y1={highY} x2="560" y2={highY} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6,4" />
            <text x="565" y={highY + 4} fill="#ef4444" fontSize="9" fontFamily="monospace" fontWeight="bold">
              HIGH: {Math.round(highThresh)}L
            </text>

            {/* Glass Cylinder Highlight gloss overlay */}
            <rect x="260" y="100" width="30" height="340" fill="#ffffff" fillOpacity="0.03" />
            <rect x="510" y="100" width="30" height="340" fill="#ffffff" fillOpacity="0.03" />

            {/* IoT Logo on the tank in 2D fallback */}
            <g transform="translate(425, 230) scale(0.15)" opacity="0.9">
              <g mask="url(#iotLogoMask2D)">
                <rect x="40" y="150" width="48" height="240" rx="24" fill="#ef4444" />
                <rect x="80" y="250" width="90" height="32" fill="#ef4444" />
                <line x1="70" y1="70" x2="170" y2="170" stroke="#ef4444" strokeWidth="24" strokeLinecap="round" />
                <circle cx="70" cy="70" r="32" fill="#ef4444" />
                <ellipse cx="225" cy="266" rx="80" ry="110" fill="#ef4444" />
                <rect x="220" y="140" width="210" height="32" fill="#ef4444" />
                <path d="M 369,80 L 369,310 A 48,48 0 0,0 417,358" fill="none" stroke="#ef4444" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <text x="225" y="435" fill="#ef4444" fontSize="44" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                Smart Tank
              </text>
            </g>

            {/* ULTRASONIC SENSOR (At the top of tank) */}
            <rect x="375" y="75" width="50" height="15" fill="#334155" rx="2" />
            {/* Left transducer */}
            <circle cx="388" cy="88" r="5" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="388" cy="88" r="2" fill="#1e293b" />
            {/* Right transducer */}
            <circle cx="412" cy="88" r="5" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="412" cy="88" r="2" fill="#1e293b" />
            
            {/* Dynamic Signal Beam Pings from sensor to water */}
            <g opacity="0.3">
              <ellipse cx="400" cy="98" rx="6" ry="2" fill="none" stroke="#60a5fa" strokeWidth="1" className="animate-sensor-ping-2d" />
              <ellipse cx="400" cy="98" rx="12" ry="4" fill="none" stroke="#60a5fa" strokeWidth="1.5" className="animate-sensor-ping-2d" style={{ animationDelay: '0.5s' }} />
            </g>

            {/* WATER PUMP UNIT ASSEMBLY */}
            {/* Pump body frame */}
            <rect x="590" y="410" width="70" height="50" fill="#0f766e" stroke="#115e59" strokeWidth="2" rx="4" />
            <rect x="650" y="420" width="15" height="30" fill="#1e293b" rx="2" />
            {/* Impeller cover */}
            <circle cx="625" cy="435" r="20" fill="#14b8a6" stroke="#0d9488" strokeWidth="1.5" />
            <circle cx="625" cy="435" r="18" fill="#115e59" />

            {/* Rotor Blades inside the pump */}
            <g className={isPumpOn ? "animate-rotor-2d" : ""}>
              <line x1="625" y1="417" x2="625" y2="453" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="607" y1="435" x2="643" y2="435" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
            </g>
            <circle cx="625" cy="435" r="5" fill="#f8fafc" />

            {/* Dynamic Status Badges inside schematic */}
            <g transform="translate(300, 520)">
              {/* Box container */}
              <rect width="200" height="50" fill="#080a0e" stroke="rgba(255,255,255,0.1)" strokeWidth="1" rx="4" />
              
              {/* Pump Status Led */}
              <circle cx="25" cy="25" r="6" fill={isPumpOn ? "#10b981" : "#ef4444"} className={isPumpOn ? "animate-pulse" : ""} />
              <text x="40" y="22" fill="#ffffff" fontSize="10" fontFamily="monospace" fontWeight="bold">
                POMPA AIR: {isPumpOn ? "AKTIF" : "MATI"}
              </text>
              <text x="40" y="38" fill={isPumpOn ? "#10b981" : "#94a3b8"} fontSize="8" fontFamily="monospace">
                {isPumpOn ? "MENGALIRKAN AIR MASUK" : "STANDBY"}
              </text>
            </g>
          </svg>

          {/* SCADA Interactive HUD & Tooltips */}
          {renderHUD()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 3D Canvas stage container */}
      <div 
        ref={containerRef} 
        className="relative flex-1 bg-[#06080b] border border-white/10 rounded-lg overflow-hidden min-h-[420px] lg:min-h-[520px]"
        id="canvas-3d-stage"
      >
        {/* Floating Technical Overlay */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none space-y-1.5 font-mono">
          <div className="px-3 py-1 bg-[#080a0e]/95 text-cyan-400 rounded border border-white/10 text-[9px] flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
            <span>BABYLON_ENGINE::HIGH_RENDER_ACTIVE</span>
          </div>
          <div className="px-3 py-2 bg-[#080a0e]/95 rounded text-[10px] shadow-md border border-white/10 pointer-events-auto">
            <p className="text-slate-500 uppercase text-[8px] tracking-wider font-bold">Physical Assembly</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-semibold text-white">INTEGRATED_PLANT: OK</span>
              <span className="text-[9px] text-cyan-400 font-mono">(3D SHADOWS: ON)</span>
            </div>
          </div>
        </div>

        {/* Dynamic Canvas element */}
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block outline-none cursor-grab active:cursor-grabbing" 
        />

        {/* Dynamic instructions at bottom */}
        <div className="absolute bottom-4 left-4 right-4 z-10 text-center pointer-events-none font-mono">
          <span className="inline-block bg-[#080a0e]/95 text-slate-400 border border-white/5 rounded px-3 py-1 text-[9px] shadow-sm backdrop-blur-xs">
            DRAG MOUSE: PUTAR // SCROLL: ZOOM // KLIK KANAN: GESER
          </span>
        </div>

        {/* SCADA Interactive HUD & Tooltips */}
        {renderHUD()}
      </div>
    </div>
  );
};
