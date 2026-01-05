/**
 * Exports an SVG element to the system clipboard as a PNG image.
 * Uses a Canvas to rasterize the SVG at a high resolution.
 * 
 * FIX v17/v19:
 * - Clones SVG to ensure attributes can be modified safeley.
 * - Explicitly sets width/height to match viewBox (trimming/cropping).
 * - Fills background to handle Tailwind class loss.
 */
/**
 * Exports an SVG element to the system clipboard as a PNG image.
 * Uses a Canvas to rasterize the SVG at a high resolution.
 * 
 * FIX v22:
 * - Accept optional backgroundColor.
 * - Remove elements marked with data-export-ignore="true" (like selection rect).
 */
export async function exportToPng(svgElement: SVGSVGElement, options: { scale?: number, backgroundColor?: string, destination?: 'CLIPBOARD' | 'DOWNLOAD', filename?: string } = {}): Promise<void> {
    const { scale = 1, backgroundColor = '#DCB35C', destination = 'CLIPBOARD', filename = 'go_board.png' } = options;

    // 1. Clone the SVG to manipulate it without affecting the DOM
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    // 2. Remove "data-export-ignore" elements (e.g. selection rect)
    const ignoredElements = clone.querySelectorAll('[data-export-ignore="true"]');
    ignoredElements.forEach(el => el.remove());

    // 3. Get the crop aspect ratio / dimensions from viewBox
    let width, height;

    if (clone.getAttribute('viewBox')) {
        const vb = clone.getAttribute('viewBox')!.split(' ').map(Number);
        width = vb[2];
        height = vb[3];
    } else {
        const bBox = svgElement.getBoundingClientRect();
        width = bBox.width;
        height = bBox.height;
        clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    // 4. FORCE Width/Height Attributes to match viewBox (Pixels)
    clone.setAttribute('width', `${width}px`);
    clone.setAttribute('height', `${height}px`);

    // 5. Handle Background Color
    clone.style.backgroundColor = backgroundColor;

    // 6. Generate PNG Blob (Shared Logic)
    try {
        const blob = await svgToPngBlob(clone, width, height, scale, backgroundColor);

        // 7. Output
        if (destination === 'CLIPBOARD') {
            // Ensure focus for Clipboard API
            window.focus();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            console.log('Image copied to clipboard successfully.');
        } else {
            // Download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            console.log('Image downloaded successfully.');
        }
    } catch (error) {
        console.error('Export failed', error);
        if (destination === 'CLIPBOARD') {
            alert('クリップボードへのコピーに失敗しました。');
        } else {
            alert('画像の保存に失敗しました。');
        }
    }
}

/**
 * Helper to rasterize SVG to PNG Blob
 */
async function svgToPngBlob(svgElement: SVGSVGElement, width: number, height: number, scale: number, backgroundColor: string): Promise<Blob> {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();

    try {
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Fill Background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Image Scaled
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Could not generate PNG blob'));
            }, 'image/png');
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Exports an SVG element to the system clipboard as SVG text.
 * Matches PNG behavior (Copy instead of Download).
 */
export async function exportToSvg(svgElement: SVGSVGElement, backgroundColor = '#DCB35C'): Promise<void> {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    // Remove "data-export-ignore" elements
    const ignoredElements = clone.querySelectorAll('[data-export-ignore="true"]');
    ignoredElements.forEach(el => el.remove());

    let width, height;
    if (clone.getAttribute('viewBox')) {
        const vb = clone.getAttribute('viewBox')!.split(' ').map(Number);
        width = vb[2];
        height = vb[3];
    } else {
        const bBox = svgElement.getBoundingClientRect();
        width = bBox.width;
        height = bBox.height;
        clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    clone.setAttribute('width', `${width}px`);
    clone.setAttribute('height', `${height}px`);

    // Set background color
    clone.style.backgroundColor = backgroundColor;

    // Serialize
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    // Copy to Clipboard (Hybrid: SVG Image + Text + PNG Fallback)
    try {
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const textBlob = new Blob([svgString], { type: 'text/plain' });

        // Generate PNG Fallback (Level 3 scale for high quality)
        const pngBlob = await svgToPngBlob(clone, width, height, 3, backgroundColor);

        // Ensure focus for Clipboard API
        window.focus();

        await navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': textBlob,
                'image/svg+xml': svgBlob,
                'image/png': pngBlob // Fallback for Chrome/Slack/etc
            })
        ]);
        console.log('SVG content copied to clipboard (Image+Text+PNG).');
    } catch (error) {
        console.error('Failed to copy SVG to clipboard:', error);
        // Fallback to text only if the complex write fails
        try {
            window.focus();
            await navigator.clipboard.writeText(svgString);
            console.log('Fallback: SVG text copied to clipboard.');
        } catch (e2) {
            alert('Failed to copy SVG. Please check permissions.');
        }
    }
}
