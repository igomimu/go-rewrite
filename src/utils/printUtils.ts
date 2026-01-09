import { BoardState, StoneColor } from '../components/GoBoard';

// Assuming HistoryState structure based on usage in App.tsx
// It usually contains { board: BoardState, move: ... }
// Let's define it here or import if possible.
// App.tsx defines it locally usually. Ideally checkApp.tsx content.
// Based on previous view_file of App.tsx, HistoryState is likely defined there.
// If not exported, I'll define a compatible interface here.

interface HistoryState {
    board: BoardState;
    // other fields like capturedStones etc
}

export interface PrintFigure {
    board: BoardState;
    moves: { x: number, y: number, color: StoneColor, number: number }[];
    moveRangeStart: number;
    moveRangeEnd: number;
    stoneMarkers: { x: number, y: number, label: string }[];
}

/**
 * Generates a list of figures (board states + new moves) for printing.
 * @param history Full game history
 * @param movesPerFigure 
 */
export function generatePrintFigures(history: HistoryState[], movesPerFigure: number): PrintFigure[] {
    const figures: PrintFigure[] = [];
    const totalMoves = history.length - 1; // Index 0 is initial state

    // Always create at least one figure
    if (totalMoves <= 0) {
        return [{
            board: history[0]?.board || [], // Handle empty history safety
            moves: [],
            moveRangeStart: 0,
            moveRangeEnd: 0,
            stoneMarkers: []
        }];
    }

    // Iterate through chunks
    for (let i = 1; i <= totalMoves; i += movesPerFigure) {
        const startMoveNum = i;
        const endMoveNum = Math.min(i + movesPerFigure - 1, totalMoves);

        const finalState = history[endMoveNum];

        // Prepare "Display Board" for this figure
        const displayBoard: BoardState = finalState.board.map(row =>
            row.map(stone => {
                if (!stone) return null;
                if (stone.number && stone.number < startMoveNum) {
                    // Old stone: remove number so it renders plain
                    return { ...stone, number: undefined };
                }
                // New stone: keep number
                return stone;
            })
        );

        figures.push({
            board: displayBoard,
            moves: [], // Not really needed if we use board state rendering
            moveRangeStart: startMoveNum,
            moveRangeEnd: endMoveNum,
            stoneMarkers: []
        });
    }

    return figures;
}
