import os
from PIL import Image, ImageEnhance, ImageFilter

# Configuration
SOURCE_PATH = "/home/mimura/.gemini/antigravity/brain/2c069eec-8ad4-4b69-bfa0-90a5395e1ec3/uploaded_image_1766725838378.png"
DEST_DIR = "/home/mimura/projects/GORewrite/public/icons"
SIZES = [128, 48, 16]

def generate_icons():
    if not os.path.exists(SOURCE_PATH):
        print(f"Error: Source file not found at {SOURCE_PATH}")
        return

    try:
        # Open the source image
        with Image.open(SOURCE_PATH) as img:
            print(f"Loaded source image: {img.size} mode={img.mode}")

            # Ensure destination directory exists
            os.makedirs(DEST_DIR, exist_ok=True)

            # Generate each size
            for size in SIZES:
                # Use Lanczos filter for high quality downsampling
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                
                # Apply sharpening for small sizes to prevent blurriness
                if size <= 48:
                    # Boost contrast slightly
                    enhancer = ImageEnhance.Contrast(resized_img)
                    resized_img = enhancer.enhance(1.2) # 20% more contrast
                    
                    # Apply sharpening
                    # Repeat sharpening for very small 16px
                    resized_img = resized_img.filter(ImageFilter.UnsharpMask(radius=1, percent=150, threshold=3))
                
                dest_path = os.path.join(DEST_DIR, f"icon{size}.png")
                resized_img.save(dest_path, "PNG")
                print(f"Generated {dest_path} ({size}x{size}) with sharpening")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_icons()
