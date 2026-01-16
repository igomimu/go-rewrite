import gifshot from 'gifshot';

export interface GifExportOptions {
    width?: number;
    height?: number;
    interval?: number; // seconds between frames
    progressCallback?: (progress: number) => void;
}

export async function createGifFromImages(images: string[], options: GifExportOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        gifshot.createGIF({
            images: images,
            gifWidth: options.width,
            gifHeight: options.height,
            interval: options.interval || 0.5,
            progressCallback: options.progressCallback,
            numWorkers: 2,
        }, (obj) => {
            if (!obj.error) {
                resolve(obj.image);
            } else {
                reject(new Error(obj.errorMsg));
            }
        });
    });
}
