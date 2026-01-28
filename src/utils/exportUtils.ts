declare const chrome: any;

const COLOR_NAME_MAP: Record<string, string> = {
    black: '#121212', // Aggressive Off-Black for Word
    white: '#ECECEC', // Aggressive Off-White for Word
    '#000': '#121212',
    '#fff': '#ECECEC',
    '#000000': '#121212',
    '#ffffff': '#ECECEC'
};

function normalizeColorValue(value: string): string | null {
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    return COLOR_NAME_MAP[lower] || null;
}

function normalizeSvgColors(svgElement: SVGSVGElement): void {
    const attributesToNormalize = ['fill', 'stroke', 'color', 'stop-color'];
    // Select ALL elements to ensure we catch everything
    const elements = svgElement.querySelectorAll('*');

    elements.forEach(el => {
        // 1. Normalize Attributes
        attributesToNormalize.forEach(attr => {
            const value = el.getAttribute(attr);
            if (value) {
                const normalized = normalizeColorValue(value);
                if (normalized) {
                    el.setAttribute(attr, normalized);
                }
            }
        });

        // 2. Explode Inline Styles (and remove them if possible)
        // Word hates styles. We try to convert strictly key styles to attributes if possible, or normalize values.
        const style = el.getAttribute('style');
        if (style) {
            // Simple replace for colors in style string
            const updated = style.replace(
                /\b(fill|stroke|color)\s*:\s*(black|white|#000|#fff|#000000|#ffffff)\b/gi,
                (_match, prop, color) => {
                    const normalized = normalizeColorValue(color);
                    return normalized ? `${prop}: ${normalized}` : _match;
                }
            );

            // If the element is a shape/text, prefer attributes over inline style for these props
            // But React often puts them in attributes already. 
            // We just update the style string to be safe.
            if (updated !== style) {
                el.setAttribute('style', updated);
            }
        }
    });

    // 3. Remove all <style> tags to prevent Media Query confusion in Word
    const styleTags = svgElement.querySelectorAll('style');
    styleTags.forEach(tag => tag.remove());
}


/**
 * Exports an SVG element to the system clipboard as a PNG image.
 */
export async function exportToPng(svgElement: SVGSVGElement, options: { scale?: number, backgroundColor?: string, destination?: 'CLIPBOARD' | 'DOWNLOAD', filename?: string } = {}): Promise<void> {
    // Default background is undefined (transparent) unless specified
    const { scale = 1, backgroundColor, destination = 'CLIPBOARD', filename = '' } = options;

    // Pass backgroundColor (could be undefined)
    const clone = prepareSvgForExport(svgElement, { backgroundColor });
    const width = parseFloat(clone.getAttribute('width') || '0');
    const height = parseFloat(clone.getAttribute('height') || '0');

    try {
        // svgToPngBlob will handle undefined backgroundColor (transparent logic)
        const blob = await svgToPngBlob(clone, width, height, scale, backgroundColor);
        if (destination === 'CLIPBOARD') {
            window.focus();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            console.log('Image copied to clipboard successfully.');
        } else {
            await saveFile(blob, filename, 'PNG Image', 'image/png');
        }
    } catch (error) {
        console.error('Export failed', error);
        alert(destination === 'CLIPBOARD' ? 'クリップボードへのコピーに失敗しました。' : '画像の保存に失敗しました。');
    }
}

/**
 * Helper to rasterize SVG to PNG Blob
 */
export async function svgToPngBlob(svgElement: SVGSVGElement, width: number, height: number, scale: number, backgroundColor: string | undefined): Promise<Blob> {
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
        if (!ctx) throw new Error('Canvas Context Failed');

        // Fill background ONLY if specified
        if (backgroundColor) {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

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
 */
export async function exportToSvg(svgElement: SVGSVGElement, options: { backgroundColor?: string, destination?: 'CLIPBOARD' | 'DOWNLOAD', filename?: string } = {}): Promise<void> {
    // Default background is undefined (transparent)
    const { backgroundColor, destination = 'CLIPBOARD', filename = '' } = options;

    const clone = prepareSvgForExport(svgElement, { backgroundColor });
    const width = parseFloat(clone.getAttribute('width') || '0');
    const height = parseFloat(clone.getAttribute('height') || '0');

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    if (destination === 'DOWNLOAD') {
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        await saveFile(svgBlob, filename, 'SVG Image', 'image/svg+xml');
        return;
    }

    try {
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        // PNG Fallback provided but potentially ignored by Word in favor of SVG
        const pngBlob = await svgToPngBlob(clone, width, height, 4, backgroundColor);

        window.focus();
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/svg+xml': svgBlob,
                'image/png': pngBlob
            })
        ]);
        console.log('SVG content copied to clipboard.');
    } catch (error) {
        console.error('Failed to copy SVG to clipboard:', error);
        alert('Failed to copy SVG. Please check permissions.');
    }
}

/**
 * Exports an SVG element to EMF format via Inkscape (Desktop Version Only)
 */
