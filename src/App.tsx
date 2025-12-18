import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import GoBoard, { ViewRange, BoardState, StoneColor } from './components/GoBoard'
import { exportToPng } from './utils/exportUtils'
import { checkCaptures } from './utils/gameLogic'
import { parseSGF, generateSGF } from './utils/sgfUtils'

type PlacementMode = 'SIMPLE' | 'NUMBERED';

interface HistoryState {
    board: BoardState;
    nextNumber: number;
    activeColor: StoneColor;
    boardSize: number; // Size is part of history state? Yes, if we switch size, we want to undo it.
}

function App() {
    // Initial Size 19
    const INITIAL_SIZE = 19;

    const [history, setHistory] = useState<HistoryState[]>([
        {
            board: Array(INITIAL_SIZE).fill(null).map(() => Array(INITIAL_SIZE).fill(null)),
            nextNumber: 1,
            activeColor: 'BLACK',
            boardSize: INITIAL_SIZE
        }
    ]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

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
    const effectiveViewRange: ViewRange = viewRange || { minX: 1, maxX: boardSize, minY: 1, maxY: boardSize };
    const isCropped = !!viewRange;

    const [showCoordinates, setShowCoordinates] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [mode, setMode] = useState<PlacementMode>('SIMPLE');
    const [isMonochrome, setIsMonochrome] = useState(false);

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

    const commitState = (newBoard: BoardState, newNextNumber: number, newActiveColor: StoneColor, newSize: number) => {
        const newHistory = history.slice(0, currentMoveIndex + 1);
        newHistory.push({
            board: newBoard,
            nextNumber: newNextNumber,
            activeColor: newActiveColor,
            boardSize: newSize
        });
        setHistory(newHistory);
        setCurrentMoveIndex(newHistory.length - 1);
    };

    // Change Board Size
    const setBoardSize = (size: number) => {
        // Create clean board of new size
        const newBoard = Array(size).fill(null).map(() => Array(size).fill(null));
        // Reset number to 1? Or keep? Usually fresh board = fresh start.
        commitState(newBoard, 1, 'BLACK', size);
    };

    const deleteStone = (x: number, y: number) => {
        const currentStone = board[y - 1][x - 1];
        if (currentStone) {
            const newBoard = board.map(row => [...row]);
            newBoard[y - 1][x - 1] = null;
            commitState(newBoard, nextNumber, activeColor, boardSize);
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

        const currentStone = board[y - 1][x - 1];
        const newBoard = board.map(row => [...row]);

        if (mode === 'SIMPLE') {
            // Simple mode: Always Place/Replace
            newBoard[y - 1][x - 1] = { color: activeColor };
            commitState(newBoard, nextNumber, activeColor, boardSize);

        } else {
            // Numbered
            if (currentStone) return;

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

    const handleCellClick = (x: number, y: number) => handleInteraction(x, y);
    const handleCellRightClick = (x: number, y: number) => deleteStone(x, y);

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

        // Priority 2: Simple Mode Tool Swap & Stone Conversion
        if (mode === 'SIMPLE') {
            // 1. Swap Tool Color
            const newColor = activeColor === 'BLACK' ? 'WHITE' : 'BLACK';

            // 2. Check for stone to swap at cursor
            // If user double clicks a stone, they often want THAT stone to change color
            // AND the tool to switch.
            let newBoard = board;
            let boardChanged = false;

            if (hoveredCellRef.current) {
                const { x, y } = hoveredCellRef.current;
                const stone = board[y - 1][x - 1];
                if (stone) {
                    newBoard = board.map(row => [...row]);
                    newBoard[y - 1][x - 1] = { ...stone, color: newColor };
                    boardChanged = true;
                }
            }

            if (boardChanged) {
                // Determine next number logic? In simple mode, number isn't important, but we pass it.
                commitState(newBoard, nextNumber, newColor, boardSize);
            } else {
                // Just tool swap
                const newHistory = [...history];
                newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], activeColor: newColor };
                setHistory(newHistory);
            }
            return;
        }

        // Priority 3: Stone Swap (Numbered Mode)
        if (hoveredCellRef.current) {
            const { x, y } = hoveredCellRef.current;
            const stone = board[y - 1][x - 1];
            if (stone) {
                const newBoard = board.map(row => [...row]);
                newBoard[y - 1][x - 1] = { ...stone, color: stone.color === 'BLACK' ? 'WHITE' : 'BLACK' };
                commitState(newBoard, nextNumber, activeColor, boardSize);
                return;
            }
        }

        // Priority 4: Background -> Swap Tool Color (Fallback)
        const newColor = activeColor === 'BLACK' ? 'WHITE' : 'BLACK';
        const newHistory = [...history];
        newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], activeColor: newColor };
        setHistory(newHistory);
    };

    const handleIndicatorDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newColor = activeColor === 'BLACK' ? 'WHITE' : 'BLACK';
        const newHistory = [...history];
        newHistory[currentMoveIndex] = { ...newHistory[currentMoveIndex], activeColor: newColor };
        setHistory(newHistory);
    };

    const handleUndo = () => { if (currentMoveIndex > 0) setCurrentMoveIndex(i => i - 1); };
    const handleRedo = () => { if (currentMoveIndex < history.length - 1) setCurrentMoveIndex(i => i + 1); };
    const handleWheel = (delta: number) => {
        if (Math.abs(delta) < 10) return;
        if (delta > 0) handleRedo(); else handleUndo();
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
                const newBoard = board.map(row => [...row]);
                const stone = newBoard[moveSource.y - 1][moveSource.x - 1];
                if (stone) {
                    newBoard[moveSource.y - 1][moveSource.x - 1] = null;
                    newBoard[targetY - 1][targetX - 1] = stone;
                    const captured = checkCaptures(newBoard, targetX - 1, targetY - 1, stone.color);
                    captured.forEach(c => newBoard[c.y][c.x] = null);
                    commitState(newBoard, nextNumber, activeColor, boardSize);
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

    const performExport = async (bounds: { minX: number, maxX: number, minY: number, maxY: number }) => {
        if (!svgRef.current) return;

        const CELL_SIZE = 40;
        const MARGIN = 40;
        const PADDING = 20; // 20px is exact half cell (tight crop for 19px radius stones)

        const { minX, maxX, minY, maxY } = bounds;

        const x = (minX - 1) * CELL_SIZE + (MARGIN - PADDING);
        const y = (minY - 1) * CELL_SIZE + (MARGIN - PADDING);
        const width = (maxX - minX) * CELL_SIZE + PADDING * 2;
        const height = (maxY - minY) * CELL_SIZE + PADDING * 2;

        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;

        // Remove selection overlay from clone
        // Robust Removal Strategy:
        // 1. By ID (primary)
        const overlayById = clone.getElementById('selection-overlay-rect');
        if (overlayById) overlayById.remove();

        // 2. By Class (fallback)
        const overlaysByClass = clone.querySelectorAll('.selection-overlay');
        overlaysByClass.forEach(o => o.remove());

        // 3. By Fill (super fallback)
        const rects = clone.querySelectorAll('rect');
        rects.forEach(r => {
            if (r.getAttribute('fill') === 'rgba(0, 0, 255, 0.2)') {
                r.remove();
            }
        });
        clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        clone.setAttribute('width', `${width}`);
        clone.setAttribute('height', `${height}`);

        await exportToPng(clone, 3, isMonochrome ? '#FFFFFF' : '#DCB35C');
    };

    const handleExport = useCallback(async () => {
        // Auto-crop to all stones
        const { hasStones, minX, maxX, minY, maxY } = getBounds();

        if (hasStones) {
            await performExport({ minX, maxX, minY, maxY });
        } else {
            // Empty board? Full export
            if (svgRef.current) await exportToPng(svgRef.current, 3, isMonochrome ? '#FFFFFF' : '#DCB35C');
        }
    }, [getBounds, isMonochrome]);

    const handleExportSelection = useCallback(async () => {
        if (!selectionStart || !selectionEnd) return;

        const x1 = Math.min(selectionStart.x, selectionEnd.x);
        const x2 = Math.max(selectionStart.x, selectionEnd.x);
        const y1 = Math.min(selectionStart.y, selectionEnd.y);
        const y2 = Math.max(selectionStart.y, selectionEnd.y);

        // Manual Selection: Use exact bounds (Revert v25 behavior)
        await performExport({ minX: x1, maxX: x2, minY: y1, maxY: y2 });

        // Reset Selection
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        setDragMode('SELECTING');
        setMoveSource(null);
    }, [selectionStart, selectionEnd, getBounds]);

    // SGF Logic
    const handleSaveSGF = async () => {
        const sgf = generateSGF(board, boardSize);

        try {
            // @ts-ignore - File System Access API
            if (window.showSaveFilePicker) {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: `gorw_export_${Date.now()}.sgf`,
                    types: [{
                        description: 'Smart Game Format',
                        accept: { 'application/x-go-sgf': ['.sgf'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(sgf);
                await writable.close();
                return;
            }
        } catch (err) {
            console.warn('Save File Picker failed or canceled', err);
            // Fallback to auto-download if canceled or error?
            // Usually if user canceled, we do nothing.
            // If API not supported, we fall back.
            if ((err as Error).name === 'AbortError') return;
        }

        // Fallback
        const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gorw_export_${Date.now()}.sgf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadSGF = (content: string) => {
        const { board: startBoard, moves, size: newSize } = parseSGF(content);

        // Initialize History with Start Board
        const newHistory: HistoryState[] = [{
            board: JSON.parse(JSON.stringify(startBoard)),
            nextNumber: 1,
            activeColor: 'BLACK',
            boardSize: newSize
        }];

        // Simulate Moves to build History
        let currentBoard = JSON.parse(JSON.stringify(startBoard));
        let currentNumber = 1;
        let currentColor: StoneColor = 'BLACK';

        for (const move of moves) {
            // Clone board for next state
            const nextBoard = JSON.parse(JSON.stringify(currentBoard));

            // Place Stone (1-based from parser)
            if (move.x >= 1 && move.x <= newSize && move.y >= 1 && move.y <= newSize) {
                nextBoard[move.y - 1][move.x - 1] = {
                    color: move.color,
                    number: currentNumber
                };

                // Check Captures
                const captures = checkCaptures(nextBoard, move.x - 1, move.y - 1, move.color);
                captures.forEach(c => {
                    nextBoard[c.y][c.x] = null;
                });
            }

            // Prepare state for history
            currentNumber++;
            currentColor = move.color === 'BLACK' ? 'WHITE' : 'BLACK'; // Toggle for next
            currentBoard = nextBoard;

            newHistory.push({
                board: nextBoard,
                nextNumber: currentNumber,
                activeColor: currentColor,
                boardSize: newSize
            });
        }

        // Update State
        setHistory(newHistory);
        setCurrentMoveIndex(0); // Start at Initial Setup
    };

    const handleOpenSGF = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            if (evt.target?.result) {
                loadSGF(evt.target.result as string);
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    // Paste Listener
    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text');
            // Simple check if it looks like SGF
            if (text && (text.includes('(;') || text.includes('GM['))) {
                e.preventDefault();
                loadSGF(text);
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [nextNumber, activeColor]); // commitState uses stack, but nextNumber/activeColor need to be preserved?
    // Actually commitState uses 'history' from closure.
    // We should depend on history to handle next state correctly, OR fix commitState.
    // Since we use functional updates in simple hooks, but commitState depends on snapshot.

    // Actually, wait. loadSGF calls commitState.
    // commitState uses `history` variable.
    // effect has no dependency on `history`?
    // It will trap stale `history`.
    // Fix: use a Ref for history access or depend on history.
    // If we depend on history, we rebind paste listener every move. That's fine.



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

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const deleted = handleDeleteParams();
                if (!deleted) {
                    handleUndo();
                }
                return;
            }

            // Shortcuts
            if (isCtrl) {
                switch (e.key.toLowerCase()) {
                    case 'n': // New Diagram
                        e.preventDefault();
                        e.stopPropagation();
                        // @ts-ignore
                        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                        clearBoard();
                        break;
                    case 'o': // Open SGF
                        e.preventDefault();
                        fileInputRef.current?.click();
                        break;
                    case 's': // Save SGF
                        e.preventDefault();
                        handleSaveSGF();
                        break;
                    case 'f': // Copy Image
                        e.preventDefault();
                        if (selectionStart && selectionEnd) {
                            handleExportSelection();
                        } else {
                            handleExport();
                        }
                        break;
                    case 'b': // Copy SGF
                        e.preventDefault();
                        const sgf = generateSGF(board, boardSize);
                        try {
                            await navigator.clipboard.writeText(sgf);
                            // Optional: Toast notification could be nice here
                            console.log('SGF Copied to clipboard');
                        } catch (err) {
                            console.error('Failed to copy SGF', err);
                        }
                        break;
                    // Ctrl+V is handled by 'paste' event listener
                }
            }
        };
        // Use capture phase for better override chance
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [
        board, boardSize, history, currentMoveIndex,
        showHelp, isSelecting, selectionStart, selectionEnd, isCropped,
        handleExportSelection, handleExport, handleSaveSGF, clearBoard, handleDeleteParams
    ]);

    // Generate hidden move references and special labels
    // Logic: Identify board locations with multiple moves (collisions).
    // Assign letters A, B, C... to those locations.
    // Footer lists all moves at those locations as "MoveNum [ Label ]".
    const { hiddenMoves, specialLabels } = useMemo(() => {
        if (currentMoveIndex === 0) return { hiddenMoves: [], specialLabels: [] };

        const moveHistory = new Map<string, { number: number, color: StoneColor }[]>(); // "x,y" -> list of moves

        // 1. Scan History to populate moveHistory
        for (let i = 1; i <= currentMoveIndex; i++) {
            const currBoard = history[i].board;
            const size = history[i].boardSize;
            const moveNum = history[i - 1].nextNumber; // The number of the stone just placed

            // Find where this move was placed
            // Optimization: We could store move coords in history, but we don't.
            // Brute force scan is O(N * BoardSize^2). N ~ 200, BS=361. 72000 ops. Fast enough.
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const stone = currBoard[y][x];
                    if (stone && stone.number === moveNum) {
                        const key = `${x},${y}`;
                        if (!moveHistory.has(key)) moveHistory.set(key, []);
                        moveHistory.get(key)?.push({ number: moveNum, color: stone.color });
                        // Found it, but strictly we should break? 
                        // Yes, a move only places one stone.
                        // Wait, what if it was capture? The loop is detecting presence of stone #i.
                        // Correct.
                        // We assumed moves are unique #.
                    }
                }
            }
        }

        // 2. Identify Collisions and Assign Labels
        const labels: { x: number, y: number, label: string }[] = [];
        const footer: { left: { text: string, color: StoneColor }, right: { text: string, color: StoneColor } }[] = [];

        let labelIndex = 0;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        // Detect "Hidden" moves (not on current board) AND Collisions
        // User request: "If placing on same point after clearing... assign alphabet".
        // This implies any point with >1 move in history is a candidate.
        // OR any point where a move is currently present BUT overwrite happened?

        // Let's look for points with > 1 entry in moveHistory.
        // AND points where the 'current' stone is not the ONLY stone ever played there.

        // Also check if moves are missing from current board (standard hidden moves).
        const currentBoard = history[currentMoveIndex].board;

        // We iterate all locations that had stones
        moveHistory.forEach((moves, key) => {
            const [x, y] = key.split(',').map(Number);
            const currentStone = currentBoard[y][x];

            // Condition for Special Labeling:
            // 1. More than 1 move played here (Collision)
            // 2. OR Current stone is NOT the one corresponding to the latest move? (Unlikely)
            // 3. User specifically mentioned "after clearing". collision implies clearing.

            if (moves.length > 1) {
                // Collision! Assign Label.
                // If we run out of letters, maybe change logic? (AA..?)
                // For now single letter.
                const label = alphabet[labelIndex % alphabet.length];
                labelIndex++;

                labels.push({ x: x + 1, y: y + 1, label }); // 1-based for props

                // Add all moves at this spot to footer
                moves.forEach(m => {
                    footer.push({
                        left: { text: m.number.toString(), color: m.color },
                        right: { text: label, color: m.color } // Use same color for label stone? User image has specific styles. 
                        // Image '7 [ A ]': 7 (Black) [ A (Black) ].
                        // Usually the label stone takes the color of the move it represents?
                        // YES.
                    });
                });
            } else {
                // Single move case.
                // Check if it's hidden (captured).
                const m = moves[0];
                const isVisible = currentStone && currentStone.number === m.number;

                if (!isVisible) {
                    // It's hidden but NOT a collision (just captured and empty now).
                    // Standard notation: "15 takes". Or ignore?
                    // Previous logic: "1 at 9" (if 9 is there).
                    // If empty, we can't say "at ...".
                    // If another stone is there (but that would be collision, covered above).
                    // So here, stone is gone and spot is empty.
                    // We don't list regular captures in footer usually unless requested.
                    // User focus is on overwrites.
                }
            }
        });

        // Sort footer by move number
        footer.sort((a, b) => parseInt(a.left.text) - parseInt(b.left.text));

        return { hiddenMoves: footer, specialLabels: labels };
    }, [history, currentMoveIndex]);

    return (
        <div className="p-4 bg-gray-100 min-h-screen flex flex-col items-center font-sans text-sm pb-20 select-none">
            <div className="flex justify-between w-full items-center mb-2">
                <div className="flex items-baseline gap-2">
                    <h1 className="text-xl font-bold text-gray-800">GORewrite</h1>
                    <span className="text-xs text-gray-400 font-normal">v31</span>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Hidden Input for Open SGF */}
                    <input
                        type="file"
                        accept=".sgf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleOpenSGF}
                        style={{ display: 'none' }}
                    />
                    {/* Compact Action Buttons */}
                    <button onClick={clearBoard} title="New / Clear (Ctrl+N)" className="w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center font-bold transition-colors">
                        🗑️
                    </button>
                    <button onClick={handleSaveSGF} title="Save SGF (Ctrl+S)" className="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center font-bold transition-colors">
                        💾
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} title="Open SGF (Ctrl+O)" className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center font-bold transition-colors">
                        📂
                    </button>
                    <button onClick={() => { if (selectionStart && selectionEnd) handleExportSelection(); else handleExport(); }}
                        title="Copy Image (Ctrl+F)" className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center font-bold transition-colors">
                        📷
                    </button>

                    <div className="w-px h-6 bg-gray-300 mx-1"></div>

                    <button onClick={handleUndo} disabled={currentMoveIndex === 0}
                        className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 font-bold">&lt;</button>
                    <div className="text-xs text-gray-500 flex items-center min-w-[20px] justify-center">{mode === 'NUMBERED' ? `${currentMoveIndex}` : ''}</div>
                    <button onClick={handleRedo} disabled={currentMoveIndex === history.length - 1}
                        className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 font-bold">&gt;</button>

                    <div className="w-px h-6 bg-gray-300 mx-1"></div>

                    {/* Open in New Tab */}
                    <button
                        onClick={() => window.open('index.html', '_blank')}
                        className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center font-bold text-xs"
                        title="Open in New Tab (Maximize)"
                    >
                        ↗
                    </button>

                    {/* Help Button */}
                    <button
                        onClick={() => setShowHelp(true)}
                        className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center font-bold text-xs"
                        title="Help"
                    >
                        ?
                    </button>
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

            {/* Toolbar above board regarding visual style */}
            <div className="w-full flex justify-end mb-2 gap-2">
                <button
                    onClick={() => setIsMonochrome(!isMonochrome)}
                    className={`text - xs px - 2 py - 1 rounded border shadow - sm transition - colors ${isMonochrome
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                        }`}
                    title="Toggle Monochrome (Printer Friendly)"
                >
                    {isMonochrome ? 'B/W Mode' : 'Color Mode'}
                </button>
            </div>

            {/* Board Container */}
            <div
                className="bg-white shadow-lg p-2 rounded mb-4 w-full"
                onDoubleClick={handleDoubleClick}
            >
                <GoBoard
                    ref={svgRef}
                    boardState={board}
                    boardSize={boardSize}
                    viewRange={effectiveViewRange}
                    showCoordinates={showCoordinates}
                    isMonochrome={isMonochrome}
                    onCellClick={handleCellClick}
                    onCellRightClick={handleCellRightClick}
                    onBoardWheel={handleWheel}
                    onCellMouseEnter={(x, y) => { hoveredCellRef.current = { x, y }; }}
                    onCellMouseLeave={() => { hoveredCellRef.current = null; }}
                    selectionStart={selectionStart}
                    selectionEnd={selectionEnd}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    hiddenMoves={hiddenMoves}
                    specialLabels={specialLabels}
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
                <div className="flex justify-center space-x-4 border-b pb-2">
                    <button
                        title="Simple Mode (No Numbers)"
                        className={`p - 2 rounded - full transition - all ${mode === 'SIMPLE' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'} `}
                        onClick={() => setMode('SIMPLE')}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" className={mode === 'SIMPLE' ? 'text-blue-700' : 'text-gray-600'}>
                            <circle cx="12" cy="12" r="10" fill="currentColor" />
                        </svg>
                    </button>
                    <button
                        title="Numbered Mode"
                        className={`p - 2 rounded - full transition - all ${mode === 'NUMBERED' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'} `}
                        onClick={() => setMode('NUMBERED')}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" className={mode === 'NUMBERED' ? 'text-blue-700' : 'text-gray-600'}>
                            <circle cx="12" cy="12" r="10" fill="currentColor" />
                            <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">1</text>
                        </svg>
                    </button>
                </div>

                {/* Tools: Next, Coords, Size */}
                <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600">Next:</span>
                            <div
                                onClick={handleIndicatorDoubleClick}
                                className={`w - 6 h - 6 rounded - full border border - gray - 300 flex items - center justify - center text - xs font - bold cursor - pointer hover: ring - 2 hover: ring - blue - 300 select - none
                    ${activeColor === 'BLACK' ? 'bg-black text-white' : 'bg-white text-black'} `}>
                                {mode === 'NUMBERED' ? nextNumber : ''}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowCoordinates(!showCoordinates)}
                            className={`text - xs px - 2 py - 1 rounded border ${showCoordinates ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'} `}
                        >
                            Coords: {showCoordinates ? 'ON' : 'OFF'}
                        </button>
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
                <div className="text-xs text-center text-gray-400 mt-2 space-y-1 pt-4 border-t border-gray-100">
                    <div>L: Place / R: Delete / Wheel: Nav</div>
                    <div>DblClick: Swap Color / Switch Tool</div>
                    <div>**Ctrl+V: Paste SGF**</div>
                </div>

                <div className="text-xs text-center text-gray-400 mt-2 space-y-1">
                    <div>L: Place / R: Delete / Wheel: Nav</div>
                    <div>DblClick: Swap Color / Switch Tool</div>
                    <div>**Ctrl+V: Paste SGF**</div>
                </div>
            </div>
        </div>
    )
}

export default App
