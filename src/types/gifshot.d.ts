declare module 'gifshot' {
  interface GifOptions {
    images?: string[];
    gifWidth?: number;
    gifHeight?: number;
    interval?: number;
    numFrames?: number;
    frameDuration?: number;
    sampleInterval?: number;
    numWorkers?: number;
    filter?: string;
    fontWeight?: string;
    fontSize?: string;
    fontFamily?: string;
    fontColor?: string;
    textAlign?: string;
    textBaseline?: string;
    text?: string;
    showProgressBar?: boolean;
    progressCallback?: (progress: number) => void;
  }

  interface GifResult {
    error: boolean;
    errorCode: string;
    errorMsg: string;
    image: string;
    cameraStream: any;
  }

  export function createGIF(
    options: GifOptions,
    callback: (obj: GifResult) => void
  ): void;
}
