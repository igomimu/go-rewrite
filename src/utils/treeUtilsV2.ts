import { BoardState, StoneColor, Marker } from '../components/GoBoard';
import { checkCaptures } from './gameLogic';

export interface GameNode {
    id: string;
    parent: GameNode | null;
    children: GameNode[];
    board: BoardState;
    nextNumber: number;
    activeColor: StoneColor;
    boardSize: number;
    markers: Marker[];
    move?: { x: number, y: number, color: StoneColor };
}

export const createNode = (
    parent: GameNode | null,
    board: BoardState,
    nextNumber: number,
    activeColor: StoneColor,
    boardSize: number,
    move?: { x: number, y: number, color: StoneColor }
): GameNode => {
    return {
        id: Math.random().toString(36).substr(2, 9),
        parent,
        children: [],
        board,
        nextNumber,
        activeColor,
        boardSize,
        markers: [],
        move
    };
};

export const findNode = (root: GameNode, id: string): GameNode | null => {
    if (root.id === id) return root;
    for (const child of root.children) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};

export const getPath = (root: GameNode, targetId: string): GameNode[] => {
    const target = findNode(root, targetId);
    if (!target) return [root];
    const path: GameNode[] = [];
    let curr: GameNode | null = target;
    while (curr) {
        path.unshift(curr);
        curr = curr.parent;
    }
    return path;
};

export const addMove = (
    parent: GameNode,
    board: BoardState,
    nextNumber: number,
    activeColor: StoneColor,
    boardSize: number,
    move: { x: number, y: number, color: StoneColor }
): GameNode => {
    // Check if duplicate move exists in children
    const existing = parent.children.find(c =>
        c.move && c.move.x === move.x && c.move.y === move.y && c.move.color === move.color
    );
    if (existing) {
        return existing;
    }

    // Create new (will create branch if parent already has children)
    const newNode = createNode(parent, board, nextNumber, activeColor, boardSize, move);
    parent.children.push(newNode);
    return newNode;
};

export const recalculateBoards = (node: GameNode) => {
    // This function assumes 'node' has the CORRECT board (e.g. Root was updated manually).
    // We update all children recursively based on their moves.

    for (const child of node.children) {
        if (child.move) {
            // Re-apply move logic
            // 1. Copy parent board
            const newBoard: BoardState = node.board.map(row => row.map(cell => cell ? { ...cell } : null));

            const { x, y, color } = child.move;
            // Place stone (x, y are 1-based from App interaction, but board is 0-indexed)

            if (y - 1 >= 0 && y - 1 < newBoard.length && x - 1 >= 0 && x - 1 < newBoard.length) {
                newBoard[y - 1][x - 1] = {
                    color: color,
                    number: node.nextNumber
                };

                // Check captures (gameLogic uses 0-based coords)
                const captured = checkCaptures(newBoard, x - 1, y - 1, color);
                captured.forEach(c => {
                    newBoard[c.y][c.x] = null;
                });
            }

            // Assign new board to child
            child.board = newBoard;

            // Recurse
            recalculateBoards(child);
        }
    }
};
