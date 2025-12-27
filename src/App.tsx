import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { flushSync } from 'react-dom'
import GoBoard, { ViewRange, BoardState, StoneColor, Marker } from './components/GoBoard'
import GameInfoModal from './components/GameInfoModal'
import PrintSettingsModal, { PrintSettings } from './components/PrintSettingsModal'
import { exportToPng, exportToSvg } from './utils/exportUtils'
import { checkCaptures } from './utils/gameLogic'
import { parseSGF, generateSGF } from './utils/sgfUtils'
import { generatePrintFigures } from './utils/printUtils'

// Chrome extension download API (type stub)
declare const chrome: any;

// Notify user where the downloads API saved the file (best-effort)
const notifyDownloadLocation = (downloadId: number) => {
    try {
        if (chrome?.downloads?.search) {
            chrome.downloads.search({ id: downloadId }, (results: any[]) => {
                const path = results?.[0]?.filename;
                if (path) {
                    alert(`保存しました: ${path}`);
                }
            });
        }
    } catch (err) {
        console.warn('Failed to fetch download location', err);
    }
};

type PlacementMode = 'SIMPLE' | 'NUMBERED';

export type ToolMode = 'STONE' | 'LABEL' | 'SYMBOL';
export type SymbolType = 'TRI' | 'CIR' | 'SQR' | 'X';

export interface HistoryState {
    board: BoardState;
    nextNumber: number;
    activeColor: StoneColor;
    boardSize: number;
    markers?: Marker[];
}

