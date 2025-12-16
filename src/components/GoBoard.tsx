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
    selectionEnd: { x: number, y: number } | null;

    onDragStart: (x: number, y: number) => void;
    onDragMove: (x: number, y: number) => void;
    onDragEnd: () => void;
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
    onDragEnd
}, ref) => {
    const CELL_SIZE = 40;
    const MARGIN = 40;

    // Use passed viewRange or default to full board
    const effectiveViewRange = viewRange || {
        minX: 1, maxX: boardSize, minY: 1, maxY: boardSize
    };

    // Visual Tuning Constants (Updated v22)
    const LINE_WIDTH = 1;
    const BORDER_WIDTH = 2;
    const STONE_RADIUS = CELL_SIZE * 0.47;
    const FONT_SIZE = CELL_SIZE * 0.4;
    const COORD_FONT_SIZE = 14;
    const STAR_POINT_RADIUS = 3;

    const getStarPoints = (size: number) => {
        if (size === 19) {
            return [
                [4, 4], [10, 4], [16, 4],
                [4, 10], [10, 10], [16, 10],
                [4, 16], [10, 16], [16, 16]
            ];
        } else if (size === 13) {
            return [
                [4, 4], [7, 4], [10, 4],
                [4, 7], [7, 7], [10, 7],
                [4, 10], [7, 10], [10, 10]
            ];
        } else if (size === 9) {
            return [
                [3, 3], [7, 3], // 3,3 ? or 3,7
                [5, 5],
                [3, 7], [7, 7]
            ];
            // Standard 9x9 stars are 3-3, 3-7, 7-3, 7-7, 5-5.
            // Coord 3 is 3rd line. 
            // Yes.
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
        const height = (validMaxY - validMinY + 1) * CELL_SIZE;

        if (showCoordinates) {
            return `${x - 25} ${y - 25} ${width + 50} ${height + 50}`;
        }
        return `${x} ${y} ${width} ${height}`;
    }, [effectiveViewRange, showCoordinates, boardSize]);

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
                <text key={`cx-${i}`} x={pos} y={MARGIN - 25} textAnchor="middle" fontSize={COORD_FONT_SIZE} fill="black" fontFamily="sans-serif">
                    {getLabel(i)}
                </text>
            );
            // Left Labels
            coords.push(
                <text key={`cy-${i}`} x={MARGIN - 25} y={pos + 5} textAnchor="middle" fontSize={COORD_FONT_SIZE} fill="black" fontFamily="sans-serif">
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
                cells.push(
                    <g key={`s-group-${x}-${y}`} className="pointer-events-none">
                        <circle
                            cx={cx} cy={cy} r={STONE_RADIUS}
                            fill={isBlack ? "black" : "white"}
                            stroke={isBlack ? "none" : "black"}
                            strokeWidth={isBlack ? 0 : LINE_WIDTH}
                            className={isBlack ? "black-stone" : "white-stone"}
                        />
                        {stone.number && (
                            <text
                                x={cx} y={cy}
                                dy=".35em"
                                textAnchor="middle"
                                fill={isBlack ? "white" : "black"}
                                fontSize={FONT_SIZE}
                                fontFamily="sans-serif"
                            >
                                {stone.number}
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
                    data-export-ignore="true"
                    x={sx} y={sy} width={w} height={h}
                    fill="rgba(0, 0, 255, 0.2)"
                    stroke="blue"
                    strokeWidth={2}
                    pointerEvents="none"
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
                />
            ))}

            {cells}
            {selectionRect}
        </svg>
    );
});

GoBoard.displayName = 'GoBoard';
export default GoBoard;
