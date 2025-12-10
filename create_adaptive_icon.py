# Python script to create adaptive icon with proper padding
from PIL import Image, ImageDraw
import os

print("Creating adaptive icon with proper padding...")

input_path = "assets/logo-app.png"
output_path = "assets/adaptive-icon.png"

try:
    # Open the original logo
    logo = Image.open(input_path)
    
    # Create a new 1024x1024 canvas with white background
    canvas_size = 1024
    logo_size = 676  # 66% of 1024 (provides 17% padding on all sides)
    
    # Create white canvas
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (255, 255, 255, 255))
    
    # Resize logo to fit the safe zone
    logo_resized = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Calculate position to center the logo
    position = ((canvas_size - logo_size) // 2, (canvas_size - logo_size) // 2)
    
    # Paste logo onto canvas
    if logo_resized.mode == 'RGBA':
        canvas.paste(logo_resized, position, logo_resized)
    else:
        canvas.paste(logo_resized, position)
    
    # Save the result
    canvas.save(output_path, 'PNG')
    
    print(f"✅ Adaptive icon created successfully!")
    print(f"   Saved to: {output_path}")
    print(f"   Size: {canvas_size}x{canvas_size}px")
    print(f"   Logo size: {logo_size}x{logo_size}px (66%)")
    print(f"   Padding: 174px on all sides (17%)")
    
except Exception as e:
    print(f"❌ Error creating adaptive icon: {e}")
    print("\nAlternative: Use online tool https://icon.kitchen/ to create your adaptive icon")
