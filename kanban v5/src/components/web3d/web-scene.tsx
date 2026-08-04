'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Text, Line, MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { useKanbanStore, Task } from '@/store/kanban-store';

const STATUS_COLORS: Record<string, string> = {
  'todo': '#00d9ff',
  'in-progress': '#ff8c00',
  'review': '#ff3366',
  'done': '#00ff88',
};

const HEX_SIZE = 2;

function axialToPixel(q: number, r: number, size: number): [number, number] {
  return [
    size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    size * (1.5 * r),
  ];
}

function hexVertices3D(size: number): [number, number, number][] {
  const verts: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    verts.push([size * Math.cos(angle), size * Math.sin(angle), 0]);
  }
  return verts;
}

function HexOutline({ size, color, opacity = 1, lineWidth = 2 }: { size: number; color: string; opacity?: number; lineWidth?: number }) {
  const points = useMemo(() => {
    const v = hexVertices3D(size);
    return [...v, v[0]];
  }, [size]);
  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

function HexCell({ task, isSelected, onClick, isProject, childCount }: {
  task: Task; isSelected: boolean; onClick: () => void; isProject: boolean; childCount: number;
}) {
  const s = isProject ? HEX_SIZE * 0.92 : HEX_SIZE * 0.85;
  const [px, py] = axialToPixel(task.hexQ, task.hexR, HEX_SIZE);
  const color = STATUS_COLORS[task.status] || '#00d9ff';

  return (
    <group
      position={[px, py, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Glow ring when selected */}
      {isSelected && <HexOutline size={s * 1.08} color={color} opacity={0.2} lineWidth={4} />}
      {/* Main hex outline */}
      <HexOutline size={s} color={color} opacity={isSelected ? 1 : 0.7} lineWidth={isSelected ? 3 : 2} />

      {/* Label */}
      <Text
        position={[0, isProject ? -s * 0.45 : 0, 0.05]}
        fontSize={isProject ? 0.18 : 0.13}
        color={isSelected ? '#ffffff' : '#c0e8ff'}
        anchorX="center"
        anchorY="center"
        maxWidth={HEX_SIZE * 1.5}
        textAlign="center"
      >
        {task.title}
      </Text>

      {/* Child count badge for projects */}
      {isProject && childCount > 0 && (
        <group position={[s * 0.55, s * 0.35, 0.05]}>
          <Text
            position={[0, 0, 0.02]}
            fontSize={0.12}
            color={color}
            anchorX="center"
            anchorY="middle"
          >
            {childCount}
          </Text>
        </group>
      )}
    </group>
  );
}

function BackgroundGrid() {
  const hexes = useMemo(() => {
    const arr: { pos: [number, number, number]; s: number }[] = [];
    for (let q = -8; q <= 8; q++) {
      for (let r = -8; r <= 8; r++) {
        if (Math.abs(-q - r) > 8) continue;
        const [cx, cy] = axialToPixel(q, r, HEX_SIZE);
        arr.push({ pos: [cx, cy, -0.1], s: HEX_SIZE * 0.88 });
      }
    }
    return arr;
  }, []);

  return (
    <group>
      {hexes.map((h, i) => (
        <group key={i} position={h.pos}>
          <HexOutline size={h.s} color="#0a2a33" opacity={0.15} lineWidth={1} />
        </group>
      ))}
    </group>
  );
}

function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, []);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={120}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00d9ff"
        size={0.04}
        transparent
        opacity={0.3}
        sizeAttenuation
      />
    </points>
  );
}

function SceneContent() {
  const { tasks, selectedTaskId, navigateInto, setSelectedTaskId, setFocusedProjectId } = useKanbanStore();

  const handleClick = useCallback(
    (t: Task) => {
      if (t.isProject) {
        setFocusedProjectId(t.id);
        setTimeout(() => navigateInto(t.id), 300);
      } else {
        setSelectedTaskId(t.id);
      }
    },
    [navigateInto, setSelectedTaskId, setFocusedProjectId]
  );

  return (
    <>
      <ambientLight intensity={0.5} />

      {/* Background grid */}
      <BackgroundGrid />

      {/* Task hex cells */}
      {tasks.map((t) => (
        <HexCell
          key={t.id}
          task={t}
          isSelected={selectedTaskId === t.id}
          onClick={() => handleClick(t)}
          isProject={t.isProject}
          childCount={t.children?.length || 0}
        />
      ))}

      {/* Floating particles */}
      <FloatingParticles />

      {/* Zoom + Pan controls */}
      <MapControls
        enableRotate={false}
        enableZoom={true}
        enablePan={true}
        zoomSpeed={1.2}
        panSpeed={1}
        minDistance={3}
        maxDistance={40}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
}

export default function WebScene() {
  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 2, 14], fov: 50 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0a0a0a');
        }}
      >
        <SceneContent />
      </Canvas>

      {/* Status legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 pointer-events-none">
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div
            key={s}
            className="flex items-center gap-1.5 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md border"
            style={{ borderColor: c + '20' }}
          >
            <div
              className="w-2 h-2"
              style={{ backgroundColor: c, boxShadow: '0 0 6px ' + c }}
            />
            <span
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: c }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute top-3 right-3 pointer-events-none text-[10px] text-slate-600 bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
        🖱 Колёсико — масштаб · Перетаскивание — навигация
      </div>
    </div>
  );
}
