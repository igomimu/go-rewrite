import { BoardState, StoneColor } from "../components/GoBoard";

/**
 * Checks for captured stones after a move.
 * Returns an array of coordinates {x, y} of stones that should be removed.
 * Coordinates are 0-indexed here for easier logic, but App uses 1-indexed for some things?
 * Let's stick to 0-indexed for internal logic, as BoardState is [y][x].
 * App passes BoardState which is (Stone | null)[][].
 */
export function checkCaptures(
    board: BoardState,
    lastMoveX: number, // 0-indexed
    lastMoveY: number, // 0-indexed
    placedColor: StoneColor
): { x: number, y: number }[] {

    const captured: { x: number, y: number }[] = [];
    const opponentColor = placedColor === 'BLACK' ? 'WHITE' : 'BLACK';
    const size = board.length;

    // Directions: Up, Down, Left, Right
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    // Check neighbors of the placed stone
    // If a neighbor is opponent color, check if that group is captured
    for (const [dx, dy] of dirs) {
        const nx = lastMoveX + dx;
        const ny = lastMoveY + dy;

        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const neighbor = board[ny][nx];
            if (neighbor && neighbor.color === opponentColor) {
                // Perform flood fill to find group and check liberties
                const group: { x: number, y: number }[] = [];
                // Note: pass opponentColor as the color of the group we are checking
                if (!hasLiberties(board, nx, ny, opponentColor, group)) {
                    captured.push(...group);
                }
            }
        }
    }

    return captured;
}

/**
 * Returns true if the group connected to (startX, startY) has at least one liberty.
 * Populates 'group' array with the coordinates of the group members.
 * Note: if returns true (has liberty), 'group' might not be fully populated if we optimized early exit.
 * But for capture check, if it has liberty, we don't capture anything, so 'group' content doesn't matter.
 * If it has NO liberties, we MUST have visited all nodes, so 'group' will be complete.
 */
function hasLiberties(
    board: BoardState,
    startX: number,
    startY: number,
    color: StoneColor,
    group: { x: number, y: number }[]
): boolean {
    const size = board.length;
    // We need a set for visited to avoid infinite loops
    const visited = new Set<string>();
    const stack = [{ x: startX, y: startY }];

    // Mark start as visited
    visited.add(`${startX},${startY}`);
    group.push({ x: startX, y: startY });

    // Since we are doing a flood fill, better to use a loop on the growing group or a stack
    // Re-implementing correctly

    // We can just iterate through the group array if we append to it?
    // Let's use a standard stack DFS

    // Initialize 'group' with start node is already done by caller? No, let's reset it here?
    // Caller passed empty group.

    // wait, I pushed to group above.

    // But wait, if I find a group with no liberties, I need the group list.
    // If I find a liberty, I return true immediately.

    while (stack.length > 0) {
        const { x, y } = stack.pop()!;

        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                const neighbor = board[ny][nx];
                const key = `${nx},${ny}`;

                if (!neighbor) {
                    // Found a liberty!
                    return true;
                } else if (neighbor.color === color) {
                    // Same color stone, part of group
                    if (!visited.has(key)) {
                        visited.add(key);
                        group.push({ x: nx, y: ny });
                        stack.push({ x: nx, y: ny });
                    }
                }
                // else: Opponent stone, blocks liberty (do nothing)
            }
        }
    }

    return false; // No liberties found after traversing entire group
}
