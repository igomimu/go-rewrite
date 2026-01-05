
import os
from PIL import Image, ImageDraw

def create_go_icon(size, output_path):
    # Draw on a larger canvas (4x) for anti-aliasing quality then downscale
    scale = 8
    canvas_size = size * scale
    
    # Background: White
    img = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Colors
    grid_color = (0, 0, 0, 255) # Pure Black
    black_stone = (0, 0, 0, 255)
    white_stone = (255, 255, 255, 255)
    stone_outline = (0, 0, 0, 255)
    
    # Grid settings
    # 3x3 grid look - Maximum visibility
    grid_count = 3
    cell_size = canvas_size // grid_count
    
    # Line width - Reduced to 3.5%
    line_width = int(canvas_size * 0.035) 
    
    # Draw Grid
    for i in range(grid_count):
        # Vertical
        x = i * cell_size + cell_size // 2
        draw.line([(x, 0), (x, canvas_size)], fill=grid_color, width=line_width)
        # Horizontal
        y = i * cell_size + cell_size // 2
        draw.line([(0, y), (canvas_size, y)], fill=grid_color, width=line_width)

    # Stone radius
    # 0.49 fits well.
    radius = int(cell_size * 0.49) 
    
    def draw_stone(gx, gy, color):
        cx = gx * cell_size + cell_size // 2
        cy = gy * cell_size + cell_size // 2
        
        # Draw stone body (Fill)
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color)
        
        # Outline
        outline_w = max(1, int(canvas_size * 0.015)) 
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], outline=stone_outline, width=outline_w)

    # Stone Placement (Shifted for 3x3 grid)
    # Center is (1,1). The cross fits perfectly: (1,1) center, and (0,1), (2,1), (1,0), (1,2).
    
    # Center (1,1) Black
    draw_stone(1, 1, black_stone)
    # Right (2,1) Black
    draw_stone(2, 1, black_stone)
    # Bottom (1,2) Black
    draw_stone(1, 2, black_stone)
    
    # Top (1,0) White
    draw_stone(1, 0, white_stone)
    # Left (0,1) White
    draw_stone(0, 1, white_stone)

    # Resize
    # LANCZOS is good.
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(output_path)
    print(f"Generated: {output_path}")

if __name__ == "__main__":
    target_dir = r"c:\Users\lucky\VibeWorks-Yogapro-Win\GORewrite\public\icons"
    os.makedirs(target_dir, exist_ok=True)
    
    targets = [16, 48, 128]
    
    for s in targets:
        filename = f"icon{s}.png"
        path = os.path.join(target_dir, filename)
        create_go_icon(s, path)