function App() {
    // Initial Size 19
    const INITIAL_SIZE = 19;

    // Load initial active color from localStorage
    const getInitialColor = (): StoneColor => {
        try {
            const saved = localStorage.getItem('gorw_active_color');
            return (saved === 'WHITE' ? 'WHITE' : 'BLACK');
        } catch (e) {
            return 'BLACK';
        }
    };

    const [toolMode, setToolMode] = useState<ToolMode>('STONE');
    const [isPrintJob, setIsPrintJob] = useState(false);
    const [nextLabelChar, setNextLabelChar] = useState<string>('A');
    const [selectedSymbol, setSelectedSymbol] = useState<SymbolType>('TRI');

    const [history, setHistory] = useState<HistoryState[]>([
        {
            board: Array(INITIAL_SIZE).fill(null).map(() => Array(INITIAL_SIZE).fill(null)),
            nextNumber: 1,
            activeColor: getInitialColor(),
            boardSize: INITIAL_SIZE,
            markers: []
        }
    ]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [redoStack, setRedoStack] = useState<HistoryState[][]>([]); // Stack of truncated history branches

    const currentState = history[currentMoveIndex];
    const board = currentState.board;
    const nextNumber = currentState.nextNumber;
    const activeColor = currentState.activeColor;
    const boardSize = currentState.boardSize;

    // ViewRange is kept internally for rendering but we don't expose UI controls anymore.
    // It defaults to full board in GoBoard.tsx if not manipulated.
    // We can just pass full range based on size.
    const [viewRange, setViewRange] = useState<ViewRange | null>(null);

    // Calculated effective view range
    // Calculated effective view range
    const effectiveViewRange: ViewRange = viewRange || { minX: 1, maxX: boardSize, minY: 1, maxY: boardSize };
    const isCropped = !!viewRange;

    const [showCoordinates, setShowCoordinates] = useState(false);
    const [showNumbers, setShowNumbers] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [mode, setMode] = useState<PlacementMode>('SIMPLE');

    // Color Mode Persistence
    const [isMonochrome, setIsMonochrome] = useState(() => {
        try {
            return localStorage.getItem('gorw_is_monochrome') === 'true';
        } catch { return false; }
    });

    // Export Mode Persistence
    const [exportMode, setExportMode] = useState<'SVG' | 'PNG'>(() => {
        try {
            const saved = localStorage.getItem('gorw_export_mode');
            return (saved === 'SVG' || saved === 'PNG') ? saved : 'SVG';
        } catch { return 'SVG'; }
    });

    const [showCapturedInExport, setShowCapturedInExport] = useState(false);
    const [isFigureMode, setIsFigureMode] = useState(false); // Internal State for Export Auto-Switch

    useEffect(() => {
        localStorage.setItem('gorw_is_monochrome', String(isMonochrome));
    }, [isMonochrome]);

    const [saveFileHandle, setSaveFileHandle] = useState<any>(null);

    // Drag State
    type DragMode = 'SELECTING' | 'MOVING_STONE';
    const [dragMode, setDragMode] = useState<DragMode>('SELECTING');
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ x: number, y: number } | null>(null);
    const [moveSource, setMoveSource] = useState<{ x: number, y: number } | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const hoveredCellRef = useRef<{ x: number, y: number } | null>(null);

    const commitState = (newBoard: BoardState, newNextNumber: number, newActiveColor: StoneColor, newSize: number, newMarkers?: Marker[]) => {
        // Persist active color logic
        // We only persist the "current" active color for next session reload.
        try {
            localStorage.setItem('gorw_active_color', newActiveColor);
        } catch (e) { /* ignore */ }

        const newHistory = history.slice(0, currentMoveIndex + 1);
        newHistory.push({
            board: newBoard,
            nextNumber: newNextNumber,
            activeColor: newActiveColor,
            boardSize: newSize,
            markers: newMarkers ?? (history[currentMoveIndex]?.markers || [])
        });
        setHistory(newHistory);
        setCurrentMoveIndex(newHistory.length - 1);
        setRedoStack([]); // Clear Redo Stack on new divergence
    };

    // Change Board Size
    const setBoardSize = (size: number) => {
        // Create clean board of new size
        const newBoard = Array(size).fill(null).map(() => Array(size).fill(null));
        // Reset number to 1? Or keep? Usually fresh board = fresh start.
        commitState(newBoard, 1, 'BLACK', size, []);
    };



    // Update Markers without branching (Preserves History/Future)
    const updateMarkers = (newMarkers: Marker[]) => {
        const newHistory = [...history];
        if (newHistory[currentMoveIndex]) {
            newHistory[currentMoveIndex] = {
                ...newHistory[currentMoveIndex],
                markers: newMarkers
            };
            setHistory(newHistory);
        }
    };

    const handleInteraction = (x: number, y: number) => {
        if (dragStartRef.current) {
            const dx = Math.abs(dragStartRef.current.x - x);
            const dy = Math.abs(dragStartRef.current.y - y);
            if (dx > 0 || dy > 0) return;
        }

        if (selectionStart && selectionEnd) {
            setSelectionStart(null);
            setSelectionEnd(null);
        }

        // Handle Markers
        if (toolMode === 'LABEL' || toolMode === 'SYMBOL') {
            const currentMarkers = history[currentMoveIndex].markers || [];
            // Check if marker exists
            const existingIndex = currentMarkers.findIndex(m => m.x === x && m.y === y);
            const newMarkers = [...currentMarkers];

            if (existingIndex !== -1) {
                // Remove (Toggle off)
                newMarkers.splice(existingIndex, 1);
            } else {
                // Add
                if (toolMode === 'LABEL') {
                    newMarkers.push({ x, y, type: 'LABEL', value: nextLabelChar });
                    // Increment Char for next click
                    const nextChar = String.fromCharCode(nextLabelChar.charCodeAt(0) + 1);
                    setNextLabelChar(nextChar);
                } else {
                    newMarkers.push({ x, y, type: 'SYMBOL', value: selectedSymbol });
                }
            }
            // Use updateMarkers instead of commitState to preserve future moves
            updateMarkers(newMarkers);
            return;
        }

        const currentStone = board[y - 1][x - 1];
        const newBoard = board.map(row => [...row]);

        if (mode === 'SIMPLE') {
            // Setup Mode (Simple)
            // L-Click: Place BLACK. If overlapping (any color), DELETE.

            if (currentStone && !currentStone.number) {
                // DELETE overlapping setup stone
                const newHistory = history.map(step => {
                    const cell = step.board[y - 1][x - 1];
                    if (cell && cell.number) return step; // Don't delete numbered items
                    const stepBoard = step.board.map(row => [...row]);
                    stepBoard[y - 1][x - 1] = null;
                    return { ...step, board: stepBoard };
                });
                setHistory(newHistory);
                return;
            }

            // If empty (or numbered stone which we shouldn't touch? Logic above says checked setup stone), Place BLACK
            if (currentStone && currentStone.number) return; // Don't interact with numbered stones in setup mode? Or allow delete?
            // "Click existing -> Delete" usually implies editing the Setup layer.
            // If there is a numbered stone, we probably shouldn't edit it here.

            const newStone = { color: 'BLACK' as StoneColor };

            const newHistory = history.map(step => {
                const cell = step.board[y - 1][x - 1];
                if (cell && cell.number) return step;
                const stepBoard = step.board.map(row => [...row]);
                stepBoard[y - 1][x - 1] = newStone;
                return { ...step, board: stepBoard };
            });

            setHistory(newHistory);
            return;

        } else {
            // Numbered Mode
            // L-Click: Place Number. If overlapping LAST numbered stone, DELETE (Undo).

            if (currentStone) {
                // If it is the LAST numbered move, Delete it (Undo Last Move)
                if (currentStone.number === nextNumber - 1) {
                    if (currentMoveIndex > 0) {
                        const newHistory = history.slice(0, currentMoveIndex);
                        setHistory(newHistory);
                        setCurrentMoveIndex(newHistory.length - 1);
                    }
                    return;
                }
                return; // Ignore other stones (earlier moves or setup stones)
            }

            // Place Numbered Stone
            newBoard[y - 1][x - 1] = { color: activeColor, number: nextNumber };

            const captured = checkCaptures(newBoard, x - 1, y - 1, activeColor);
            captured.forEach(c => {
                newBoard[c.y][c.x] = null;
            });

            const newNextNum = nextNumber + 1;
            const newActiveColor = activeColor === 'BLACK' ? 'WHITE' : 'BLACK';

            commitState(newBoard, newNextNum, newActiveColor, boardSize);
        }
    };

    // New Right Click Handler
    const handleRightClick = (x: number, y: number) => {
        if (mode === 'SIMPLE') {
            // Setup Mode (Simple)
            // R-Click: Place WHITE. If overlapping, DELETE.

            const currentStone = board[y - 1][x - 1];

            if (currentStone && !currentStone.number) {
                // DELETE overlapping setup stone
                const newHistory = history.map(step => {
                    const cell = step.board[y - 1][x - 1];
                    if (cell && cell.number) return step;
                    const stepBoard = step.board.map(row => [...row]);
                    stepBoard[y - 1][x - 1] = null;
                    return { ...step, board: stepBoard };
                });
                setHistory(newHistory);
                return;
            }

            if (currentStone && currentStone.number) return;

            const newStone = { color: 'WHITE' as StoneColor };

            const newHistory = history.map(step => {
                const cell = step.board[y - 1][x - 1];
                if (cell && cell.number) return step;
                const stepBoard = step.board.map(row => [...row]);
                stepBoard[y - 1][x - 1] = newStone;
                return { ...step, board: stepBoard };
            });

            setHistory(newHistory);
            return;
        } else {
            // Numbered Mode
            // Right Click: Delete LAST numbered move (Undo shortcut), or Do Nothing?
            // User requested: "Number stone is Left click only. Click again to delete."
            // "Right click deletes stone" was in previous logic. 
            // I will keep Right Click as "Undo Last" for convenience effectively same as "Delete", 
            // but explicitly NO placement.

            const stone = board[y - 1][x - 1];
            if (stone && stone.number === nextNumber - 1) {
                if (currentMoveIndex > 0) {
                    const newHistory = history.slice(0, currentMoveIndex);
                    setHistory(newHistory);
                    setCurrentMoveIndex(newHistory.length - 1);
                }
            }
        };

    };

    // const handleCellClick = (x: number, y: number) => handleInteraction(x, y); // Removed: Use handleInteraction directly
    // const handleCellRightClick = (x: number, y: number) => deleteStone(x, y); // Removed: Use handleRightClick directly

    const handleDoubleClick = () => {
        // Priority 1: Selection Swap
        if (selectionStart && selectionEnd) {
            const x1 = Math.min(selectionStart.x, selectionEnd.x);
            const x2 = Math.max(selectionStart.x, selectionEnd.x);
            const y1 = Math.min(selectionStart.y, selectionEnd.y);
            const y2 = Math.max(selectionStart.y, selectionEnd.y);

            if (hoveredCellRef.current) {
                const { x, y } = hoveredCellRef.current;
                if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                    const newBoard = board.map(row => row.map(s => s));
                    for (let iy = y1; iy <= y2; iy++) {
                        for (let ix = x1; ix <= x2; ix++) {
                            const s = newBoard[iy - 1][ix - 1];
                            if (s) {
                                newBoard[iy - 1][ix - 1] = { ...s, color: s.color === 'BLACK' ? 'WHITE' : 'BLACK' };
                            }
                        }
                    }
                    commitState(newBoard, nextNumber, activeColor, boardSize);
                    return;
                }
            }
        }

        // Priority 2: Setup Mode Color Toggle (Switch Tool & Stone)
        // Satisfies: "On 2nd click, switch color, and keep that color."
        if (mode === 'SIMPLE' && toolMode === 'STONE') {
            let newColor: StoneColor = activeColor === 'BLACK' ? 'WHITE' : 'BLACK';
            let newBoard = board;

            // Check if there is a stone under cursor to swap
            if (hoveredCellRef.current) {
                const { x, y } = hoveredCellRef.current;
                const stone = board[y - 1][x - 1];
                if (stone) {
                    // Toggle the color of the existing stone
                    newColor = stone.color === 'BLACK' ? 'WHITE' : 'BLACK';
                    newBoard = board.map(row => [...row]);
                    newBoard[y - 1][x - 1] = { ...stone, color: newColor };

                    // Propagate to ALL history steps (like handleInteraction)
                    const newHistory = history.map(step => {
                        const cell = step.board[y - 1][x - 1];
                        // Don't overwrite numbered moves
                        if (cell && cell.number) return step;

                        const stepBoard = step.board.map(row => [...row]);
                        stepBoard[y - 1][x - 1] = { color: newColor };
                        return { ...step, board: stepBoard };
                    });

                    // Update Active Color for current step (consistency)
                    newHistory[currentMoveIndex] = {
                        ...newHistory[currentMoveIndex],
                        activeColor: newColor
                    };

                    setHistory(newHistory);
                }
            }

            try { localStorage.setItem('gorw_active_color', newColor); } catch (e) { /* ignore */ }
            return;
        }

        // Priority 3: Stone Swap (Numbered Mode) - Last Move Color Toggle
        if (mode === 'NUMBERED') {
            if (hoveredCellRef.current) {
                const { x, y } = hoveredCellRef.current;
                const stone = board[y - 1][x - 1];
                // Only allow modifying the *most recent* numbered move to avoid history corruption
                if (stone && stone.number === nextNumber - 1 && currentMoveIndex > 0) {
                    const prevStep = history[currentMoveIndex - 1];
                    const prevBoard = prevStep.board.map(r => r.map(c => c ? { ...c } : null)); // Deep copy

                    const newColor = stone.color === 'BLACK' ? 'WHITE' : 'BLACK';

                    // Place new stone
                    prevBoard[y - 1][x - 1] = { color: newColor, number: stone.number };

                    // Recalculate captures
                    const captured = checkCaptures(prevBoard, x - 1, y - 1, newColor);
                    captured.forEach(c => prevBoard[c.y][c.x] = null);

                    // Update History
                    const newHistory = history.slice(0, currentMoveIndex);
                    // Toggle active color state as well (if we placed Black, next was White. Now we place White, next should be Black).
                    const nextActive = newColor === 'BLACK' ? 'WHITE' : 'BLACK';

                    newHistory.push({
                        ...history[currentMoveIndex],
                        board: prevBoard,
                        activeColor: nextActive
                    });

                    setHistory(newHistory);
                }
            }
            return;
        }
    };



    const stepBack = () => { if (currentMoveIndex > 0) setCurrentMoveIndex(i => i - 1); };
    const stepForward = () => { if (currentMoveIndex < history.length - 1) setCurrentMoveIndex(i => i + 1); };
    const stepFirst = () => setCurrentMoveIndex(0);
    const stepLast = () => setCurrentMoveIndex(history.length - 1);

    const deleteLastMove = useCallback(() => {
        if (currentMoveIndex > 0) {
            const newHistory = history.slice(0, currentMoveIndex);
            const truncated = history.slice(currentMoveIndex);

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setRedoStack([...redoStack, truncated]);
        }
    }, [history, currentMoveIndex, redoStack]);

    const restoreMove = useCallback(() => {
        if (redoStack.length > 0) {
            const toRestore = redoStack[redoStack.length - 1];
            const newHistory = [...history, ...toRestore];

            setHistory(newHistory);
            setRedoStack(redoStack.slice(0, -1));
            // Jump to end of restored segment (usually +1 move if we deleted 1, or more)
            setCurrentMoveIndex(newHistory.length - 1);
        }
    }, [history, redoStack]);

    // Pass Move: Increments number, toggles color, board stays same
    const handlePass = () => {
        if (mode !== 'NUMBERED') return;
        const newBoard = board.map(row => [...row]); // Copy current board
        const newNextNumber = nextNumber + 1;
        const newActiveColor = activeColor === 'BLACK' ? 'WHITE' : 'BLACK';
        commitState(newBoard, newNextNumber, newActiveColor, boardSize);
    };
    const handleWheel = (delta: number) => {
        if (Math.abs(delta) < 10) return;
        if (delta > 0) stepForward(); else stepBack();
    };

    const handleDragStart = (x: number, y: number) => {
        dragStartRef.current = { x, y };
        const stone = board[y - 1][x - 1];
        if (stone) {
            setDragMode('MOVING_STONE');
            setMoveSource({ x, y });
            setSelectionStart({ x, y });
            setSelectionEnd({ x, y });
        } else {
            setDragMode('SELECTING');
            setSelectionStart({ x, y });
            setSelectionEnd({ x, y });
        }
        setIsSelecting(true);
    };
    const handleDragMove = (x: number, y: number) => { if (isSelecting) setSelectionEnd({ x, y }); };
    const handleDragEnd = () => {
        setIsSelecting(false);
        if (!selectionStart || !selectionEnd) return;

        if (dragMode === 'MOVING_STONE' && moveSource) {
            const targetX = selectionEnd.x;
            const targetY = selectionEnd.y;
            if ((moveSource.x !== targetX || moveSource.y !== targetY) && !board[targetY - 1][targetX - 1]) {
                if (mode === 'SIMPLE') {
                    // Simple Mode: Propagate move to ALL history steps
                    const newHistory = history.map(step => {
                        const sourceCell = step.board[moveSource.y - 1][moveSource.x - 1];
                        const targetCell = step.board[targetY - 1][targetX - 1];

                        // Only move if source has a setup stone (no number) and target is empty
                        if (sourceCell && !sourceCell.number && !targetCell) {
                            const stepBoard = step.board.map(row => [...row]);
                            stepBoard[targetY - 1][targetX - 1] = sourceCell;
                            stepBoard[moveSource.y - 1][moveSource.x - 1] = null;
                            return { ...step, board: stepBoard };
                        }
                        return step;
                    });
                    setHistory(newHistory);
                } else {
                    // Numbered Mode
                    const stone = board[moveSource.y - 1][moveSource.x - 1];

                    // Case A: Correcting the LAST move (Undo + Replay at new spot)
                    // We rewrite the CURRENT history step instead of appending.
                    if (stone && stone.number === nextNumber - 1 && currentMoveIndex > 0) {
                        const prevStep = history[currentMoveIndex - 1];
                        const baseBoard = prevStep.board.map(r => r.map(c => c ? { ...c } : null));

                        // Place at new Target
                        baseBoard[targetY - 1][targetX - 1] = { ...stone };

                        // Check Captures on the base board context
                        const captured = checkCaptures(baseBoard, targetX - 1, targetY - 1, stone.color);
                        captured.forEach(c => baseBoard[c.y][c.x] = null);

                        // Replace current history entry
                        const newHistory = history.slice(0, currentMoveIndex);
                        newHistory.push({
                            board: baseBoard,
                            nextNumber: nextNumber,      // Same as before
                            activeColor: activeColor,    // Same as before
                            boardSize: boardSize,
                            markers: history[currentMoveIndex].markers // Persist markers if any
                        });
                        setHistory(newHistory);
                        // currentMoveIndex remains the same
                    }
                    // Case B: Moving an older stone (Append Correction Step)
                    else if (stone) {
                        const newBoard = board.map(row => [...row]);
                        newBoard[moveSource.y - 1][moveSource.x - 1] = null;
                        newBoard[targetY - 1][targetX - 1] = stone;
                        const captured = checkCaptures(newBoard, targetX - 1, targetY - 1, stone.color);
                        captured.forEach(c => newBoard[c.y][c.x] = null);
                        commitState(newBoard, nextNumber, activeColor, boardSize);
                    }
                }
            }
            setSelectionStart(null);
            setSelectionEnd(null);
        }
        setMoveSource(null);
        setTimeout(() => { dragStartRef.current = null; }, 0);
    };

    const handleDeleteParams = () => {
        if (hoveredCellRef.current) {
            const { x, y } = hoveredCellRef.current;
            if (board[y - 1][x - 1]) {
                const newBoard = board.map(row => [...row]);
                newBoard[y - 1][x - 1] = null;
                commitState(newBoard, nextNumber, activeColor, boardSize);
                return true;
            }
        }
        if (selectionStart && selectionEnd) {
            const x1 = Math.min(selectionStart.x, selectionEnd.x);
            const x2 = Math.max(selectionStart.x, selectionEnd.x);
            const y1 = Math.min(selectionStart.y, selectionEnd.y);
            const y2 = Math.max(selectionStart.y, selectionEnd.y);
            const newBoard = board.map(row => [...row]);
            let changed = false;
            for (let iy = y1; iy <= y2; iy++) {
                for (let ix = x1; ix <= x2; ix++) {
                    if (newBoard[iy - 1][ix - 1]) {
                        newBoard[iy - 1][ix - 1] = null;
                        changed = true;
                    }
                }
            }
            if (changed) {
                commitState(newBoard, nextNumber, activeColor, boardSize);
                return true;
            }
        }
        return false;
    };

    const getBounds = useCallback((searchArea?: { x1: number, y1: number, x2: number, y2: number }) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let hasStones = false;

        const startX = searchArea ? Math.max(1, searchArea.x1) : 1;
        const endX = searchArea ? Math.min(boardSize, searchArea.x2) : boardSize;
        const startY = searchArea ? Math.max(1, searchArea.y1) : 1;
        const endY = searchArea ? Math.min(boardSize, searchArea.y2) : boardSize;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                if (board[y - 1][x - 1]) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    hasStones = true;
                }
            }
        }
        return { hasStones, minX, maxX, minY, maxY };
    }, [board, boardSize]);


    // Generate hidden move references and special labels
    // Logic: Identify board locations with multiple moves (collisions).
    // Update v32: Also identifying Manual Labels covering hidden moves.
    // Assign letters A, B, C... to those locations.
    // Footer lists all moves at those locations as "MoveNum [ Label ]".
    const hiddenMovesData = useMemo(() => {
        if (currentMoveIndex === 0) return { hiddenMoves: [], specialLabels: [] };

        const moveHistory = new Map<string, { number: number, color: StoneColor }[]>(); // "x,y" -> list of moves

        // 0. Scan Initial Board (Setup Stones)
        // Setup stones are considered "Move 0" for collision detection.
        const initialBoard = history[0].board;
        const initSize = history[0].boardSize;
        if (initialBoard) {
            for (let y = 0; y < initSize; y++) {
                for (let x = 0; x < initSize; x++) {
                    const stone = initialBoard[y][x];
                    // Only count stones valid at step 0 (Setup stones usually don't have numbers, or ignored?)
                    // If we assume history[0] is pure setup.
                    if (stone) {
                        const key = `${x},${y}`;
                        if (!moveHistory.has(key)) moveHistory.set(key, []);
                        // Avoid duplicates if Setup Stone is treated as Move? No, Move 1 is distinct.
                        moveHistory.get(key)?.push({ number: 0, color: stone.color });
                    }
                }
            }
        }

        // 1. Scan History (Diff-based) to populate moveHistory
        // Robustly detects any added stone (Numbered or Simple/Unnumbered) by comparing board states.
        for (let i = 1; i <= currentMoveIndex; i++) {
            const prevBoard = history[i - 1]?.board;
            const currBoard = history[i].board;
            const size = history[i].boardSize;

            if (!prevBoard) continue; // Should not happen given i starts at 1

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const prevStone = prevBoard[y][x];
                    const currStone = currBoard[y][x];

                    // Detect Stone Placement
                    // 1. If no previous stone (Empty -> Stone): Record it.
                    // 2. If previous stone exists:
                    //    - Only record if COLOR changes (e.g. White -> Black).
                    //    - Ignore if same color (e.g. Init(B) -> 1(B)), effectively "using" the stone.
                    if (currStone && (!prevStone || currStone.color !== prevStone.color)) {

                        const key = `${x},${y}`;
                        if (!moveHistory.has(key)) moveHistory.set(key, []);

                        moveHistory.get(key)?.push({
                            number: currStone.number ?? -1, // -1 indicating Unnumbered/Simple move
                            color: currStone.color
                        });
                    }
                }
            }
        }

        // 2. Identify Collisions and Assign Labels
        const labels: { x: number, y: number, label: string }[] = [];
        const footer: { left: { text: string, color: StoneColor }[], right: { text: string, color: StoneColor } }[] = [];

        let labelIndex = 0;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const currentBoard = history[currentMoveIndex].board;
        const currentMarkers = history[currentMoveIndex].markers || [];
        const manualLabelMap = new Map<string, string>();
        currentMarkers.forEach(m => {
            if (m.type === 'LABEL') {
                manualLabelMap.set(`${m.x - 1},${m.y - 1}`, m.value);
            }
        });

        const getMoveText = (n: number) => {
            if (n > 0) return n.toString();
            if (n === 0) return ""; // Setup stone (No text, just visual stone)
            return ""; // Unnumbered / Simple stone
        };

        // We iterate all locations that had stones
        moveHistory.forEach((moves, key) => {
            const [x, y] = key.split(',').map(Number);
            const currentStone = currentBoard[y][x];
            const manualLabel = manualLabelMap.get(key);

            if (manualLabel) {
                // Manual Label takes precedence. List ALL moves at this spot.
                moves.forEach(m => {
                    footer.push({
                        left: [{ text: getMoveText(m.number), color: m.color }],
                        right: { text: manualLabel, color: m.color }
                    });
                });
            } else if (moves.length > 1) {
                // Collision handling Refined (Step 2110)
                // Filter actual moves vs setup stones
                const setupMoves = moves.filter(m => m.number <= 0);
                const numberedMoves = moves.filter(m => m.number > 0);

                // Sort numbered moves ascending
                numberedMoves.sort((a, b) => a.number - b.number);

                // Most recent move (visible on board)
                const topMove = numberedMoves.length > 0 ? numberedMoves[numberedMoves.length - 1] : moves[moves.length - 1];

                if (setupMoves.length > 0) {
                    // Case: Collision with Setup Stone.
                    // User Request: "Write A on N's location" and legend "N [ A ]". Omit "Init [ A ]" line.
                    const label = alphabet[labelIndex % alphabet.length];
                    labelIndex++;
                    labels.push({ x: x + 1, y: y + 1, label });

                    // Legend: List ALL moves at this label.
                    // Right color should match the hidden Setup stone to indicate what was there.
                    // COMPACT MODE: Group 10, 14, 15 into one entry.
                    const hiddenSetup = setupMoves[0];
                    const leftStones = numberedMoves.map(m => ({ text: getMoveText(m.number), color: m.color }));

                    footer.push({
                        left: leftStones, // Now an array!
                        right: { text: label, color: hiddenSetup.color }
                    });
                } else {
                    // Case: Pure Numbered Collision (e.g. 10 on 6).
                    // Use GOWrite style: 10 [ 6 ]. Direct reference. No Label A.
                    const prevMove = numberedMoves[numberedMoves.length - 2];
                    if (prevMove) {
                        footer.push({
                            left: [{ text: getMoveText(topMove.number), color: topMove.color }],
                            right: { text: getMoveText(prevMove.number), color: prevMove.color }
                        });
                    }
                }
            } else {
                // Single move case.
                const m = moves[0];
                // Check visibility.
                // For Numbered moves: number must match.
                // For Setup/Simple moves (number=0 or undefined): check color and lack of number on current stone.
                const isVisible = currentStone && (
                    (m.number > 0 && currentStone.number === m.number) ||
                    (m.number <= 0 && !currentStone.number && currentStone.color === m.color)
                );

                if (!isVisible) {
                    // It's hidden but NOT a collision (just captured).
                }
            }
        });

        // Sort footer by move number (use first move in group)
        footer.sort((a, b) => parseInt(a.left[0].text) - parseInt(b.left[0].text));

        return { hiddenMoves: footer, specialLabels: labels };
    }, [history, currentMoveIndex]);

    const { hiddenMoves, specialLabels } = hiddenMovesData;

    // Display Board Logic: Swaps current stone for setup stone during export collision
    const displayBoard = useMemo(() => {
        if (!isFigureMode) return board;

        // Strategy: "First Priority / Accumulation"
        // Show stones that occupied the spot FIRST.
        // 1. Setup stones (History 0).
        // 2. Moves 1..Current (First priority).
        // 3. Ignore captures.

        // Start with clean slate for Figure View
        const exportBoard: BoardState = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));

        for (let i = 0; i <= currentMoveIndex; i++) {
            const stepBoard = history[i].board;
            if (!stepBoard) continue;

            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    const stone = stepBoard[y][x];
                    // Fill empty spots only (First Come Priority)
                    if (stone && !exportBoard[y][x]) {
                        exportBoard[y][x] = { ...stone };
                    }
                }
            }
        }

        return exportBoard;
    }, [isFigureMode, history, boardSize, currentMoveIndex]);

    const getRestoredStones = useCallback(() => {
        const restored: { x: number, y: number, color: StoneColor, text: string }[] = [];
        const currentBoard = history[currentMoveIndex].board;
        const size = boardSize;
        const moveHistory = new Map<string, { number: number, color: StoneColor }[]>();

        // 1. Scan History for Numbered Moves
        for (let i = 1; i <= currentMoveIndex; i++) {
            const currBoard = history[i].board;
            const moveNum = history[i - 1].nextNumber;
            // Find move position
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const stone = currBoard[y][x];
                    if (stone && stone.number === moveNum) {
                        const key = `${x},${y}`;
                        if (!moveHistory.has(key)) moveHistory.set(key, []);
                        moveHistory.get(key)?.push({ number: moveNum, color: stone.color });
                    }
                }
            }
        }

        // 2. Identification (Numbered Moves)
        moveHistory.forEach((moves, key) => {
            const [x, y] = key.split(',').map(Number);
            const currentStone = currentBoard[y][x];
            if (!currentStone) {
                const m = moves[0];
                restored.push({
                    x: x + 1, y: y + 1,
                    color: m.color,
                    text: m.number.toString()
                });
            }
        });

        // 3. Scan Base Setup (Simple Mode Stones)
        // If a stone exists in history[0] but is missing in currentBoard, it was captured.
        // (Manual deletion in Simple Mode propagates to history[0], so it wouldn't be there).
        const baseBoard = history[0].board;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const baseStone = baseBoard[y][x];
                const currentStone = currentBoard[y][x];

                // If base stone exists AND current spot is empty
                if (baseStone && !currentStone) {
                    // Check if we already added a restored stone here (from numbered logic)?
                    // Unlikely for setup stone, as it has no number.
                    // But if a numbered move was played and then captured...
                    // The numbered logic adds it.
                    // We should prioritize Numbered restore? or Base restore?
                    // If a Base stone was captured, and THEN a numbered stone was played and captured.
                    // The numbered stone is "later".
                    // But usually we show the *first* stone?
                    // Actually, if Numbered stone was played, the Base stone must have been captured/removed BEFORE that.
                    // So we might have TWO restored stones?
                    // Rendering multiple stones on top of each other?
                    // `performExport` just draws circles.
                    // If we draw Base then Numbered, Numbered covers Base.
                    // Let's check for existing restored entry.
                    const alreadyRestored = restored.some(r => r.x === x + 1 && r.y === y + 1);
                    if (!alreadyRestored) {
                        restored.push({
                            x: x + 1, y: y + 1,
                            color: baseStone.color,
                            text: '' // No number for setup stones
                        });
                    }
                }
            }
        }

        return restored;
    }, [history, currentMoveIndex, boardSize]);

    const performExport = useCallback(async (bounds: { minX: number, maxX: number, minY: number, maxY: number }, restoredStones: { x: number, y: number, color: StoneColor, text: string }[] = [], options: { isSvg: boolean, destination?: 'CLIPBOARD' | 'DOWNLOAD', filename?: string }) => {
        if (!svgRef.current) return;

        const { isSvg, destination = 'CLIPBOARD', filename } = options;
        const CELL_SIZE = 40;
        const MARGIN = 40;
        const PADDING = 20;

        const { minX, maxX, minY, maxY } = bounds;

        const x = (minX - 1) * CELL_SIZE + (MARGIN - PADDING);
        const y = (minY - 1) * CELL_SIZE + (MARGIN - PADDING);
        let width = (maxX - minX) * CELL_SIZE + PADDING * 2;
        let height = (maxY - minY) * CELL_SIZE + PADDING * 2;

        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;

        // Remove selection overlay
        const overlayById = clone.getElementById('selection-overlay-rect');
        if (overlayById) overlayById.remove();
        const overlaysByClass = clone.querySelectorAll('.selection-overlay');
        overlaysByClass.forEach(o => o.remove());
        const rects = clone.querySelectorAll('rect');
        rects.forEach(r => {
            if (r.getAttribute('fill') === 'rgba(0, 0, 255, 0.2)') r.remove();
        });

        // Append Restored Stones
        const svgNS = "http://www.w3.org/2000/svg";

        if (showCapturedInExport) {
            restoredStones.forEach(stone => {
                if (stone.x < minX || stone.x > maxX || stone.y < minY || stone.y > maxY) return;

                const cx = MARGIN + (stone.x - 1) * CELL_SIZE;
                const cy = MARGIN + (stone.y - 1) * CELL_SIZE;

                const g = document.createElementNS(svgNS, 'g');

                const circle = document.createElementNS(svgNS, 'circle');
                circle.setAttribute('cx', cx.toString());
                circle.setAttribute('cy', cy.toString());
                circle.setAttribute('r', '18.4');
                circle.setAttribute('fill', stone.color === 'BLACK' ? 'black' : 'white');
                circle.setAttribute('stroke', 'black');
                circle.setAttribute('stroke-width', stone.color === 'BLACK' ? '2' : '0.7');

                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', cx.toString());
                text.setAttribute('y', cy.toString());
                text.setAttribute('dy', '.35em');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', stone.color === 'BLACK' ? 'white' : 'black');
                const fontSize = (stone.text && stone.text.length >= 3) ? '18' : '26';
                text.setAttribute('font-size', fontSize);
                text.setAttribute('font-family', 'Arial, sans-serif');
                text.setAttribute('font-weight', 'bold');
                text.textContent = stone.text;

                g.appendChild(circle);
                g.appendChild(text);
                clone.appendChild(g);
            });
        }

        // Handle Footer (Hidden Moves Explanation)
        const footerGroup = clone.getElementById('footer-group');
        if (footerGroup) {
            if (hiddenMoves.length > 0) {
                // Relocate Footer to be visible in the cropped view
                const startX = MARGIN + (minX - 1) * CELL_SIZE - CELL_SIZE / 2 + (showCoordinates ? -25 : 0) + 10;
                // Add more vertical spacing: 40px (Standardized with GoBoard)
                const startY = MARGIN + (maxY - 1) * CELL_SIZE + CELL_SIZE / 2 + (showCoordinates ? 25 : 0) + 40;

                footerGroup.setAttribute('transform', `translate(${startX}, ${startY})`);

                // Dynamic Flow Layout Logic for Export
                // We need to calculate widths exactly as GoBoard.tsx does to match layout.
                const boardDisplayWidth = (maxX - minX + 1) * CELL_SIZE;

                let currentX = 0;
                let currentY = 0;
                let maxRowY = 0;

                // Re-flow Footer Items
                const children = Array.from(footerGroup.children);
                let itemIndex = 0;

                children.forEach((child) => {
                    // Skip background rect
                    if (child.tagName.toLowerCase() === 'rect') return;

                    // Get corresponding data item to calculate width
                    // hiddenMoves is the source data.
                    const moveData = hiddenMoves[itemIndex];
                    if (!moveData) return; // Should not happen

                    const leftW = 20 + (moveData.left.length * 35);
                    const rightW = 80;
                    const itemWidth = leftW + rightW;

                    if (itemIndex === 0) {
                        currentX = 0;
                        currentY = 0;
                    } else {
                        if (currentX + itemWidth + 20 + itemWidth > boardDisplayWidth) {
                            if (currentX + 20 + itemWidth > boardDisplayWidth) {
                                currentX = 0;
                                currentY += 40;
                            } else {
                                currentX += 20;
                            }
                        } else {
                            if (currentX + 20 + itemWidth > boardDisplayWidth) {
                                currentX = 0;
                                currentY += 40;
                            } else {
                                currentX += 20;
                            }
                        }
                    }

                    // Set transform
                    child.setAttribute('transform', `translate(${currentX}, ${currentY})`);

                    // Advance X for next item
                    currentX += itemWidth;

                    // Track Max Y for height calc
                    maxRowY = Math.max(maxRowY, currentY);

                    itemIndex++;
                });

                // Calculate required extra height based on LAST item's Y position
                const footerContentHeight = maxRowY + 40; // +40 for the last row height

                // Robust Height Calculation
                const currentViewboxBottom = y + height;
                const requiredBottom = startY + footerContentHeight + 30;

                if (requiredBottom > currentViewboxBottom) {
                    height = requiredBottom - y;
                }
            }
        }


        // No width extension needed as we wrap content.
        clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        clone.setAttribute('width', `${width}`);
        clone.setAttribute('height', `${height}`);

        const bgColor = isMonochrome ? '#FFFFFF' : '#DCB35C';
        if (isSvg) {
            await exportToSvg(clone, bgColor);
        } else {
            await exportToPng(clone, { scale: 3, backgroundColor: bgColor, destination: destination, filename });
        }
    }, [hiddenMoves, showCoordinates, showCapturedInExport, isMonochrome]);

    // Kifu Metadata
    const [blackName, setBlackName] = useState('');
    const [blackRank, setBlackRank] = useState('');
    const [blackTeam, setBlackTeam] = useState('');
    const [whiteName, setWhiteName] = useState('');
    const [whiteRank, setWhiteRank] = useState('');
    const [whiteTeam, setWhiteTeam] = useState('');
    const [komi, setKomi] = useState('');
    const [handicap, setHandicap] = useState('');
    const [gameResult, setGameResult] = useState('');
    const [gameDate, setGameDate] = useState('');
    const [gamePlace, setGamePlace] = useState('');
    const [gameEvent, setGameEvent] = useState('');
    const [gameRound, setGameRound] = useState('');
    const [gameTime, setGameTime] = useState('');
    const [gameName, setGameName] = useState(''); // GN
    const [gameUser, setGameUser] = useState('');
    const [gameSource, setGameSource] = useState('');
    const [gameComment, setGameComment] = useState('');
    const [gameCopyright, setGameCopyright] = useState('');
    const [gameAnnotation, setGameAnnotation] = useState('');

    const [showGameInfoModal, setShowGameInfoModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);

    // Variable Substitution
    const formatPrintString = (template: string, pageNum: number = 1) => {
        let s = template;
        s = s.replace(/%GN%/g, gameName || gameEvent || '');
        s = s.replace(/%EV%/g, gameEvent || '');
        s = s.replace(/%DT%/g, gameDate || '');
        s = s.replace(/%PC%/g, gamePlace || '');
        s = s.replace(/%PB%/g, blackName || '黒番');
        s = s.replace(/%BR%/g, blackRank || '');
        s = s.replace(/%PW%/g, whiteName || '白番');
        s = s.replace(/%WR%/g, whiteRank || '');
        s = s.replace(/%RE%/g, gameResult || '');
        s = s.replace(/%KM%/g, komi || '');
        s = s.replace(/%PAGE%/g, pageNum.toString());
        return s;
    };

    const handlePrintRequest = (settings: PrintSettings) => {
        // Side Panel Workaround: Open in new tab to print
        const sgf = getSGFString();
        localStorage.setItem('gorw_temp_print_sgf', sgf);
        localStorage.setItem('gorw_temp_print_settings', JSON.stringify(settings));
        localStorage.setItem('gorw_temp_print_index', currentMoveIndex.toString());

        // Open new tab (relative path to index.html)
        const printWindow = window.open('index.html?print_job=true', '_blank');
        if (!printWindow) {
            flushSync(() => {
                setPrintSettings(settings);
                setShowPrintModal(false);
            });
            window.print();
            return;
        }

        setShowPrintModal(false);
    };

    // Print Job Initialization
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('print_job') === 'true') {
            setIsPrintJob(true);
            const sgf = localStorage.getItem('gorw_temp_print_sgf');
            const settingsStr = localStorage.getItem('gorw_temp_print_settings');

            if (sgf && settingsStr) {
                if (sgf.length > 20) {
                    try {
                        loadSGF(sgf);
                        const savedIndex = localStorage.getItem('gorw_temp_print_index');
                        if (savedIndex !== null) {
                            setCurrentMoveIndex(parseInt(savedIndex, 10));
                        }
                    } catch (e) {
                        alert("Failed to load SGF data: " + e);
                    }
                }
                setPrintSettings(JSON.parse(settingsStr));

                // Set title
                document.title = "Print Preview - GORewrite";

                const triggerPrint = () => {
                    try {
                        window.focus();
                        window.print();
                    } catch (e) {
                        console.warn("Auto-print failed", e);
                    }
                };

                // Auto-print with delay to ensure rendering
                if (document.readyState === 'complete') {
                    setTimeout(triggerPrint, 800);
                } else {
                    window.addEventListener('load', () => setTimeout(triggerPrint, 800), { once: true });
                }
            }
        }
    }, []);

    const loadSGF = (content: string) => {
        const { board: initialBoard, moves, size, metadata } = parseSGF(content);
        setBoardSize(size);

        // Metadata
        if (metadata) {
            setBlackName(metadata.blackName || '');
            setBlackRank(metadata.blackRank || '');
            setBlackTeam(metadata.blackTeam || '');
            setWhiteName(metadata.whiteName || '');
            setWhiteRank(metadata.whiteRank || '');
            setWhiteTeam(metadata.whiteTeam || '');
            setKomi(metadata.komi || '');
            setHandicap(metadata.handicap || '');
            setGameResult(metadata.result || '');
            setGameDate(metadata.date || '');
            setGamePlace(metadata.place || '');
            setGameEvent(metadata.event || '');
            setGameRound(metadata.round || '');
            setGameTime(metadata.time || '');
            setGameName(metadata.gameName || '');
            setGameUser(metadata.user || '');
            setGameSource(metadata.source || '');
            setGameComment(metadata.gameComment || '');
            setGameCopyright(metadata.copyright || '');
            setGameAnnotation(metadata.annotation || '');
        } else {
            // Reset if no metadata found (or keep previous? usually reset)
            setBlackName(''); setBlackRank(''); setBlackTeam('');
            setWhiteName(''); setWhiteRank(''); setWhiteTeam('');
            setKomi(''); setHandicap(''); setGameResult('');
            setGameDate(''); setGamePlace(''); setGameEvent(''); setGameRound(''); setGameTime('');
            setGameName(''); setGameUser(''); setGameSource(''); setGameComment(''); setGameCopyright(''); setGameAnnotation('');
        }

        // Replay Logic
        // 1. Initial State (Setup)
        const initialState: HistoryState = {
            board: initialBoard, // This contains AB/AW setup
            nextNumber: 1,
            activeColor: 'BLACK', // Default start
            boardSize: size
        };

        const newHistory = [initialState];
        let currentBoard = JSON.parse(JSON.stringify(initialBoard)); // Deep copy
        let moveNum = 1;

        // 2. Iterate Moves
        moves.forEach(move => {
            const { x, y, color } = move;

            // Validate stats
            if (x < 1 || x > size || y < 1 || y > size) return;

            // Place stone
            // Ensure we don't overwrite if not empty? standard SGF allows overwrite.
            currentBoard[y - 1][x - 1] = { color, number: moveNum };

            // Check captures
            // Note: checkCaptures expects 0-indexed coords
            const captures = checkCaptures(currentBoard, x - 1, y - 1, color);
            captures.forEach(c => {
                currentBoard[c.y][c.x] = null;
            });

            // Prepare next state
            const nextActive = color === 'BLACK' ? 'WHITE' : 'BLACK';

            newHistory.push({
                board: JSON.parse(JSON.stringify(currentBoard)),
                nextNumber: moveNum + 1,
                activeColor: nextActive,
                boardSize: size
            });
            moveNum++;
        });

        // Update State (Batch update)
        setHistory(newHistory);

        // Reset to 0 (Start) initially, but caller might override to current index
        setCurrentMoveIndex(0);
    };



    const handleExport = useCallback(async (forcedMode?: 'SVG' | 'PNG', destination?: 'CLIPBOARD' | 'DOWNLOAD') => {
        const modeToUse = forcedMode || exportMode;
        const isSvg = modeToUse === 'SVG';
        const filename = `go_board_${new Date().toISOString().slice(0, 10)}.png`;

        const boardEl = svgRef.current;
        if (!boardEl) return;

        // Auto-Enable Figure Mode (Show Label A) for Export
        setIsFigureMode(true);
        // Wait for React Render
        await new Promise(r => setTimeout(r, 50));

        try {
            // Auto-crop to all stones
            const { hasStones, minX, maxX, minY, maxY } = getBounds();
            const restored = showCapturedInExport ? getRestoredStones() : [];
            let finalMinX = minX, finalMaxX = maxX, finalMinY = minY, finalMaxY = maxY, finalHasStones = hasStones;

            if (restored.length > 0) {
                finalHasStones = true;
                restored.forEach(s => {
                    if (s.x < finalMinX) finalMinX = s.x;
                    if (s.x > finalMaxX) finalMaxX = s.x;
                    if (s.y < finalMinY) finalMinY = s.y;
                    if (s.y > finalMaxY) finalMaxY = s.y;
                });
            }

            if (finalMinX === Infinity) { finalMinX = 1; finalMaxX = boardSize; finalMinY = 1; finalMaxY = boardSize; }

            const performExportAction = async (element: SVGSVGElement) => {
                if (isSvg) {
                    await exportToSvg(element, isMonochrome ? '#FFFFFF' : '#DCB35C');
                } else {
                    await exportToPng(element, { scale: 3, backgroundColor: isMonochrome ? '#FFFFFF' : '#DCB35C', destination, filename });
                }
            };

            if (finalHasStones) {
                // Pass wrapper to performExport? No, performExport handles the restricted view render.
                // We need to pass the mode to performExport or handle logic there.
                // Refactor: performExport takes callback? 

                await performExport({ minX: finalMinX, maxX: finalMaxX, minY: finalMinY, maxY: finalMaxY }, restored, { isSvg, destination, filename });
            } else {
                if (svgRef.current) await performExportAction(svgRef.current);
            }
        } finally {
            // Revert to Operation Mode (Number 11)
            setIsFigureMode(false);
        }
    }, [getBounds, isMonochrome, getRestoredStones, boardSize, showCapturedInExport, performExport]);

    const handleExportSelection = useCallback(async () => {
        if (!selectionStart || !selectionEnd) return;

        const x1 = Math.min(selectionStart.x, selectionEnd.x);
        const x2 = Math.max(selectionStart.x, selectionEnd.x);
        const y1 = Math.min(selectionStart.y, selectionEnd.y);
        const y2 = Math.max(selectionStart.y, selectionEnd.y);

        // Auto-Enable Figure Mode (Show Label A) for Export
        setIsFigureMode(true);
        // Wait for React Render
        await new Promise(r => setTimeout(r, 50));

        try {
            const restored = showCapturedInExport ? getRestoredStones() : [];
            await performExport({ minX: x1, maxX: x2, minY: y1, maxY: y2 }, restored, { isSvg: exportMode === 'SVG' });
        } finally {
            // Revert
            setIsFigureMode(false);
        }

        // Reset Selection
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        setDragMode('SELECTING');
        setMoveSource(null);
    }, [selectionStart, selectionEnd, getBounds, getRestoredStones, showCapturedInExport, performExport]);



    // SGF Logic
    const getSGFString = useCallback(() => {
        const toSgfCoord = (c: number): string => {
            if (c < 1 || c > 26) return '';
            return String.fromCharCode(96 + c);
        };

        const nodes: import('./utils/sgfUtils').SgfNode[] = [];
        const size = boardSize;

        for (let i = 1; i < history.length; i++) {
            const prev = history[i - 1];
            const curr = history[i];

            const isMove = curr.nextNumber > prev.nextNumber;
            const moveNumber = prev.nextNumber;

            if (isMove) {
                let moveCoord = '';
                let moveColor: StoneColor = 'BLACK';
                let moveX = -1;
                let moveY = -1;

                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const s = curr.board[y][x];
                        if (s && s.number === moveNumber) {
                            moveCoord = `${toSgfCoord(x + 1)}${toSgfCoord(y + 1)}`;
                            moveColor = s.color;
                            moveX = x;
                            moveY = y;
                            break;
                        }
                    }
                }

                // Calculate natural captures to exclude them from AE
                const naturalCaptureSet = new Set<string>();
                if (moveX !== -1) {
                    // Simulate move on previous board
                    const tempBoard = prev.board.map(r => [...r]);
                    // Only place if empty? Standard move assumes empty. 
                    // But here we are just checking captures logic.
                    tempBoard[moveY][moveX] = { color: moveColor };

                    const captures = checkCaptures(tempBoard, moveX, moveY, moveColor);
                    captures.forEach(c => {
                        naturalCaptureSet.add(`${toSgfCoord(c.x + 1)}${toSgfCoord(c.y + 1)}`);
                    });
                }

                const ae: string[] = [];
                const ab: string[] = [];
                const aw: string[] = [];

                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const sPrev = prev.board[y][x];
                        const sCurr = curr.board[y][x];
                        const c = `${toSgfCoord(x + 1)}${toSgfCoord(y + 1)}`;

                        const same = (sPrev === sCurr) ||
                            (sPrev && sCurr && sPrev.color === sCurr.color && sPrev.number === sCurr.number) ||
                            (!sPrev && !sCurr);

                        if (!same) {
                            if (sPrev && !sCurr) {
                                // Stone removed. Check if it's a natural capture.
                                if (!naturalCaptureSet.has(c)) {
                                    ae.push(c);
                                }
                            } else if (!sPrev && sCurr) {
                                if (sCurr.number === moveNumber && c === moveCoord) {
                                    // Move stone
                                } else {
                                    if (sCurr.color === 'BLACK') ab.push(c);
                                    else aw.push(c);
                                }
                            } else if (sPrev && sCurr) {
                                ae.push(c);
                                if (sCurr.number === moveNumber && c === moveCoord) {
                                    // Move stone replacement
                                } else {
                                    if (sCurr.color === 'BLACK') ab.push(c);
                                    else aw.push(c);
                                }
                            }
                        }
                    }
                }

                // Prepare Annotations
                const lb: string[] = [];
                const tr: string[] = [];
                const cr: string[] = [];
                const sq: string[] = [];
                const ma: string[] = [];
                if (curr.markers) {
                    curr.markers.forEach(m => {
                        const c = `${toSgfCoord(m.x)}${toSgfCoord(m.y)}`;
                        if (m.type === 'LABEL') lb.push(`${c}:${m.value}`);
                        else if (m.type === 'SYMBOL') {
                            if (m.value === 'TRI') tr.push(c);
                            else if (m.value === 'CIR') cr.push(c);
                            else if (m.value === 'SQR') sq.push(c);
                            else if (m.value === 'X') ma.push(c);
                        }
                    });
                }

                nodes.push({
                    type: 'MOVE',
                    color: moveColor,
                    coord: moveCoord,
                    number: moveNumber,
                    ae, ab, aw,
                    lb, tr, cr, sq, ma
                });

            } else {
                const ae: string[] = [];
                const ab: string[] = [];
                const aw: string[] = [];

                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const sPrev = prev.board[y][x];
                        const sCurr = curr.board[y][x];
                        const c = `${toSgfCoord(x + 1)}${toSgfCoord(y + 1)}`;

                        const same = (sPrev === sCurr) ||
                            (sPrev && sCurr && sPrev.color === sCurr.color && sPrev.number === sCurr.number) ||
                            (!sPrev && !sCurr);

                        if (!same) {
                            if (sPrev) ae.push(c);
                            if (sCurr) {
                                if (sCurr.color === 'BLACK') ab.push(c);
                                else aw.push(c);
                            }
                        }
                    }
                }

                // Prepare Annotations
                const lb: string[] = [];
                const tr: string[] = [];
                const cr: string[] = [];
                const sq: string[] = [];
                const ma: string[] = [];
                if (curr.markers) {
                    curr.markers.forEach(m => {
                        const c = `${toSgfCoord(m.x)}${toSgfCoord(m.y)}`;
                        if (m.type === 'LABEL') lb.push(`${c}:${m.value}`);
                        else if (m.type === 'SYMBOL') {
                            if (m.value === 'TRI') tr.push(c);
                            else if (m.value === 'CIR') cr.push(c);
                            else if (m.value === 'SQR') sq.push(c);
                            else if (m.value === 'X') ma.push(c);
                        }
                    });
                }

                if (ae.length > 0 || ab.length > 0 || aw.length > 0 || lb.length > 0 || tr.length > 0 || cr.length > 0 || sq.length > 0 || ma.length > 0) {
                    nodes.push({
                        type: 'SETUP',
                        ae, ab, aw,
                        lb, tr, cr, sq, ma
                    });
                }
            }
        }

        const metadata: import('./utils/sgfUtils').SgfMetadata = {
            blackName,
            blackRank,
            blackTeam,
            whiteName,
            whiteRank,
            whiteTeam,
            komi,
            handicap,
            result: gameResult,
            date: gameDate,
            place: gamePlace,
            event: gameEvent,
            round: gameRound,
            time: gameTime,
            gameName,
            user: gameUser,
            source: gameSource,
            gameComment,
            copyright: gameCopyright,
            annotation: gameAnnotation
        };

        return generateSGF(history[0].board, boardSize, nodes, metadata);
    }, [history, currentMoveIndex, boardSize,
        blackName, blackRank, blackTeam,
        whiteName, whiteRank, whiteTeam,
        komi, handicap, gameResult, gameDate,
        gamePlace, gameEvent, gameRound, gameTime,
        gameName, gameUser, gameSource,
        gameComment, gameCopyright, gameAnnotation
    ]);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            if (evt.target?.result) {
                loadSGF(evt.target.result as string);
                setSaveFileHandle(null); // No handle from input
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleOpenSGF = async () => {
        try {
            // @ts-ignore
            if (window.showOpenFilePicker) {
                // @ts-ignore
                const [handle] = await window.showOpenFilePicker({
                    id: 'gorw_sgf',
                    startIn: saveFileHandle || undefined,
                    types: [{
                        description: 'Smart Game Format',
                        accept: { 'application/x-go-sgf': ['.sgf'] },
                    }],
                    multiple: false
                });
                const file = await handle.getFile();
                const text = await file.text();
                loadSGF(text);
                setSaveFileHandle(handle); // Store handle for Overwrite
                return;
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            console.warn('Open File Picker failed, falling back to input', err);
        }
        // Fallback
        fileInputRef.current?.click();
    };

    const handleSaveSGF = async () => {
        const sgf = getSGFString();
        const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
        const url = URL.createObjectURL(blob);

        // 1) File System Access API (最優先)
        try {
            // @ts-ignore
            if (window.showSaveFilePicker) {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    id: 'gorw_sgf',
                    suggestedName: '',
                    startIn: saveFileHandle || undefined,
                    types: [{
                        description: 'Smart Game Format',
                        accept: { 'application/x-go-sgf': ['.sgf'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(sgf);
                await writable.close();
                setSaveFileHandle(handle); // Overwrite に使うハンドルを保持
                URL.revokeObjectURL(url);
                return;
            }
        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                URL.revokeObjectURL(url);
                return; // ユーザーキャンセル
            }
            console.warn('Save File Picker failed, try downloads API', err);
        }

        // 2) downloads API で強制的にエクスプローラを開く
        if (typeof chrome !== 'undefined' && chrome?.downloads?.download) {
            try {
                await new Promise<void>((resolve, reject) => {
                    chrome.downloads.download(
                        { url, filename: '', saveAs: true, conflictAction: 'overwrite' },
                        (downloadId: number) => {
                            const lastErr = chrome.runtime?.lastError;
                            if (lastErr) reject(lastErr);
                            else {
                                notifyDownloadLocation(downloadId);
                                resolve();
                            }
                        }
                    );
                });
                URL.revokeObjectURL(url);
                return;
            } catch (err) {
                console.warn('chrome.downloads download failed', err);
            }
        }

        // 3) それでも無理な場合は明示的に知らせる（自動DLは避ける）
        URL.revokeObjectURL(url);
        alert('保存ダイアログを開けませんでした。拡張の「ダウンロード」権限を許可して再試行してください。');
    };

    const handleOverwriteSave = async () => {
        if (saveFileHandle) {
            try {
                const sgf = getSGFString();
                const writable = await saveFileHandle.createWritable();
                await writable.write(sgf);
                await writable.close();
                console.log('Overwritten successfully');
                // Optional: Toast?
                return;
            } catch (err) {
                console.error('Overwrite failed', err);
                // If permission lost or file deleted, fallback to Save As
                setSaveFileHandle(null);
                handleSaveSGF();
            }
        }
    };





    const handleZoomToSelection = () => {
        if (selectionStart && selectionEnd) {
            const minX = Math.min(selectionStart.x, selectionEnd.x);
            const maxX = Math.max(selectionStart.x, selectionEnd.x);
            const minY = Math.min(selectionStart.y, selectionEnd.y);
            const maxY = Math.max(selectionStart.y, selectionEnd.y);
            setViewRange({ minX, maxX, minY, maxY });
            // Clear selection after zoom
            setSelectionStart(null);
            setSelectionEnd(null);
        }
    };

    // Prevent default scroll on board
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const preventScroll = (e: WheelEvent) => {
            e.preventDefault();
        };
        el.addEventListener('wheel', preventScroll, { passive: false });
        return () => el.removeEventListener('wheel', preventScroll);
    }, []);

    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text');
            if (text && (text.includes('(;') || text.includes('GM['))) {
                e.preventDefault();
                loadSGF(text);
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [history, currentMoveIndex, nextNumber, activeColor]);

    const setNextNumberDirectly = (n: number) => {
        const newHistory = [...history];
        newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], nextNumber: n };
        setHistory(newHistory);
    };

    const clearBoard = () => {
        setHistory([{
            board: Array(boardSize).fill(null).map(() => Array(boardSize).fill(null)),
            nextNumber: 1,
            activeColor: 'BLACK',
            boardSize: boardSize
        }]);
        setCurrentMoveIndex(0);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const onKeyDown = async (e: KeyboardEvent) => {
            // Common Modifiers
            const isCtrl = e.ctrlKey || e.metaKey;

            // Suppress browser defaults for app shortcuts and common conflicting keys
            if (isCtrl) {
                if (['n', 'o', 's', 'f', 'p', 'b'].includes(e.key.toLowerCase())) {
                    e.preventDefault();
                }
            }

            if (e.key === 'Escape') {
                if (showHelp) { setShowHelp(false); return; }
                if (isSelecting || selectionStart) {
                    setIsSelecting(false);
                    setSelectionStart(null);
                    setSelectionEnd(null);
                    setDragMode('SELECTING');
                    setMoveSource(null);
                    return;
                }
                if (isCropped) { setViewRange(null); return; }
            }

            if (e.key === 'Delete') {
                const deleted = handleDeleteParams();
                if (!deleted) {
                    deleteLastMove();
                }
                return;
            }

            if (e.key === 'Backspace') {
                stepBack(); // Backspace as Navigation Back
                return;
            }

            if (e.key === 'ArrowLeft') { stepBack(); return; }
            if (e.key === 'ArrowRight') { stepForward(); return; }

            // Shortcuts
            if (isCtrl) {
                switch (e.key.toLowerCase()) {
                    case 'z': // Ctrl+Z: Undo Action (Delete Last Move)
                        deleteLastMove();
                        break;
                    case 'y': // Ctrl+Y: Redo Action (Restore Move)
                        restoreMove();
                        break;
                    // case 'n': // Ctrl+N suppressed above. Use Alt+N for New.
                    case 'o': // Open SGF
                        fileInputRef.current?.click();
                        break;
                    case 's': // Save SGF
                        handleSaveSGF();
                        break;
                    case 'f': // Copy Image
                        if (selectionStart && selectionEnd) {
                            handleExportSelection();
                        } else {
                            handleExport();
                        }
                        break;
                    case 'b': // Copy SGF
                        const sgf = getSGFString();
                        try {
                            await navigator.clipboard.writeText(sgf);
                            // Optional: Toast notification could be nice here
                            console.log('SGF Copied to clipboard');
                        } catch (err) {
                            console.error('Failed to copy SGF', err);
                        }
                        break;
                    case 'p': // Ctrl+P
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            setShowPrintModal(true);
                        }
                        break;
                    // Ctrl+V is handled by 'paste' event listener
                }
            }

            // Check for Alt+N (New)
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                clearBoard();
            }
        };
        // Use capture phase for better override chance
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [
        board, boardSize, history, currentMoveIndex,
        showHelp, isSelecting, selectionStart, selectionEnd, isCropped,
        handleExportSelection, handleExport, handleSaveSGF, clearBoard, handleDeleteParams, deleteLastMove
    ]);

    // Generate hidden move references and special labels
    // Logic: Identify board locations with multiple moves (collisions).
    // Assign letters A, B, C... to those locations.
    // Footer lists all moves at those locations as "MoveNum [ Label ]".




    // --- Drag & Drop Implementation ---
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
            e.dataTransfer.dropEffect = 'copy';
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only reset if leaving the window/container
        // Check relatedTarget to avoid flickering when moving over child elements
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            // Simple check for extension or rely on user knowing it's SGF
            if (file.name.toLowerCase().endsWith('.sgf') || file.name.toLowerCase().endsWith('.txt')) { // Allow txt too for convenience
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target?.result;
                    if (typeof content === 'string') {
                        loadSGF(content);
                    }
                };
                reader.readAsText(file);
            } else {
                alert('SGF files only (.sgf)');
            }
        }
    }, [loadSGF]);


    return (
        <>
            <div
                className={`p-4 bg-gray-100 min-h-screen flex flex-col items-center font-sans text-sm pb-20 select-none relative ${isDragging ? 'bg-blue-50 outline outline-4 outline-blue-400 outline-offset-[-4px]' : ''} ${isPrintJob ? '!hidden' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Overlay for "Drop File Here" visual feedback */}
                {isDragging && (
                    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-blue-100 bg-opacity-50">
                        <div className="text-4xl font-bold text-blue-600 bg-white p-8 rounded-xl shadow-lg border-4 border-blue-400">
                            Drop SGF File Here
                        </div>
                    </div>
                )}

                {/* Print Area Removed (Moved Outside) */}
                <div className="flex justify-between w-full items-center mb-2">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[10px] text-gray-400 font-normal pl-1">v35.0</span>
                    </div>
                    <div className="flex gap-2 items-center">

                        {/* Hidden Input for Open SGF */}
                        <input
                            type="file"
                            accept=".sgf"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                        />

                        {/* Group 1: File Operations */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                            <button onClick={clearBoard} title="New / Clear (Alt+N)" className="w-6 h-6 rounded-md bg-white hover:bg-red-50 text-red-600 flex items-center justify-center font-bold transition-all text-sm shadow-sm">
                                🗑️
                            </button>
                            <button onClick={handleOpenSGF} title="Open SGF (Ctrl+O)" className="w-6 h-6 rounded-md bg-white hover:bg-blue-50 text-blue-600 flex items-center justify-center font-bold transition-all text-sm shadow-sm">
                                📂
                            </button>
                            <button onClick={handleOverwriteSave} title="Overwrite Save (Save)" className="w-6 h-6 rounded-md bg-white hover:bg-green-50 text-green-700 flex items-center justify-center font-bold transition-all text-sm shadow-sm">
                                💾
                            </button>
                            <button onClick={handleSaveSGF} title="Save As... (Ctrl+S)" className="w-6 h-6 rounded-md bg-white hover:bg-orange-50 text-orange-600 flex items-center justify-center font-bold transition-all shadow-sm">
                                <img src="/icons/save_as_v2.png" alt="Save As" className="w-4 h-4 object-contain opacity-80" />
                            </button>
                        </div>

                        {/* Group 2: Edit (Undo/Redo) */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                            <button onClick={deleteLastMove} disabled={currentMoveIndex === 0} title="Delete Last Move (Delete/Ctrl+Z)"
                                className="w-6 h-6 rounded-md bg-white hover:bg-red-50 text-red-700 disabled:opacity-50 disabled:bg-gray-50 flex items-center justify-center font-bold text-sm transition-all shadow-sm">
                                ⌫
                            </button>
                            <button onClick={restoreMove} disabled={redoStack.length === 0} title="Restore Deleted Move (Ctrl+Y)"
                                className="w-6 h-6 rounded-md bg-white hover:bg-blue-50 text-blue-700 disabled:opacity-50 disabled:bg-gray-50 flex items-center justify-center font-bold text-sm transition-all shadow-sm">
                                ↻
                            </button>
                        </div>

                        {/* Group 3: View & Tools */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowPrintModal(true);
                                }}
                                className="w-6 h-6 rounded-md bg-white hover:bg-gray-50 text-gray-600 flex items-center justify-center font-bold text-sm transition-all shadow-sm"
                                title="Print (Ctrl+P)"
                            >
                                🖨️
                            </button>
                            <button
                                onClick={() => setShowCapturedInExport(!showCapturedInExport)}
                                title={`Show Captured Stones in Export: ${showCapturedInExport ? 'ON' : 'OFF'}`}
                                className={`w-6 h-6 rounded-md flex items-center justify-center font-bold transition-all text-sm shadow-sm ${showCapturedInExport ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : 'bg-white text-gray-400 hover:text-purple-500'}`}
                            >
                                👻
                            </button>
                            <button
                                onClick={() => setShowNumbers(!showNumbers)}
                                title={`Toggle Numbers: ${showNumbers ? 'ON' : 'OFF'}`}
                                className={`w-6 h-6 rounded-md flex items-center justify-center font-bold transition-all text-sm shadow-sm ${showNumbers ? 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-300' : 'bg-white text-gray-400 hover:text-cyan-500'}`}
                            >
                                ⑧
                            </button>
                            <button onClick={handlePass} disabled={mode !== 'NUMBERED'} title="Pass"
                                className="w-6 h-6 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50 font-bold flex items-center justify-center text-sm shadow-sm text-gray-700">
                                ✋
                            </button>
                        </div>

                        {/* Group 4: Export */}
                        <div className="flex bg-indigo-50 rounded-lg items-center px-0.5 py-0.5 border border-indigo-100 gap-0.5">
                            <button onClick={() => { if (selectionStart && selectionEnd) handleExportSelection(); else handleExport(); }}
                                title={`Copy as ${exportMode} (Click to Copy)`} className="w-6 h-6 rounded-md bg-white text-indigo-600 hover:bg-indigo-50 flex items-center justify-center font-bold transition-all text-sm shadow-sm">
                                📷
                            </button>
                            <button
                                onClick={() => handleExport('PNG', 'DOWNLOAD')}
                                title="Save as PNG..."
                                className="w-6 h-6 rounded-md bg-white text-indigo-600 hover:bg-indigo-50 flex items-center justify-center font-bold transition-all text-sm shadow-sm"
                            >
                                ⬇️
                            </button>
                            <button
                                title="Toggle Export Format (SVG/PNG)"
                                onClick={() => {
                                    const next = exportMode === 'SVG' ? 'PNG' : 'SVG';
                                    setExportMode(next);
                                    localStorage.setItem('gorw_export_mode', next);
                                }}
                                className="text-[9px] font-bold px-1 rounded bg-white border shadow-sm text-gray-600 hover:text-blue-600 ml-0.5 h-6 flex items-center"
                            >
                                {exportMode}
                            </button>
                        </div>

                        {/* Group 5: System */}
                        <div className="flex items-center gap-1 pl-1">
                            <button
                                onClick={() => window.open('index.html', '_blank')}
                                className="w-6 h-6 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center font-bold text-[10px] transition-all"
                                title="Open in New Tab (Maximize)"
                            >
                                ↗
                            </button>
                            <button
                                onClick={() => setShowHelp(true)}
                                className="w-6 h-6 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center font-bold text-xs transition-all"
                                title="Help"
                            >
                                ?
                            </button>
                        </div>
                    </div>
                </div>

                {/* Help Modal */}
                {showHelp && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
                        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
                            <button
                                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 font-bold text-lg"
                                onClick={() => setShowHelp(false)}
                            >
                                ×
                            </button>
                            <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Shortcuts & Help</h2>
                            <div className="space-y-3 text-sm text-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xl">🖱️</div>
                                    <div>
                                        <div className="font-bold">Click / Right Click</div>
                                        <div className="text-xs text-gray-500">Place Stone / Delete Stone</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xl">🖱️</div>
                                    <div>
                                        <div className="font-bold">Drag</div>
                                        <div className="text-xs text-gray-500">Select Area (Crop) / Move Stone</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xl">⚙️</div>
                                    <div>
                                        <div className="font-bold">Wheel</div>
                                        <div className="text-xs text-gray-500">Undo / Redo</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xs font-mono border rounded bg-gray-100">Ctrl+F</div>
                                    <div>
                                        <div className="font-bold">Copy Image</div>
                                        <div className="text-xs text-gray-500">Save to Clipboard (High Res)</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xs font-mono border rounded bg-gray-100">Ctrl+V</div>
                                    <div>
                                        <div className="font-bold">Paste SGF</div>
                                        <div className="text-xs text-gray-500">Load SGF from Clipboard</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xs font-mono border rounded bg-gray-100">Esc</div>
                                    <div>
                                        <div className="font-bold">Cancel</div>
                                        <div className="text-xs text-gray-500">Clear Selection / Close Help</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 text-center text-xs text-gray-400">
                                GORewrite v22
                            </div>
                        </div>
                    </div>
                )}

                {/* Print Settings Modal */}
                <PrintSettingsModal
                    isOpen={showPrintModal}
                    onClose={() => setShowPrintModal(false)}
                    onPrint={handlePrintRequest}
                />

                {/* Actual Print Content Removed (Moved Outside) */}

                {/* Game Metadata Inputs (Replaced with Modal Trigger) */}
                <div className="w-full mb-2 flex justify-start print:hidden">
                    <button
                        onClick={() => setShowGameInfoModal(true)}
                        className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-3 py-1 text-gray-700"
                    >
                        <span>ℹ️</span>
                        <span>Game Info...</span>
                    </button>
                </div>

                {showGameInfoModal && (
                    <GameInfoModal
                        onClose={() => setShowGameInfoModal(false)}
                        blackName={blackName} setBlackName={setBlackName}
                        blackRank={blackRank} setBlackRank={setBlackRank}
                        blackTeam={blackTeam} setBlackTeam={setBlackTeam}
                        whiteName={whiteName} setWhiteName={setWhiteName}
                        whiteRank={whiteRank} setWhiteRank={setWhiteRank}
                        whiteTeam={whiteTeam} setWhiteTeam={setWhiteTeam}
                        komi={komi} setKomi={setKomi}
                        handicap={handicap} setHandicap={setHandicap}
                        result={gameResult} setResult={setGameResult}
                        gameName={gameName} setGameName={setGameName}
                        event={gameEvent} setEvent={setGameEvent}
                        date={gameDate} setDate={setGameDate}
                        place={gamePlace} setPlace={setGamePlace}
                        round={gameRound} setRound={setGameRound}
                        time={gameTime} setTime={setGameTime}
                        user={gameUser} setUser={setGameUser}
                        source={gameSource} setSource={setGameSource}
                        gameComment={gameComment} setGameComment={setGameComment}
                        copyright={gameCopyright} setCopyright={setGameCopyright}
                        annotation={gameAnnotation} setAnnotation={setGameAnnotation}
                    />
                )}

                {/* Visual Style Toolbar */}
                <div className="w-full flex justify-end mb-2 gap-2">
                    <button
                        onClick={() => setIsMonochrome(!isMonochrome)}
                        className={`text-xs px-2 py-1 rounded border shadow-sm transition-colors ${isMonochrome
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                            }`}
                        title="Toggle Monochrome (Printer Friendly)"
                    >
                        {isMonochrome ? '白黒' : 'カラー'}
                    </button>
                </div>

                {/* Board Container */}
                <div
                    className="bg-white shadow-lg p-2 rounded mb-4 w-full"
                    onDoubleClick={handleDoubleClick}
                >
                    <GoBoard
                        ref={svgRef}
                        boardState={displayBoard}
                        boardSize={boardSize}
                        viewRange={effectiveViewRange}
                        showCoordinates={showCoordinates}
                        showNumbers={showNumbers}
                        isMonochrome={isMonochrome}
                        onCellClick={handleInteraction}
                        onCellRightClick={handleRightClick}
                        onBoardWheel={handleWheel}
                        onCellMouseEnter={(x, y) => { hoveredCellRef.current = { x, y }; }}
                        onCellMouseLeave={() => { hoveredCellRef.current = null; }}
                        selectionStart={selectionStart}
                        selectionEnd={selectionEnd}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        hiddenMoves={isFigureMode ? hiddenMoves : []}
                        prioritizeLabel={isFigureMode}
                        specialLabels={specialLabels}
                        nextNumber={nextNumber}
                        activeColor={activeColor}
                        markers={history[currentMoveIndex]?.markers || []}
                    />

                    {/* Float Controls: Zoom / Reset */}
                    <div className="absolute top-2 right-2 flex gap-2">
                        {/* Zoom / Copy Buttons (only if selected) */}
                        {(selectionStart && selectionEnd) && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleExportSelection(); }}
                                    className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded shadow hover:bg-green-700 transition-all flex items-center gap-1"
                                    title="Copy Selection (Scissors)"
                                >
                                    <span>✂️</span> Copy
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleZoomToSelection(); }}
                                    className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded shadow hover:bg-blue-700 transition-all flex items-center gap-1"
                                    title="Crop to Selection"
                                >
                                    <span>🔍</span> Zoom
                                </button>
                            </>
                        )}

                        {/* Reset Zoom Button (only if cropped) */}
                        {isCropped && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setViewRange(null); }}
                                className="bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded shadow hover:bg-gray-800 transition-all flex items-center gap-1 opacity-80 hover:opacity-100"
                                title="Reset View (Esc)"
                            >
                                <span>↺</span> Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-white p-4 rounded shadow w-full space-y-4">

                    {/* Mode Switch (Compact Icons) */}
                    {/* Mode Switch (3 Icons: Black, White, Numbered) */}
                    <div className="flex justify-center space-x-4 border-b pb-2">
                        {/* Black Stone (Simple) */}
                        <button
                            title="Place Black Stone (Simple Mode)"
                            className={`p-2 rounded-full transition-all ${mode === 'SIMPLE' && activeColor === 'BLACK' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'}`}
                            onClick={() => {
                                setMode('SIMPLE');
                                setToolMode('STONE');
                                const newHistory = [...history];
                                newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], activeColor: 'BLACK' };
                                setHistory(newHistory);
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" className="text-black">
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                            </svg>
                        </button>

                        {/* White Stone (Simple) */}
                        <button
                            title="Place White Stone (Simple Mode)"
                            className={`p-2 rounded-full transition-all ${mode === 'SIMPLE' && activeColor === 'WHITE' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'}`}
                            onClick={() => {
                                setMode('SIMPLE');
                                setToolMode('STONE');
                                const newHistory = [...history];
                                newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], activeColor: 'WHITE' };
                                setHistory(newHistory);
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" className="text-gray-600">
                                {/* Use stroke or gray fill for white stone appearance on white bg? */
                              /* The previous icon used 'text-gray-600' which is dark gray. 
                                 Real white stone needs border. */ }
                                <circle cx="12" cy="12" r="9.5" fill="white" stroke="currentColor" strokeWidth="1" />
                            </svg>
                        </button>

                        {/* Numbered Stone */}
                        <button
                            title="Numbered Mode"
                            className={`p-2 rounded-full transition-all ${mode === 'NUMBERED' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'}`}
                            onClick={() => {
                                setMode('NUMBERED');
                                setToolMode('STONE');
                                // Force Black
                                const newHistory = [...history];
                                newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], activeColor: 'BLACK' };
                                setHistory(newHistory);
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" className="text-black">
                                {/* Dynamic color for icon? activeColor? 
                                User asked for "Number Stone Icon". Usually implies a generic numbered stone.
                                Let's use Black 1 for icon. */}
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                                <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">1</text>
                            </svg>
                        </button>
                        {/* Label Mode */}
                        <button
                            title="Label Mode (A, B, C...)"
                            onClick={() => setToolMode('LABEL')}
                            className={`ml-4 w-10 h-10 rounded font-bold border flex items-center justify-center transition-all ${toolMode === 'LABEL' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white border-gray-300 hover:bg-gray-100'}`}
                        >
                            A
                        </button>

                        {/* Symbol Mode Dropdown */}
                        <select
                            title="Symbol Mode"
                            value={toolMode === 'SYMBOL' ? selectedSymbol : ''}
                            onChange={(e) => {
                                const val = e.target.value as SymbolType;
                                setSelectedSymbol(val);
                                setToolMode('SYMBOL');
                            }}
                            className={`ml-2 h-10 rounded border px-1 text-sm bg-white cursor-pointer transition-all ${toolMode === 'SYMBOL' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
                        >
                            <option value="" disabled hidden>記号</option>
                            <option value="TRI">△</option>
                            <option value="CIR">◯</option>
                            <option value="SQR">□</option>
                            <option value="X">✕</option>
                        </select>
                    </div>
                </div>



                {/* Tools: Next, Coords, Size */}
                <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCoordinates(!showCoordinates)}
                            className={`text-xs px-2 py-1 rounded border ${showCoordinates ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'} whitespace-nowrap`}
                        >
                            Coords: {showCoordinates ? 'ON' : 'OFF'}
                        </button>

                        {/* Navigation Group (Moved from Top) */}
                        <div className="flex bg-gray-200 rounded p-1 gap-1">
                            <button onClick={stepFirst} disabled={currentMoveIndex === 0} title="First" className="px-2 font-bold hover:bg-white rounded disabled:opacity-30">|&lt;</button>
                            <button onClick={stepBack} disabled={currentMoveIndex === 0} title="Back (Backspace/Left)" className="px-2 font-bold hover:bg-white rounded disabled:opacity-30">&lt;</button>
                            <div className="text-xs flex items-center min-w-[30px] justify-center bg-white rounded px-2">{mode === 'NUMBERED' ? `${currentMoveIndex}` : '-'}</div>
                            <button onClick={stepForward} disabled={currentMoveIndex === history.length - 1} title="Next (Right)" className="px-2 font-bold hover:bg-white rounded disabled:opacity-30">&gt;</button>
                            <button onClick={stepLast} disabled={currentMoveIndex === history.length - 1} title="Last" className="px-2 font-bold hover:bg-white rounded disabled:opacity-30">&gt;|</button>
                        </div>
                    </div>


                    {/* Size Switcher */}
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                        <span className="text-xs text-gray-500">Size:</span>
                        {[19, 13, 9].map(s => (
                            <button
                                key={s}
                                onClick={() => setBoardSize(s)}
                                className={`text - xs px - 2 py - 0.5 rounded border ${boardSize === s ? 'bg-gray-700 text-white' : 'text-gray-600 border-gray-300 hover:bg-gray-200'} `}
                            >
                                {s}路
                            </button>
                        ))}
                    </div>

                    {mode === 'NUMBERED' && (
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                            <label className="text-xs">Start #:</label>
                            <input
                                type="number"
                                className="w-12 border rounded px-1 text-center"
                                value={nextNumber}
                                onChange={(e) => setNextNumberDirectly(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                        </div>
                    )}
                </div>

                {/* SGF & Export */}
                {/* Actions (Moved to Header) */}
                {/* Actions (Moved to Header) */}
                <div className="text-xs text-center text-gray-400 mt-2 space-y-1 pt-4 border-t border-gray-100">
                    <div>L: Place / R: Delete / Wheel: Nav</div>
                    <div>DblClick: Swap Color / Switch Tool</div>
                    <div>**Ctrl+V: Paste SGF**</div>
                </div>
            </div>

            {/* Actual Print Content (Moved Outside Main Div) */}
            <div className={isPrintJob ? "block w-full font-serif text-sm bg-white" : "hidden print:block w-full font-serif text-sm bg-white"}>
                {isPrintJob && (
                    <div className="fixed top-0 left-0 w-full bg-blue-100 p-2 text-center print:hidden z-50 flex justify-center gap-4 items-center shadow-md">
                        <span className="font-bold text-blue-900">Print Preview</span>
                        <button onClick={() => window.print()} className="px-4 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow transition-colors text-sm flex items-center gap-2">
                            <span>🖨️</span> Print Now
                        </button>
                        <button onClick={() => { setIsPrintJob(false); setShowPrintModal(true); }} className="px-4 py-1.5 bg-gray-500 text-white rounded font-bold hover:bg-gray-600 shadow transition-colors text-sm">
                            Close
                        </button>
                    </div>
                )}

                {/* Mode A: Current Board */}
                {(!printSettings || printSettings.pagingType === 'CURRENT') && (
                    <div className="flex flex-col items-center w-full h-screen pt-12 print:pt-0">
                        {/* Header Area */}
                        <div className="w-full mb-4 text-center">
                            <h1 className="text-2xl font-bold mb-1">{formatPrintString(printSettings?.title || '%GN%')}</h1>
                            <h2 className="text-lg text-gray-600">{formatPrintString(printSettings?.subTitle || '%DT%')}</h2>
                            <div className="text-right text-xs text-gray-500 mt-2 border-b border-gray-400">
                                {formatPrintString(printSettings?.header || '')}
                            </div>
                        </div>

                        {/* Board */}
                        <div className="w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] flex justify-center border-0 border-transparent mb-4">
                            <GoBoard
                                boardState={board}
                                boardSize={boardSize}
                                showCoordinates={printSettings?.showCoordinate ?? showCoordinates}
                                showNumbers={printSettings?.showMoveNumber ?? showNumbers}
                                markers={history[currentMoveIndex]?.markers || []}
                                onCellClick={() => { }}
                                onCellRightClick={() => { }}
                                onBoardWheel={() => { }}
                                onCellMouseEnter={() => { }}
                                onCellMouseLeave={() => { }}
                                onDragStart={() => { }}
                                onDragMove={() => { }}
                                selectionStart={null}
                                isMonochrome={isMonochrome}
                            />
                        </div>

                        {/* Footer */}
                        <div className="w-full text-center text-xs mt-auto pb-4">
                            {formatPrintString(printSettings?.footer || '')}
                        </div>
                    </div>
                )}

                {/* Mode B: Whole File */}
                {/* Mode B: Whole File */}
                {printSettings?.pagingType === 'WHOLE_FILE_FIGURE' && (
                    <div className="flex flex-col items-center w-full pt-12 print:pt-0">
                        {(() => {
                            const figures = generatePrintFigures(history, printSettings.movesPerFigure);
                            const perPage = printSettings.figuresPerPage || 4;
                            const chunks = [];
                            for (let i = 0; i < figures.length; i += perPage) {
                                chunks.push(figures.slice(i, i + perPage));
                            }

                            // Grid Class Logic
                            const getGridClass = (count: number) => {
                                if (count === 1) return "flex justify-center items-center h-full"; // Centered single
                                if (count === 2) return "grid grid-rows-2 gap-4 h-full items-center justify-items-center"; // 2 Vertical
                                // For 4, 6 etc:
                                return "grid grid-cols-2 gap-x-4 gap-y-2 h-full items-center justify-items-center align-content-center";
                            };

                            // Item Max Width Logic (to fit page)
                            // A4 is roughly 210mm x 297mm.
                            // 2 cols means max width ~45%.
                            const getItemStyle = (count: number) => {
                                if (count === 1) return { width: '80%', maxWidth: '800px' };
                                if (count === 2) return { width: '60%', maxWidth: '600px' };
                                return { width: '95%', maxWidth: '400px' }; // Tight fit for 4-up
                            };

                            return chunks.map((chunk, pageIdx) => (
                                <div key={pageIdx} className="page-break w-full min-h-screen p-4 box-border flex flex-col justify-center">
                                    {/* Page Header (Optional, maybe specific to page?) */}

                                    <div className={`${getGridClass(perPage)} w-full flex-grow`}>
                                        {chunk.map((fig, i) => (
                                            <div key={i} className="flex flex-col items-center w-full" style={getItemStyle(perPage)}>
                                                {/* Header */}
                                                <div className="w-full mb-1 text-center">
                                                    <h1 className="text-lg font-bold truncate">{formatPrintString(printSettings.title, (pageIdx * perPage) + i + 1)}</h1>
                                                    {/* <h2 className="text-xs text-gray-600 truncate">{formatPrintString(printSettings.subTitle, (pageIdx * perPage) + i + 1)}</h2> */}
                                                    <div className="text-right text-[10px] text-gray-500 border-b border-gray-400">
                                                        {formatPrintString(printSettings.header, (pageIdx * perPage) + i + 1)}
                                                    </div>
                                                </div>

                                                {/* Figure Info */}
                                                <div className="w-full text-center font-bold text-xs mb-1">
                                                    Figure {(pageIdx * perPage) + i + 1} ({fig.moveRangeStart}-{fig.moveRangeEnd})
                                                </div>

                                                {/* Board */}
                                                <div className="w-full aspect-square relative">
                                                    <GoBoard
                                                        boardState={fig.board}
                                                        boardSize={boardSize}
                                                        showCoordinates={printSettings.showCoordinate}
                                                        onCellClick={() => { }}
                                                        onCellRightClick={() => { }}
                                                        onBoardWheel={() => { }}
                                                        onCellMouseEnter={() => { }}
                                                        onCellMouseLeave={() => { }}
                                                        onDragStart={() => { }}
                                                        onDragMove={() => { }}
                                                        selectionStart={null}
                                                        isMonochrome={isMonochrome}
                                                    />
                                                </div>

                                                {/* Footer */}
                                                <div className="w-full text-center text-[10px] mt-1">
                                                    {formatPrintString(printSettings.footer, (pageIdx * perPage) + i + 1)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>
        </>

    );
}

export default App
