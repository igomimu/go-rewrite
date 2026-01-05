
import os
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

def super_enhance_lines(image_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        
        # 1. Sharpen significantly to emphasize grid lines
        # UnsharpMask with high radius/percent creates "halos" around edges locally, making lines pop
        img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=200, threshold=3))
        
        # 2. Convert to grayscale equivalent to analyze brightness
        # We want to force dark grays (lines) to be BLACK
        # and light grays (background/white stones) to be WHITE
        # This is essentially "thresholding" but keeping anti-aliasing for text/circles
        
        r, g, b, a = img.split()
        
        # Process RGB channels to increase local contrast
        # Use ImageOps.autocontrast to stretch histogram
        rgb_img = Image.merge("RGB", (r, g, b))
        rgb_img = ImageOps.autocontrast(rgb_img, cutoff=5) 
        
        # Manually darken the darks
        # Load pixels to force dark values down
        pixels = rgb_img.load()
        width, height = rgb_img.size
        
        for y in range(height):
            for x in range(width):
                pr, pg, pb = pixels[x, y]
                # If pixel is darkish (line candidate), make it darker
                if pr < 180 and pg < 180 and pb < 180:
                    # Apply a gamma curve or simple multiplication to darken
                    pixels[x, y] = (int(pr * 0.6), int(pg * 0.6), int(pb * 0.6))
        
        # Merge back with original alpha
        final_img = Image.merge("RGBA", (*rgb_img.split(), a))
        
        # Save
        final_img.save(image_path)
        print(f"Super enhanced: {image_path}")
        
    except Exception as e:
        print(f"Failed to process {image_path}: {e}")

if __name__ == "__main__":
    target_dir = r"c:\Users\lucky\VibeWorks-Yogapro-Win\GORewrite\public\icons"
    targets = ["icon16.png", "icon48.png", "icon128.png"]
    
    for filename in targets:
        path = os.path.join(target_dir, filename)
        if os.path.exists(path):
            super_enhance_lines(path)