export async function exportToEmf(svgElement: SVGSVGElement, options: { backgroundColor?: string, destination?: 'CLIPBOARD' | 'DOWNLOAD', filename?: string } = {}): Promise<void> {
    const { backgroundColor, destination = 'DOWNLOAD', filename = 'output.emf' } = options;

    const clone = prepareSvgForExport(svgElement, { backgroundColor });
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    // Check if we are in Electron and the and the API is exposed
    const electron = (window as any).electron;
    if (electron && electron.exportToEmf) {
        try {
            const mode = destination === 'CLIPBOARD' ? 'clipboard' : 'file';
            const result = await electron.exportToEmf(svgString, { filename, mode });
            if (result.success) {
                console.log('EMF Export successful');
            } else {
                if (result.error !== 'User cancelled') {
                    alert('EMF Export failed: ' + result.error);
                }
            }
        } catch (error: any) {
            console.error('EMF Export error:', error);
            alert('EMF Export failed: ' + error.message);
        }
    } else {
        alert('EMF Export is only supported in the desktop version (GORewrite Desktop).');
    }
}



/**
 * Common Helper: Save Blob
 */
export async function saveFile(blob: Blob, filename: string, typeDescription: string, mimeType: string) {
    if ('showSaveFilePicker' in window) {
        try {
            const pickerOptions: any = {
                id: 'gorewrite-export',
                types: [{
                    description: typeDescription,
                    accept: { [mimeType]: ['.' + (filename ? filename.split('.').pop() : (mimeType.includes('png') ? 'png' : (mimeType.includes('gif') ? 'gif' : 'svg')))] }
                }]
            };
            if (filename) pickerOptions.suggestedName = filename;
            // @ts-ignore
            const handle = await window.showSaveFilePicker(pickerOptions);
            // @ts-ignore
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
            console.warn('FilePicker fallback...', e);
        }
    }
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
        const url = URL.createObjectURL(blob);
        try {
            await new Promise<void>((resolve, reject) => {
                const downloadOptions: any = {
                    url: url,
                    saveAs: true,
                    conflictAction: 'overwrite'
                };
                if (filename) downloadOptions.filename = filename;
                else {
                    const ext = mimeType.includes('gif') ? 'gif' : (mimeType.includes('svg') ? 'svg' : 'png');
                    downloadOptions.filename = `game.${ext}`;
                }
                chrome.downloads.download(downloadOptions, (_dId: number) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve();
                });
            });
            URL.revokeObjectURL(url);
            return;
        } catch (e: any) {
            URL.revokeObjectURL(url);
            if (e && (e.message === 'I_USER_CANCELLED' || e.message.includes('cancel'))) return;
            alert('保存できませんでした: ' + (e.message || e));
            return;
        }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

export async function promptSaveFile(mimeType: string, filename: string): Promise<any | null> {
    if (!('showSaveFilePicker' in window)) return null;
    try {
        const typeDescription = mimeType.split('/')[1].toUpperCase() + ' File';
        const pickerOptions: any = {
            id: 'gorewrite-export',
            types: [{ description: typeDescription, accept: { [mimeType]: ['.' + (filename ? filename.split('.').pop() : (mimeType.includes('png') ? 'png' : (mimeType.includes('gif') ? 'gif' : 'svg')))] } }]
        };
        if (filename) pickerOptions.suggestedName = filename;
        // @ts-ignore
        return await window.showSaveFilePicker(pickerOptions);
    } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        return null;
    }
}
export async function writeToHandle(handle: any, blob: Blob) {
    // @ts-ignore
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
}

// Helper to prepare SVG clone with FLAT DOM (No Style Tags)
export function prepareSvgForExport(originalSvg: SVGSVGElement, options: { backgroundColor?: string }): SVGSVGElement {
    const clone = originalSvg.cloneNode(true) as SVGSVGElement;

    // 1. Force Dimensions
    const viewBox = originalSvg.getAttribute('viewBox');
    if (viewBox) {
        const [, , w, h] = viewBox.split(' ').map(parseFloat);
        clone.setAttribute('width', w.toString());
        clone.setAttribute('height', h.toString());
    }

    // 2. Add Background Rect (ONLY if explicitly set)
    const finalBgColor = options.backgroundColor;

    if (finalBgColor) {
        const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bgRect.setAttribute("width", "100%");
        bgRect.setAttribute("height", "100%");
        bgRect.setAttribute("fill", finalBgColor);

        // Insert background first
        if (clone.firstChild) {
            clone.insertBefore(bgRect, clone.firstChild);
        } else {
            clone.appendChild(bgRect);
        }
    }

    // 3. Normalize Colors & Remove Styles
    // This function now effectively flattens the styles and enforces off-colors
    normalizeSvgColors(clone);

    // 4. Force global attribute on root (ONLY if bg set)
    if (finalBgColor) {
        clone.setAttribute("style", `background-color: ${finalBgColor};`);
    }

    return clone;
}
