import { forwardRef, useMemo } from 'react';

// Removed ViewRange reference - we use full board always now?
// Actually App.tsx still uses viewRange state, but we are "abolishing X-Range Y-Range UI".
// But keeping viewRange logic inside GoBoard allows for selection trimming if we ever need it.
// For now, let's keep ViewRange interface but default it to full board if not passed?
// Or just derive it from Size.

export interface ViewRange {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export type StoneColor = 'BLACK' | 'WHITE';

export interface Stone {
    color: StoneColor;
    number?: number;
}

export type BoardState = (Stone | null)[][];

export interface GoBoardProps {
    boardState: BoardState;
    boardSize: number; // 19, 13, 9

    viewRange?: ViewRange; // Optional now?
    showCoordinates?: boolean;
    isMonochrome?: boolean;

    // Interactions
    onCellClick: (x: number, y: number) => void;
    onCellRightClick: (x: number, y: number) => void;
    onBoardWheel: (delta: number) => void;
    onCellMouseEnter: (x: number, y: number) => void;
    onCellMouseLeave: () => void;

    // Drag Selection / Move
    selectionStart: { x: number, y: number } | null;
    selectionEnd?: { x: number, y: number } | null;

    onDragStart: (x: number, y: number) => void;
    onDragMove: (x: number, y: number) => void;
    onDragEnd?: () => void;
    hiddenMoves?: {
        left: { text: string, color: StoneColor };
        right: { text: string, color?: StoneColor, isLabel?: boolean };
    }[];
    specialLabels?: { x: number, y: number, label: string }[];
}

const GoBoard = forwardRef<SVGSVGElement, GoBoardProps>(({
    boardState,
    boardSize,
    viewRange,
    showCoordinates = false,
    isMonochrome = false,
    onCellClick,
    onCellRightClick,
    onBoardWheel,
    onCellMouseEnter,
    onCellMouseLeave,
    selectionStart,
    selectionEnd,
    onDragStart,
    onDragMove,
    onDragEnd,
    hiddenMoves = [],
    specialLabels = []
}, ref) => {
    const CELL_SIZE = 40;
    const MARGIN = 40;

    // Use passed viewRange or default to full board
    const effectiveViewRange = viewRange || {
        minX: 1, maxX: boardSize, minY: 1, maxY: boardSize
    };

    // Visual Tuning Constants (Updated v31: Dynamic + Star Fix)
    const LINE_WIDTH = 1;
    const BORDER_WIDTH = 2;
    const STONE_RADIUS = CELL_SIZE * 0.46;
    const FONT_SIZE = CELL_SIZE * 0.65;
    const COORD_FONT_SIZE = 14;
    const STAR_POINT_RADIUS = 3.5;

    const getStarPoints = (size: number) => {
        const s = Number(size);
        if (s === 19) {
            return [
                [4, 4], [10, 4], [16, 4],
                [4, 10], [10, 10], [16, 10],
                [4, 16], [10, 16], [16, 16]
            ];
        } else if (s === 13) {
            return [
                [4, 4], [7, 4], [10, 4],
                [4, 7], [7, 7], [10, 7],
                [4, 10], [7, 10], [10, 10]
            ];
        } else if (s === 9) {
            return [
                [3, 3], [7, 3],
                [5, 5],
                [3, 7], [7, 7]
            ];
        }
        return [];
    };

    const starPoints = getStarPoints(boardSize);

    const viewBox = useMemo(() => {
        const { minX, maxX, minY, maxY } = effectiveViewRange;

        // Ensure range is within bounds (if switching sizes happened)
        const validMinX = Math.max(1, minX);
        const validMaxX = Math.min(boardSize, maxX);
        const validMinY = Math.max(1, minY);
        const validMaxY = Math.min(boardSize, maxY);

        // Fallback if fully out of bounds
        if (validMinX > validMaxX || validMinY > validMaxY) {
            // Reset to full
            const w = boardSize * CELL_SIZE;
            const h = boardSize * CELL_SIZE;
            return `${MARGIN - CELL_SIZE / 2} ${MARGIN - CELL_SIZE / 2} ${w} ${h}`;
        }

        const x = MARGIN + (validMinX - 1) * CELL_SIZE - CELL_SIZE / 2;
        const y = MARGIN + (validMinY - 1) * CELL_SIZE - CELL_SIZE / 2;
        const width = (validMaxX - validMinX + 1) * CELL_SIZE;
        let height = (validMaxY - validMinY + 1) * CELL_SIZE;

        let finalX = x;
        let finalY = y;
        let finalW = width;
        let finalH = height;

        if (showCoordinates) {
            finalX -= 25;
            finalY -= 25;
            finalW += 50;
            finalH += 50;
        }

        // Add footer space for hidden moves
        if (hiddenMoves.length > 0) {
            // Approx 20px height
            finalH += 30;
        }

        return `${finalX} ${finalY} ${finalW} ${finalH}`;
    }, [viewRange, showCoordinates, boardSize, hiddenMoves]);

    // Generate lines
    const lines = [];
    for (let i = 1; i <= boardSize; i++) {
        const pos = MARGIN + (i - 1) * CELL_SIZE;
        const start = MARGIN;
        const end = MARGIN + (boardSize - 1) * CELL_SIZE;

        const isBorder = i === 1 || i === boardSize;
        const width = isBorder ? BORDER_WIDTH : LINE_WIDTH;

        lines.push(
            <line
                key={`v-${i}`}
                x1={pos} y1={start}
                x2={pos} y2={end}
                stroke="black"
                strokeWidth={width}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="square"
                className="grid-line"
                shapeRendering="crispEdges"
            />
        );
        lines.push(
            <line
                key={`h-${i}`}
                x1={start} y1={pos}
                x2={end} y2={pos}
                stroke="black"
                strokeWidth={width}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="square"
                className="grid-line"
                shapeRendering="crispEdges"
            />
        );
    }

    // Generate Coordinates
    const coords = [];
    if (showCoordinates) {

        // Dynamic generation:
        const getLabel = (n: number) => {
            if (n >= 9) n++; // skip I
            return String.fromCharCode(64 + n);
        };

        for (let i = 1; i <= boardSize; i++) {
            const pos = MARGIN + (i - 1) * CELL_SIZE;
            // Top Labels
            coords.push(
                <text
                    key={`cx-${i}`} x={pos} y={MARGIN - 25} textAnchor="middle" fontSize={COORD_FONT_SIZE} fill="black" fontFamily="sans-serif" fontWeight="bold"
                    style={{ WebkitFontSmoothing: 'none', fontSmooth: 'never' } as any}
                >
                    {getLabel(i)}
                </text>
            );
            // Left Labels
            coords.push(
                <text
                    key={`cy-${i}`} x={MARGIN - 25} y={pos + 5} textAnchor="middle" fontSize={COORD_FONT_SIZE} fill="black" fontFamily="sans-serif" fontWeight="bold"
                    style={{ WebkitFontSmoothing: 'none', fontSmooth: 'never' } as any}
                >
                    {boardSize - i + 1}
                </text>
            );
        }
    }

    // Draw stones
    const cells = [];
    // Safety check for boardState size vs boardSize
    // If state is 19x19 but mode is 13, we only loop to 13?
    // Yes, ignore outer stones.

    for (let y = 1; y <= boardSize; y++) {
        for (let x = 1; x <= boardSize; x++) {
            const cx = MARGIN + (x - 1) * CELL_SIZE;
            const cy = MARGIN + (y - 1) * CELL_SIZE;

            const stone = (boardState[y - 1] && boardState[y - 1][x - 1]);

            // Interaction Area
            cells.push(
                <rect
                    key={`click-${x}-${y}`}
                    x={cx - CELL_SIZE / 2}
                    y={cy - CELL_SIZE / 2}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    fill="transparent"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        if (e.buttons === 1) onDragStart(x, y);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onCellRightClick(x, y);
                    }}
                    onMouseEnter={(e) => {
                        onCellMouseEnter(x, y);
                        if (e.buttons === 1) onDragMove(x, y);
                    }}
                    onMouseLeave={() => {
                        onCellMouseLeave();
                    }}
                    onMouseUp={onDragEnd}
                    onClick={() => onCellClick(x, y)}
                    className="cursor-pointer hover:fill-blue-500 hover:fill-opacity-10"
                />
            );

            if (stone) {
                const isBlack = stone.color === 'BLACK';
                const label = specialLabels.find(l => l.x === x && l.y === y)?.label;
                // Prioritize number if present (User prefers "Black 1" over "Black A")
                const displayText = stone.number?.toString() || label;

                cells.push(
                    <g key={`s-group-${x}-${y}`} className="pointer-events-none">
                        <circle
                            cx={cx} cy={cy} r={STONE_RADIUS}
                            fill={isBlack ? "black" : "white"}
                            stroke={isBlack ? "black" : "black"}
                            strokeWidth={isBlack ? 2 : 0.7}
                            className={isBlack ? "black-stone" : "white-stone"}
                        // Removed crispEdges from stones for smoothness
                        />
                        {displayText && (
                            <text
                                x={cx} y={cy}
                                dy=".35em"
                                textAnchor="middle"
                                fill={isBlack ? "white" : "black"}
                                fontSize={FONT_SIZE}
                                fontFamily="Arial, sans-serif"
                                fontWeight="bold"
                                style={{ WebkitFontSmoothing: 'none', fontSmooth: 'never' } as any}
                            >
                                {displayText}
                            </text>
                        )}
                    </g>
                );
            }
        }
    }

