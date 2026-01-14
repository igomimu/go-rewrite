declare const chrome: any;


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
    // Default filename empty to allow Save As dialog to handle it (or use browser default)
    const { scale = 1, backgroundColor = '#DCB35C', destination = 'CLIPBOARD', filename = '' } = options;

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

    // 5. Handle Background Color (Explicit SVG Rect - same as exportToSvg)
    // Note: CSS backgroundColor is unreliable when serializing SVG to image
    const vb = clone.getAttribute('viewBox')!.split(' ').map(Number);
    const [minX, minY, vbWidth, vbHeight] = vb;

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", String(minX));
    bgRect.setAttribute("y", String(minY));
    bgRect.setAttribute("width", String(vbWidth));
    bgRect.setAttribute("height", String(vbHeight));
    bgRect.setAttribute("fill", backgroundColor);

    // Insert as first child to be behind all content
    if (clone.firstChild) {
        clone.insertBefore(bgRect, clone.firstChild);
    } else {
        clone.appendChild(bgRect);
    }

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
            // Download using helper
            await saveFile(blob, filename, 'PNG Image', 'image/png');
        }
    } catch (error) {
        console.error('Export failed', error);
        if (destination === 'CLIPBOARD') {
            alert('クリップボードへのコピーに失敗しました。');
        } else {
            console.error('Save failed', error);
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
export async function exportToSvg(svgElement: SVGSVGElement, options: { backgroundColor?: string, destination?: 'CLIPBOARD' | 'DOWNLOAD', filename?: string } = {}): Promise<void> {
    // Default filename empty
    const { backgroundColor = '#DCB35C', destination = 'CLIPBOARD', filename = '' } = options;
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    // Remove "data-export-ignore" elements
    const ignoredElements = clone.querySelectorAll('[data-export-ignore="true"]');
    ignoredElements.forEach(el => el.remove());

    // 3. Get the crop aspect ratio / dimensions from viewBox
    let width, height, minX = 0, minY = 0;
    if (clone.getAttribute('viewBox')) {
        const vb = clone.getAttribute('viewBox')!.split(' ').map(Number);
        minX = vb[0];
        minY = vb[1];
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

    // 5. Set background color (Explicit Rect for Word compatibility)
    // clone.style.backgroundColor = backgroundColor; // unreliable in Word

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", String(minX));
    bgRect.setAttribute("y", String(minY));
    bgRect.setAttribute("width", String(width));
    bgRect.setAttribute("height", String(height));
    bgRect.setAttribute("fill", backgroundColor || "#FFFFFF"); // Default to White if empty

    // Insert as first child
    if (clone.firstChild) {
        clone.insertBefore(bgRect, clone.firstChild);
    } else {
        clone.appendChild(bgRect);
    }

    // 6. Serialize
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    if (destination === 'DOWNLOAD') {
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        await saveFile(svgBlob, filename, 'SVG Image', 'image/svg+xml');
        return;
    }

    // Copy to Clipboard (PNG ONLY for Word compatibility)
    // Note: image/svg+xml causes Word to lose background after save/reopen
    try {
        const textBlob = new Blob([svgString], { type: 'text/plain' });

        // Generate PNG (Level 3 scale for high quality)
        const pngBlob = await svgToPngBlob(clone, width, height, 3, backgroundColor);

        // Ensure focus for Clipboard API
        window.focus();

        await navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': textBlob,
                // 'image/svg+xml': svgBlob,  // REMOVED: Causes black background in Word after save
                'image/png': pngBlob // Primary format for maximum compatibility
            })
        ]);
        console.log('SVG content copied to clipboard (Text+PNG).');
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

/**
 * Common Helper: Save Blob with "Save As" preference
 * Tries:
 * 1. chrome.downloads.download (Extension API) - enforces Save As dialog
 * 2. window.showSaveFilePicker (File System Access API) - opens standard Save dialog
 * 3. <a> tag download (Fallback)
 */
async function saveFile(blob: Blob, filename: string, typeDescription: string, mimeType: string) {
    // 1. File System Access API (Modern Web - PREFERRED for no-download-UI)
    if ('showSaveFilePicker' in window) {
        try {
            const pickerOptions: any = {
                id: 'gorewrite-export', // specific ID to remember location
                types: [{
                    description: typeDescription,
                    accept: { [mimeType]: ['.' + (filename ? filename.split('.').pop() : (mimeType.includes('png') ? 'png' : 'svg'))] }
                }]
            };
            // Only set suggestedName if explicitly provided and not empty.
            // If we omit it, browser might default to "Untitled" or blank depending on implementation.
            if (filename) pickerOptions.suggestedName = filename;

            // @ts-ignore
            const handle = await window.showSaveFilePicker(pickerOptions);
            // @ts-ignore
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            console.log('Saved via FilePicker');
            return; // Success
        } catch (e) {
            if ((e as Error).name === 'AbortError') {
                console.log('User cancelled Save As');
                return; // User cancelled
            }
            console.warn('FilePicker API failed/not supported, falling back to chrome.downloads...', e);
            // Fallthrough to next method
        }
    }

    // 2. Chrome Extension API (Requires 'downloads' permission)
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
        const url = URL.createObjectURL(blob);
        try {
            await new Promise<void>((resolve, reject) => {
                const downloadOptions: any = {
                    url: url,
                    saveAs: true, // FORCE "Save As" dialog
                    conflictAction: 'overwrite'
                };
                // Only set filename if provided (allows empty for Save As to manage)
                if (filename) downloadOptions.filename = filename;

                chrome.downloads.download(downloadOptions, (downloadId: number) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log(`Download started with ID: ${downloadId}`);
                        resolve();
                    }
                });
            });
            URL.revokeObjectURL(url);
            return; // Success
        } catch (e: any) {
            URL.revokeObjectURL(url);
            // If user cancelled, just stop.
            if (e && (e.message === 'I_USER_CANCELLED' || e.message.includes('cancel'))) {
                console.log('User cancelled Save As');
                return;
            }
            console.error('Chrome downloads API failed', e);
            alert('保存できませんでした: ' + (e.message || e));
            return; // Do NOT fallback to duplicate download
        }
    }

    // 3. Fallback: Anchor Tag (Browser default behavior - only if above APIs not supported)
    console.log('Falling back to <a> tag download');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
