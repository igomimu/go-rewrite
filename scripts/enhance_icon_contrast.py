
import os
from PIL import Image, ImageEnhance, ImageFilter

def enhance_contrast(image_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        
        # 1. Enhance Contrast & Sharpness
        # Make the darks darker and lights lighter to survive downscaling
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)  # Increase contrast significantly
        
        sharpener = ImageEnhance.Sharpness(img)
        img = sharpener.enhance(2.0) # Sharpen edges
        
        # 2. Ensure lines are BLACK not gray
        # Convert to grayscale to check brightness, then force dark pixels to black
        # This is a pixel-level operation for precision
        pixels = img.load()
        width, height = img.size
        
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                # If pixel is visible
                if a > 0:
                    # If it's a grid line (dark gray), make it black
                    # Grid lines are usually R=G=B and low value relative to white
                    if r < 150 and g < 150 and b < 150:
                        # But preserve the difference between "Black Stone" and "Line" if needed?
                        # Actually both should be black for max visibility against white bg
                        pixels[x, y] = (0, 0, 0, 255) # Force full black, full opacity
                    
                    # If it's white stone (high value), ensure it's pure white
                    elif r > 200 and g > 200 and b > 200:
                        pixels[x, y] = (255, 255, 255, 255)

        img.save(image_path)
        print(f"Enhanced contrast for: {image_path}")
        
    except Exception as e:
        print(f"Failed to process {image_path}: {e}")

if __name__ == "__main__":
    target_dir = r"c:\Users\lucky\VibeWorks-Yogapro-Win\GORewrite\public\icons"
    # Process all icon sizes
    targets = ["icon16.png", "icon48.png", "icon128.png"]
    
    for filename in targets:
        path = os.path.join(target_dir, filename)
        if os.path.exists(path):
            enhance_contrast(path)
        else:
            print(f"Not found: {path}")
