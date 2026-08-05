'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useKanbanStore, Board } from '@/store/kanban-store';
import { cn } from '@/lib/utils';

interface RadialBoardProps {
  projectName: string;
  onAddBoard: () => void;
}

// Board panel dimensions in SVG units
const PANEL_W = 110;
const PANEL_H = 70;
const PADDING = 25;
const CENTER_R = 55;
const MIN_RADIUS = 120;
const MARGIN = 90;
const LINE_GAP = 6;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

function rectEdgeDist(angle: number, halfW: number, halfH: number): number {
  const cosA = Math.abs(Math.cos(angle));
  const sinA = Math.abs(Math.sin(angle));
  return 1 / Math.max(cosA / halfW, sinA / halfH);
}

export default function RadialBoard({ projectName, onAddBoard }: RadialBoardProps) {
  const { boards, selectedBoardId, setSelectedBoardId, onboarding } = useKanbanStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [plusPressed, setPlusPressed] = useState(false);

  // Pan & zoom
  const svgRef = useRef<SVGSVGElement>(null);
  const [tf, setTf] = useState({ x: 0, y: 0, zoom: 1 });
  const isPanning = useRef(false);
  const [cursorStyle, setCursorStyle] = useState('grab');
  const panAnchor = useRef({ mx: 0, my: 0, tx: 0, ty: 0, scale: 1 });

  // Determine which ghost board is currently highlighted during onboarding
  const activeGhostId = onboarding.active && onboarding.phase === 'create'
    ? onboarding.ghostBoardIds[onboarding.currentIndex]
    : null;

  // In guide phase, the current ghost board id (now activated) gets a guide highlight
  const guideHighlightId = onboarding.active && onboarding.phase === 'guide'
    ? onboarding.ghostBoardIds[onboarding.currentIndex]
    : null;

  const handlePlusClick = () => {
    setPlusPressed(true);
    onAddBoard();
    setTimeout(() => setPlusPressed(false), 400);
  };

  const layout = useMemo(() => {
    const n = boards.length;
    let radius: number;
    if (n <= 1) {
      radius = MIN_RADIUS;
    } else {
      const minRadius = (PANEL_W + PADDING) / (2 * Math.sin(Math.PI / n));
      radius = Math.max(MIN_RADIUS, minRadius);
    }
    const extent = radius + Math.max(PANEL_W, PANEL_H) / 2 + MARGIN;
    const viewW = extent * 2;
    const viewH = extent * 2;
    const cx = viewW / 2;
    const cy = viewH / 2;
    if (n === 0) return { cx, cy, radius, viewW, viewH, items: [] };
    const items = boards.map((board, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const bx = cx + radius * Math.cos(angle);
      const by = cy + radius * Math.sin(angle);
      const lineStartX = cx + (CENTER_R + 4) * Math.cos(angle);
      const lineStartY = cy + (CENTER_R + 4) * Math.sin(angle);
      const edgeDist = rectEdgeDist(angle, PANEL_W / 2, PANEL_H / 2);
      const lineEndDist = radius - edgeDist + LINE_GAP;
      const lineEndX = cx + lineEndDist * Math.cos(angle);
      const lineEndY = cy + lineEndDist * Math.sin(angle);
      const taskDone = board.tasks.filter(t => t.status === 'done').length;
      const total = board.tasks.length;
      const isGhostHighlighted = board.id === activeGhostId;
      const isGuideHighlighted = board.id === guideHighlightId;
      return { board, x: bx, y: by, lineX: lineEndX, lineY: lineEndY, lineStartX, lineStartY, angle, taskDone, total, isGhostHighlighted, isGuideHighlighted };
    });
    return { cx, cy, radius, viewW, viewH, items };
  }, [boards, activeGhostId, guideHighlightId]);

  // --- Pan & zoom handlers ---

  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((clientX - rect.left) / rect.width) * vb.width + vb.x,
      y: ((clientY - rect.top) / rect.height) * vb.height + vb.y,
    };
  }, []);

  // Wheel zoom — must use non-passive listener to preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = 1 - e.deltaY * 0.001;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, tf.zoom * factor));
      if (newZoom === tf.zoom) return;
      const mouse = screenToSVG(e.clientX, e.clientY);
      const ratio = newZoom / tf.zoom;
      setTf(prev => ({
        zoom: newZoom,
        x: mouse.x - ratio * (mouse.x - layout.cx - prev.x) - layout.cx,
        y: mouse.y - ratio * (mouse.y - layout.cy - prev.y) - layout.cy,
      }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [tf.zoom, layout.cx, layout.cy, screenToSVG]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('.board-panel') || target.closest('.center-plus')) return;
    isPanning.current = true;
    setCursorStyle('grabbing');
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scale = vb.width / rect.width / tf.zoom;
    panAnchor.current = { mx: e.clientX, my: e.clientY, tx: tf.x, ty: tf.y, scale };
  }, [tf.x, tf.y, tf.zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const dx = (e.clientX - panAnchor.current.mx) * panAnchor.current.scale;
    const dy = (e.clientY - panAnchor.current.my) * panAnchor.current.scale;
    setTf(prev => ({ ...prev, x: panAnchor.current.tx + dx, y: panAnchor.current.ty + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
    setCursorStyle('grab');
  }, []);

  // Build SVG transform string: zoom/pan centered on layout center
  const tfString = `translate(${layout.cx + tf.x},${layout.cy + tf.y}) scale(${tf.zoom}) translate(${-layout.cx},${-layout.cy})`;

  // --- Edit / Delete handlers ---

  const handleStartEdit = (board: Board) => {
    setEditingId(board.id);
    setEditTitle(board.title);
  };

  const handleSaveEdit = async (boardId: string) => {
    if (!editTitle.trim()) return;
    await fetch('/api/boards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: boardId, title: editTitle.trim() }),
    });
    const { selectedProjectId } = useKanbanStore.getState();
    const res = await fetch(`/api/boards?projectId=${selectedProjectId}`);
    const data = await res.json();
    useKanbanStore.getState().setBoards(data.boards);
    setEditingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    await fetch(`/api/boards?id=${boardId}`, { method: 'DELETE' });
    const { selectedProjectId, selectedBoardId } = useKanbanStore.getState();
    const res = await fetch(`/api/boards?projectId=${selectedProjectId}`);
    const data = await res.json();
    useKanbanStore.getState().setBoards(data.boards);
    if (selectedBoardId === boardId) {
      useKanbanStore.getState().setSelectedBoardId(null);
    }
  };

  // Handle clicking a ghost board (activate it)
  const handleGhostClick = async (boardId: string) => {
    await fetch('/api/boards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: boardId, activateGhost: true }),
    });
    const { selectedProjectId } = useKanbanStore.getState();
    const res = await fetch(`/api/boards?projectId=${selectedProjectId}`);
    const data = await res.json();
    useKanbanStore.getState().setBoards(data.boards);
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-500/20"
            style={{
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              animation: `pulse ${(2 + i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.viewW} ${layout.viewH}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(0, 217, 255, 0.05))',
          cursor: cursorStyle,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Transform wrapper — all visual content */}
        <g transform={tfString}>
          {/* Connection lines */}
          {layout.items.map((item) => (
            <g key={`line-${item.board.id}`} pointerEvents="none">
              <line
                x1={item.lineStartX} y1={item.lineStartY}
                x2={item.lineX} y2={item.lineY}
                stroke={item.board.color}
                strokeWidth={2}
                strokeOpacity={item.board.isGhost && !item.isGhostHighlighted ? 0.08 : 0.3}
                strokeDasharray={item.board.isGhost ? '3 6' : '6 4'}
              />
              {!item.board.isGhost && (
                <circle cx={item.lineX} cy={item.lineY} r={4} fill={item.board.color} opacity={0.5} />
              )}
            </g>
          ))}

          {/* Center circle */}
          <g>
            <circle cx={layout.cx} cy={layout.cy} r={CENTER_R} fill="#1a1a2e" stroke="#2a2a4a" strokeWidth={2} />
            <circle cx={layout.cx} cy={layout.cy} r={CENTER_R} fill="url(#centerGradient)" />
            <text x={layout.cx} y={layout.cy - 6} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight={700} fontFamily="system-ui, sans-serif">
              {projectName.length > 14 ? projectName.slice(0, 14) + '...' : projectName}
            </text>
            <text x={layout.cx} y={layout.cy + 12} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="system-ui, sans-serif">
              ПРОЕКТ
            </text>
            <g className={cn('center-plus', boards.length === 0 && 'center-pulse')} onClick={handlePlusClick} data-pressed={plusPressed || undefined}>
              <circle cx={layout.cx} cy={layout.cy + 30} r={10} className="plus-bg" />
              <line x1={layout.cx - 4} y1={layout.cy + 30} x2={layout.cx + 4} y2={layout.cy + 30} className="plus-line" />
              <line x1={layout.cx} y1={layout.cy + 26} x2={layout.cx} y2={layout.cy + 34} className="plus-line" />
            </g>
          </g>

          {/* Board panels */}
          {layout.items.map((item) => {
            const isSelected = selectedBoardId === item.board.id;
            const isGhost = item.board.isGhost;
            const isGhostHighlighted = item.isGhostHighlighted;
            const isGuideHighlighted = item.isGuideHighlighted;
            const px = item.x - PANEL_W / 2;
            const py = item.y - PANEL_H / 2;
            return (
              <g
                key={item.board.id}
                className={cn(
                  'board-panel',
                  isGhost && !isGhostHighlighted && 'ghost-panel',
                  isGhostHighlighted && 'ghost-highlighted',
                  isGuideHighlighted && 'guide-highlighted',
                )}
                data-selected={isSelected || isGuideHighlighted || undefined}
                data-ghost={isGhost || undefined}
                data-ghost-highlighted={isGhostHighlighted || undefined}
                data-guide-highlighted={isGuideHighlighted || undefined}
                style={{
                  '--bc': item.board.color,
                  '--bf': isSelected || isGuideHighlighted ? item.board.color + '25' : isGhost ? '#0a0a14' : '#111122',
                  '--bs': isSelected || isGuideHighlighted ? item.board.color : isGhost ? item.board.color + '25' : item.board.color + '50',
                  '--bw': isSelected || isGuideHighlighted ? '2' : isGhost ? '1' : '1.5',
                } as React.CSSProperties}
                onClick={() => {
                  if (isGhost && !isGhostHighlighted) {
                    // Clicking a non-highlighted ghost board activates it
                    handleGhostClick(item.board.id);
                  } else if (!isGhost) {
                    setSelectedBoardId(item.board.id);
                  }
                }}
              >
                {/* Ghost pulse rings */}
                {isGhostHighlighted && (
                  <>
                    <rect className="ghost-pulse-outer" x={px - 8} y={py - 8} width={PANEL_W + 16} height={PANEL_H + 16} rx={18} />
                    <rect className="ghost-pulse-inner" x={px - 4} y={py - 4} width={PANEL_W + 8} height={PANEL_H + 8} rx={15} />
                  </>
                )}
                {/* Guide highlight glow rings */}
                {isGuideHighlighted && (
                  <>
                    <rect className="guide-pulse-outer" x={px - 10} y={py - 10} width={PANEL_W + 20} height={PANEL_H + 20} rx={20} />
                    <rect className="guide-pulse-inner" x={px - 5} y={py - 5} width={PANEL_W + 10} height={PANEL_H + 10} rx={16} />
                  </>
                )}
                <rect className="board-glow" x={px - 4} y={py - 4} width={PANEL_W + 8} height={PANEL_H + 8} rx={14} fill="none" stroke={item.board.color} />
                <rect className="board-bg" x={px} y={py} width={PANEL_W} height={PANEL_H} rx={12} />
                {editingId === item.board.id ? (
                  <foreignObject x={px + 6} y={item.y - 14} width={PANEL_W - 12} height={20}>
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(item.board.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.board.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent border border-slate-600 rounded px-1.5 py-0.5 text-[11px] text-white text-center outline-none focus:border-cyan-500"
                      style={{ colorScheme: 'dark' }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={item.x} y={item.y - 8} textAnchor="middle"
                    fill={isGhost ? (isGhostHighlighted ? '#ffffff' : item.board.color + '60') : (isSelected || isGuideHighlighted ? '#ffffff' : '#c0d0e0')}
                    fontSize={11} fontWeight={600} fontFamily="system-ui, sans-serif"
                    onDoubleClick={(e) => { e.stopPropagation(); if (!isGhost) handleStartEdit(item.board); }}
                  >
                    {item.board.title.length > 13 ? item.board.title.slice(0, 13) + '...' : item.board.title}
                  </text>
                )}
                <text
                  x={item.x} y={item.y + 8} textAnchor="middle"
                  fill={isGhost ? (isGhostHighlighted ? item.board.color : item.board.color + '40') : item.board.color}
                  fontSize={10} fontFamily="system-ui, sans-serif"
                >
                  {isGhost ? 'Призрак' : `${item.total} задач`}
                </text>
                {!isGhost && item.total > 0 && (
                  <g>
                    <rect x={item.x - 30} y={item.y + 18} width={60} height={4} rx={2} fill="#1a1a2e" />
                    <rect x={item.x - 30} y={item.y + 18} width={60 * (item.taskDone / item.total)} height={4} rx={2} fill={item.board.color} opacity={0.7} />
                  </g>
                )}
                {/* Ghost icon indicator */}
                {isGhost && !isGhostHighlighted && (
                  <text x={px + PANEL_W - 14} y={py + 14} textAnchor="middle" fill={item.board.color + '30'} fontSize={10} fontFamily="system-ui">
                    ?
                  </text>
                )}
                {/* Guide phase checkmark indicator */}
                {isGuideHighlighted && (
                  <text x={px + PANEL_W - 14} y={py + 14} textAnchor="middle" fill={item.board.color} fontSize={10} fontFamily="system-ui">
                    ✓
                  </text>
                )}
                {!isGhost && !isGuideHighlighted && (
                  <g className="opacity-0 hover:opacity-100" onClick={(e) => handleDelete(e, item.board.id)} style={{ cursor: 'pointer' }}>
                    <circle cx={px + PANEL_W - 8} cy={py + 8} r={7} fill="#1a1a2e" />
                    <text x={px + PANEL_W - 8} y={py + 12} textAnchor="middle" fill="#f87171" fontSize={10} fontFamily="system-ui">
                      ×
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        <style>{`
          .center-plus {
            cursor: pointer;
            transform-box: fill-box;
            transform-origin: center;
            transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .center-plus:hover { transform: scale(1.35); }
          .center-plus:active { transform: scale(1.15); }
          .plus-bg {
            fill: #0a0a0a; stroke: #334155; stroke-width: 1;
            transition: fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease;
          }
          .plus-line {
            stroke: #64748b; stroke-width: 1.5; stroke-linecap: round;
            transition: stroke 0.3s ease, stroke-width 0.3s ease;
          }
          .center-plus:hover .plus-bg { stroke: #00d9ff; stroke-width: 1.5; }
          .center-plus:hover .plus-line { stroke: #00d9ff; stroke-width: 2; }
          .center-plus[data-pressed] .plus-bg { fill: #0e7490; stroke: #00d9ff; stroke-width: 1.5; }
          .center-plus[data-pressed] .plus-line { stroke: #ffffff; stroke-width: 2; }
          .center-pulse .plus-bg { animation: pulseGlow 2s ease-in-out infinite; }
          .center-pulse .plus-line { animation: pulseGlow 2s ease-in-out infinite; }
          @keyframes pulseGlow {
            0%, 100% { stroke: #334155; stroke-width: 1; }
            50% { stroke: #00d9ff; stroke-width: 2; filter: drop-shadow(0 0 6px #00d9ff60); }
          }

          /* Normal board panel */
          .board-panel {
            cursor: pointer;
            transform-box: fill-box;
            transform-origin: center;
            transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .board-panel:hover { transform: scale(1.06); }
          .board-panel:active { transform: scale(0.97); }
          .board-bg {
            fill: var(--bf, #111122); stroke: var(--bs, #33415550); stroke-width: var(--bw, 1.5);
            transition: fill 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease, filter 0.2s ease;
          }
          .board-panel:hover .board-bg {
            fill: #1a1a30; stroke: var(--bc, #00d9ff); stroke-width: 2;
            filter: drop-shadow(0 0 6px var(--bc, #00d9ff) 0.3);
          }
          .board-panel[data-selected] .board-bg {
            filter: drop-shadow(0 0 8px var(--bc, #00d9ff) 0.4);
          }
          .board-glow {
            stroke-width: 0; stroke-opacity: 0;
            transition: stroke-width 0.25s ease, stroke-opacity 0.25s ease;
          }
          .board-panel:hover .board-glow { stroke-width: 1; stroke-opacity: 0.15; }
          .board-panel[data-selected] .board-glow { stroke-width: 1; stroke-opacity: 0.2; }

          /* Ghost panel — dimmed appearance */
          .ghost-panel {
            opacity: 0.45;
          }
          .ghost-panel:hover {
            opacity: 0.7;
          }

          /* Ghost panel — highlighted during onboarding */
          .ghost-highlighted {
            opacity: 1;
            animation: ghostBoardPulse 2s ease-in-out infinite;
          }
          .ghost-highlighted:hover {
            transform: scale(1.06);
          }
          .ghost-highlighted .board-bg {
            fill: var(--bc) 15;
            stroke: var(--bc);
            stroke-width: 2;
            filter: drop-shadow(0 0 12px var(--bc) 0.5);
          }
          .ghost-highlighted .board-glow {
            stroke-width: 1.5;
            stroke-opacity: 0.3;
          }

          /* Ghost pulse outer ring */
          .ghost-pulse-outer {
            fill: none;
            stroke: var(--bc);
            stroke-width: 1;
            stroke-opacity: 0;
            animation: ghostRingPulse 2s ease-in-out infinite;
          }
          .ghost-pulse-inner {
            fill: none;
            stroke: var(--bc);
            stroke-width: 1.5;
            stroke-opacity: 0;
            animation: ghostRingPulse 2s ease-in-out infinite 0.3s;
          }

          @keyframes ghostBoardPulse {
            0%, 100% {
              filter: drop-shadow(0 0 8px var(--bc) 0.4);
            }
            50% {
              filter: drop-shadow(0 0 20px var(--bc) 0.7);
            }
          }
          @keyframes ghostRingPulse {
            0%, 100% {
              stroke-opacity: 0;
              rx: 18;
            }
            50% {
              stroke-opacity: 0.25;
            }
          }

          /* Guide-highlighted board — active board pulsing during guide phase */
          .guide-highlighted {
            animation: guideBoardPulse 2s ease-in-out infinite;
          }
          .guide-highlighted .board-bg {
            fill: var(--bc) 12;
            stroke: var(--bc);
            stroke-width: 2;
            filter: drop-shadow(0 0 14px var(--bc) 0.5);
          }
          .guide-highlighted .board-glow {
            stroke-width: 1.5;
            stroke-opacity: 0.35;
          }
          @keyframes guideBoardPulse {
            0%, 100% {
              filter: drop-shadow(0 0 8px var(--bc) 0.4);
            }
            50% {
              filter: drop-shadow(0 0 24px var(--bc) 0.8);
            }
          }

          /* Guide pulse rings */
          .guide-pulse-outer {
            fill: none;
            stroke: var(--bc);
            stroke-width: 1.5;
            stroke-opacity: 0;
            animation: guideRingPulse 2.2s ease-in-out infinite;
          }
          .guide-pulse-inner {
            fill: none;
            stroke: var(--bc);
            stroke-width: 1.5;
            stroke-opacity: 0;
            animation: guideRingPulse 2.2s ease-in-out infinite 0.4s;
          }
          @keyframes guideRingPulse {
            0%, 100% {
              stroke-opacity: 0;
            }
            50% {
              stroke-opacity: 0.35;
            }
          }
        `}</style>

        <defs>
          <radialGradient id="centerGradient" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#2a2a4a" stopOpacity={0.5} />
            <stop offset="100%" stopColor="transparent" stopOpacity={0} />
          </radialGradient>
        </defs>
      </svg>

      {boards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3 pb-16">
          <div className="animate-pulse rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2.5">
            <p className="text-cyan-400/80 text-xs text-center font-medium">Нажмите + чтобы добавить доску задач</p>
            <p className="text-slate-600 text-[10px] text-center mt-1">Или выберите тип «Альбом» / «Сингл» при создании проекта для авто-досок</p>
          </div>
        </div>
      )}
    </div>
  );
}
