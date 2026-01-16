// GORewrite - GIF Export Utility
import GIF from 'gif.js';

export interface GifExportOptions {
    /** Delay between frames in milliseconds (default: 1000) */
    delay: number;
    /** Output width in pixels (default: 400) */
    width: number;
    /** Output height in pixels (default: 400) */
    height: number;
    /** Number of loops (0 = infinite) */
    repeat: number;
    /** Quality (1-20, lower = better quality but slower) */
    quality: number;
}

const DEFAULT_OPTIONS: GifExportOptions = {
    delay: 1000,
    width: 400,
    height: 400,
    repeat: 0,
    quality: 10,
};

/**
 * Generate an animated GIF from an array of canvas elements or image data
 */
export async function generateGif(
    canvases: HTMLCanvasElement[],
    options: Partial<GifExportOptions> = {}
): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve) => {
        const gif = new GIF({
            workers: 2,
            quality: opts.quality,
            width: opts.width,
            height: opts.height,
            workerScript: '/gif.worker.js',
            repeat: opts.repeat,
        });

        // Add each canvas as a frame
        for (const canvas of canvases) {
            gif.addFrame(canvas, { delay: opts.delay, copy: true });
        }

        gif.on('finished', (blob: Blob) => {
            resolve(blob);
        });

        gif.render();
    });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Render SVG element to Canvas at specified size
 */
export async function svgToCanvas(
    svgElement: SVGSVGElement,
    width: number,
    height: number
): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Serialize SVG to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = url;
    });
}