    // Selection Overlay
    let selectionRect = null;
    if (selectionStart && selectionEnd) {
        const x1 = Math.min(selectionStart.x, selectionEnd.x);
        const x2 = Math.max(selectionStart.x, selectionEnd.x);
        const y1 = Math.min(selectionStart.y, selectionEnd.y);
        const y2 = Math.max(selectionStart.y, selectionEnd.y);

        // Clamp to board size
        if (x1 <= boardSize && y1 <= boardSize) {
            const cx1 = Math.max(1, x1);
            const cx2 = Math.min(boardSize, x2);
            const cy1 = Math.max(1, y1);
            const cy2 = Math.min(boardSize, y2);

            const sx = MARGIN + (cx1 - 1) * CELL_SIZE - CELL_SIZE / 2;
            const sy = MARGIN + (cy1 - 1) * CELL_SIZE - CELL_SIZE / 2;
            const w = (cx2 - cx1 + 1) * CELL_SIZE;
            const h = (cy2 - cy1 + 1) * CELL_SIZE;

            selectionRect = (
                <rect
                    key="selection-rect-overlay"
                    x={sx} y={sy} width={w} height={h}
                    fill="rgba(0, 0, 255, 0.2)"
                    stroke="blue"
                    strokeWidth={2}
                    pointerEvents="none"
                    className="selection-overlay"
                    id="selection-overlay-rect"
                />
            );
        }
    }

