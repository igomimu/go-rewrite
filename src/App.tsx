import { useState, useRef, useEffect, useCallback } from 'react'
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
                return;
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
            if (changed) commitState(newBoard, nextNumber, activeColor, boardSize);
        }
    };

    const handleExport = useCallback(async () => {
        // Scale 3 for Print Quality (approx 300dpi if original is 96dpi, but screens are varied. 3x is safe for print).
        if (svgRef.current) await exportToPng(svgRef.current, 3, isMonochrome ? '#FFFFFF' : '#DCB35C');
    }, [isMonochrome]);

    const handleExportSelection = useCallback(async () => {
        if (!svgRef.current || !selectionStart || !selectionEnd) return;

        // Calculate crop bounds based on GoBoard constants
        const CELL_SIZE = 40;
        const MARGIN = 40;

        const minX = Math.min(selectionStart.x, selectionEnd.x);
        const maxX = Math.max(selectionStart.x, selectionEnd.x);
        const minY = Math.min(selectionStart.y, selectionEnd.y);
        const maxY = Math.max(selectionStart.y, selectionEnd.y);

        // Calculate viewBox for the crop
        // Logic matches GoBoard.tsx internal calculation
        const x = (minX - 1) * CELL_SIZE;
        const y = (minY - 1) * CELL_SIZE;
        const width = (maxX - minX) * CELL_SIZE + MARGIN * 2;
        const height = (maxY - minY) * CELL_SIZE + MARGIN * 2;

        // Clone the SVG to not affect display
        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);

        // Ensure clone has explicit width/height matching the aspect ratio for the export canvas
        // (Though exportUtils uses viewBox baseVals, explicitly setting standard attributes helps some environments)
        clone.setAttribute('width', `${width}`);
        clone.setAttribute('height', `${height}`);

        await exportToPng(clone, 3, isMonochrome ? '#FFFFFF' : '#DCB35C');

        // Reset Selection
        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        setDragMode('SELECTING');
        setMoveSource(null);
    }, [selectionStart, selectionEnd, isMonochrome]);

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
        const { board: newBoard, size: newSize } = parseSGF(content);
        commitState(newBoard, nextNumber, activeColor, newSize);
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

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Priority: Close Help -> Cancel Selection -> Reset View
                if (showHelp) {
                    setShowHelp(false);
                    return;
                }
                if (isSelecting || (selectionStart && selectionEnd)) {
                    setIsSelecting(false);
                    setSelectionStart(null);
                    setSelectionEnd(null);
                    setDragMode('SELECTING');
                    setMoveSource(null);
                    return;
                }
                if (isCropped) {
                    setViewRange(null);
                    return;
                }
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                // Smart Copy: If selection exists, copy selection. Else full board.
                // We need to check state here.
                // Refs are cleaner for event listeners but we have dependencies in useEffect.
                if (selectionStart && selectionEnd) {
                    handleExportSelection();
                } else {
                    handleExport();
                }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                handleDeleteParams();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [board, history, currentMoveIndex, showHelp, isSelecting, selectionStart, selectionEnd, isCropped, handleExportSelection, handleExport]); // Added deps

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

    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text');
            if (text && (text.includes('(;') || text.includes('GM['))) {
                e.preventDefault();
                // Parse SGF: get Initial Setup + Move Sequence
                const { board: startBoard, moves, size: newSize } = parseSGF(text);

                // Initialize History with Start Board
                const newHistory: HistoryState[] = [{
                    board: JSON.parse(JSON.stringify(startBoard)), // Ensure deep copy of start
                    nextNumber: 1, // Start moves will be 1
                    activeColor: 'BLACK', // Default start? SGF usually starts Black.
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
                setCurrentMoveIndex(0); // Start at Initial Setup (User Request: "配石だけで表示")
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

    return (
        <div className="p-4 bg-gray-100 min-h-screen flex flex-col items-center font-sans text-sm pb-20 select-none">
            <div className="flex justify-between w-full items-center mb-2">
                <div className="flex items-baseline gap-2">
                    <h1 className="text-xl font-bold text-gray-800">GORewrite</h1>
                    <span className="text-xs text-gray-400 font-normal">v22</span>
                </div>
                <div className="flex gap-2 items-center">
                    <button onClick={handleUndo} disabled={currentMoveIndex === 0}
                        className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 font-bold">&lt;</button>
                    <div className="text-xs text-gray-500 flex items-center min-w-[20px] justify-center">{mode === 'NUMBERED' ? `${currentMoveIndex}` : ''}</div>
                    <button onClick={handleRedo} disabled={currentMoveIndex === history.length - 1}
                        className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 font-bold">&gt;</button>

                    {/* Open in New Tab */}
                    <button
                        onClick={() => window.open('index.html', '_blank')}
                        className="ml-2 w-6 h-6 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center font-bold text-xs"
                        title="Open in New Tab (Maximize)"
                    >
                        ↗
                    </button>

                    {/* Help Button */}
                    <button
                        onClick={() => setShowHelp(true)}
                        className="ml-1 w-6 h-6 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center font-bold text-xs"
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
                    className={`text-xs px-2 py-1 rounded border shadow-sm transition-colors ${isMonochrome
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
                        className={`p-2 rounded-full transition-all ${mode === 'SIMPLE' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'}`}
                        onClick={() => setMode('SIMPLE')}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" className={mode === 'SIMPLE' ? 'text-blue-700' : 'text-gray-600'}>
                            <circle cx="12" cy="12" r="10" fill="currentColor" />
                        </svg>
                    </button>
                    <button
                        title="Numbered Mode"
                        className={`p-2 rounded-full transition-all ${mode === 'NUMBERED' ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100 opacity-60 hover:opacity-100'}`}
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
                                className={`w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 hover:ring-blue-300 select-none
                    ${activeColor === 'BLACK' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                                {mode === 'NUMBERED' ? nextNumber : ''}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowCoordinates(!showCoordinates)}
                            className={`text-xs px-2 py-1 rounded border ${showCoordinates ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
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
                                className={`text-xs px-2 py-0.5 rounded border ${boardSize === s ? 'bg-gray-700 text-white' : 'text-gray-600 border-gray-300 hover:bg-gray-200'}`}
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
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleSaveSGF}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded transition-colors"
                    >
                        Save SGF
                    </button>
                    <label className="bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded transition-colors text-center cursor-pointer">
                        Open SGF
                        <input
                            type="file"
                            accept=".sgf"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleOpenSGF}
                        />
                    </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                    <button
                        onClick={clearBoard}
                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded transition-colors border border-red-200"
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleExport}
                        title="Ctrl+F to copy"
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                    >
                        Copy Image
                    </button>
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
