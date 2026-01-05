
import os
from PIL import Image, ImageFilter

def thicken_image(image_path, iterations=1):
    try:
        img = Image.open(image_path).convert("RGBA")
        
        # Split channels
        r, g, b, a = img.split()
        
        # Create a mask from alpha to protect transparency if needed, 
        # but for thickening lines, we generally want to process the RGB channels
        # or the alpha channel itself if the "lines" are defined by alpha visibility.
        
        # Assuming typical icon: dark lines on transparent or white background.
        # If it's transparent background, lines are non-transparent pixels.
        # To thicken lines, we want to expand the non-transparent area in Alpha channel
        # AND expand the dark pixels in RGB channels.
        
        # Strategy:
        # 1. Expand Alpha channel (make more pixels visible around existing ones)
        # 2. Expand dark pixels in RGB (make lines thicker visually)
        
        # Apply MinFilter (Erosion) to RGB to thicken dark lines
        # (MinFilter looks for darkest pixel in kernel)
        img_rgb = Image.merge("RGB", (r, g, b))
        thickened_rgb = img_rgb
        for _ in range(iterations):
            thickened_rgb = thickened_rgb.filter(ImageFilter.MinFilter(3))
            
        # Apply MaxFilter (Dilation) to Alpha to expand opacity
        # (MaxFilter looks for brightest/most opaque pixel)
        thickened_a = a
        for _ in range(iterations):
            thickened_a = thickened_a.filter(ImageFilter.MaxFilter(3))
            
        # Merge back
        final_img = Image.merge("RGBA", (*thickened_rgb.split(), thickened_a))
        
        final_img.save(image_path)
        print(f"Processed: {image_path}")
        
    except Exception as e:
        print(f"Failed to process {image_path}: {e}")

if __name__ == "__main__":
    target_dir = r"c:\Users\lucky\VibeWorks-Yogapro-Win\GORewrite\public\icons"
    targets = ["icon16.png", "icon48.png", "icon128.png"]
    
    for filename in targets:
        path = os.path.join(target_dir, filename)
        if os.path.exists(path):
            # Apply thickening. 1 iteration for small, maybe 2 for large?
            # 1 iteration (3x3 kernel) adds 1 pixel width roughly.
            # For 16x16, 1 pixel is a lot. For 128x128, 1 pixel is subtle.
            
            # Let's adjust iterations based on size
            iterations = 1
            if "128" in filename:
                iterations = 2 
            
            thicken_image(path, iterations=iterations)
        else:
            print(f"Not found: {path}")