    return (
        <svg
            ref={ref}
            width="100%"
            height="100%"
            viewBox={viewBox}
            xmlns="http://www.w3.org/2000/svg"
            className={`select-none ${isMonochrome ? 'bg-white' : 'bg-[#DCB35C]'}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onWheel={(e) => onBoardWheel(e.deltaY)}
            style={{
                display: 'block',
                aspectRatio: viewBox.split(' ')[2] + ' / ' + viewBox.split(' ')[3]
            }}
        >
            <defs>
            </defs>

            {lines}
            {coords}

            {starPoints.map(([sx, sy]) => (
                <circle
                    key={`star-${sx}-${sy}`}
                    cx={MARGIN + (sx - 1) * CELL_SIZE}
                    cy={MARGIN + (sy - 1) * CELL_SIZE}
                    r={STAR_POINT_RADIUS}
                    fill="black"
                // Removed crispEdges from stars for smoothness
                />
            ))}

            {cells}
            {selectionRect}

            {/* Footer Text for Hidden Moves */}
            {hiddenMoves.length > 0 && (() => {
                const { minX, maxX: _, minY: __, maxY } = viewRange || { minX: 1, maxX: boardSize, minY: 1, maxY: boardSize };
                const validMinX = Math.max(1, minX);
                const validMaxY = Math.min(boardSize, maxY);

                // Start Position: Below board
                const startX = MARGIN + (validMinX - 1) * CELL_SIZE - CELL_SIZE / 2 + (showCoordinates ? -25 : 0) + 10;
                const startY = MARGIN + (validMaxY - 1) * CELL_SIZE + CELL_SIZE / 2 + (showCoordinates ? 25 : 0) + 20;

                const ITEM_SPACING = 120; // Space between each "N [M]" group
                const RADIUS = 14;
                const FONT = 12;

                return (
                    <g id="footer-group" transform={`translate(${startX}, ${startY})`}>
                        {hiddenMoves.map((ref, i) => {
                            const x = (i % 4) * ITEM_SPACING;
                            const y = Math.floor(i / 4) * 40;

                            const lColor = ref.left.color;
                            const rColor = ref.right.color; // might be undefined if label only? No, user shows stone A.

                            return (
                                <g key={`hm-${i}`} transform={`translate(${x}, ${y})`}>
                                    {/* Left Stone */}
                                    <circle cx={15} cy={0} r={RADIUS} fill={lColor === 'BLACK' ? 'black' : 'white'} stroke="black" strokeWidth={1} />
                                    <text x={15} y={0} dy=".35em" textAnchor="middle" fill={lColor === 'BLACK' ? 'white' : 'black'} fontSize={FONT} fontFamily="sans-serif">{ref.left.text}</text>

                                    {/* Bracket Open */}
                                    <text x={35} y={5} fontSize="16" fill="black" fontFamily="sans-serif">[</text>

                                    {/* Right Stone (Label) */}
                                    {/* User example shows Stone A. So we always render stone for Right side too? */}
                                    {/* Yes, '7 [ A ]' -> Stone 7, Stone A. */}
                                    <circle cx={55} cy={0} r={RADIUS} fill={rColor === 'BLACK' ? 'black' : 'white'} stroke="black" strokeWidth={1} />
                                    <text x={55} y={0} dy=".35em" textAnchor="middle" fill={rColor === 'BLACK' ? 'white' : 'black'} fontSize={FONT} fontFamily="sans-serif">{ref.right.text}</text>

                                    {/* Bracket Close */}
                                    <text x={75} y={5} fontSize="16" fill="black" fontFamily="sans-serif">]</text>
                                </g>
                            );
                        })}
                    </g>
                );
            })()}
        </svg>
    );
});

GoBoard.displayName = 'GoBoard';
export default GoBoard;
