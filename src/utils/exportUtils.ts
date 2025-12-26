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
export async function exportToPng(svgElement: SVGSVGElement, scale = 1, backgroundColor = '#DCB35C'): Promise<void> {
    // 1. Clone the SVG to manipulate it without affecting the DOM
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    // 3. Remove "data-export-ignore" elements (e.g. selection rect)
    const ignoredElements = clone.querySelectorAll('[data-export-ignore="true"]');
    ignoredElements.forEach(el => el.remove());



    // 4.5 Thicken White Stones in Monochrome Mode -> REMOVED (User requested thinner lines)
    // if (backgroundColor.toUpperCase() === '#FFFFFF') {
    //     const whiteStones = clone.querySelectorAll('.white-stone');
    //     whiteStones.forEach(el => {
    //         (el as SVGCircleElement).style.strokeWidth = '3px';
    //     });
    // }

    // 2. Get the crop aspect ratio / dimensions from viewBox
    // App.tsx logic ensures viewBox is set correctly on the element passed here.
    // However, if we receive a raw element, use its current viewBox values.
    let width, height;

    if (clone.getAttribute('viewBox')) {
        const vb = clone.getAttribute('viewBox')!.split(' ').map(Number);
        // x = vb[0]; y = vb[1]; // Unused
        width = vb[2];
        height = vb[3];
    } else {
        // Fallback (should not happen with GoBoard)
        const bBox = svgElement.getBoundingClientRect();
        width = bBox.width;
        height = bBox.height;
        clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    // 3. FORCE Width/Height Attributes to match viewBox (Pixels)
    // This fixes the bug where Notion/Browsers ignore viewBox if width/height are 100% or unset during Rasterization.
    clone.setAttribute('width', `${width}px`);
    clone.setAttribute('height', `${height}px`);

    // 4. Handle Background Color
    // Tailwind classes (bg-[#DCB35C]) are LOST in serialization because stylesheets aren't inlined.
    // We explicitly set the style on the clone.
    clone.style.backgroundColor = backgroundColor;

    // 5. Serialize
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();

    // 6. Load Image
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = url;
    });

    // 7. Prepare High-Res Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    // 8. Fill Background (Double Safety)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 9. Draw Image Scaled
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    URL.revokeObjectURL(url);

    // 10. Write to Clipboard
    try {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Could not generate PNG blob');

        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        // alert('Copied to clipboard!'); // User requested no confirmation
        console.log('Image copied to clipboard successfully.');
    } catch (error) {
        console.error('Clipboard write failed', error);
    }
}

/**
 * Exports an SVG element as an SVG file download.
 * Useful for high-quality printing or editing in vector software.
 */
export async function exportToSvg(svgElement: SVGSVGElement, filename = 'go_board.svg', backgroundColor = '#DCB35C'): Promise<void> {
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

    // Explicitly set background color on the SVG root logic if needed
    // Typically SVG background is transparent unless a rect is behind.
    // However, we want to match PNG look.
    // GoBoard component might not have a bg rect.
    // Let's wrap content in a group and put a rect behind it? 
    // Or just set style on svg (which transparency might ignore in some viewers, but inkscape handles).
    // Better: Add a rect as the first child if not present.
    // But simplistic approach: style.backgroundColor.
    clone.style.backgroundColor = backgroundColor;

    // Serialize
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Trigger Download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);
}
