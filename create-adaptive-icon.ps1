# PowerShell script to create adaptive icon with proper padding
# This uses ImageMagick or Windows built-in tools

Write-Host "Creating adaptive icon with proper padding..." -ForegroundColor Cyan

$inputImage = ".\assets\logo-app.png"
$outputImage = ".\assets\adaptive-icon.png"

# Check if ImageMagick is available
$magickExists = Get-Command magick -ErrorAction SilentlyContinue

if ($magickExists) {
    Write-Host "Using ImageMagick to create padded icon..." -ForegroundColor Green
    
    # Create 1024x1024 image with white background and centered logo at 66% size
    # This ensures 17% padding on all sides (safe for all launcher shapes)
    magick convert $inputImage -resize 676x676 -gravity center -background white -extent 1024x1024 $outputImage
    
    Write-Host "Adaptive icon created successfully at: $outputImage" -ForegroundColor Green
} else {
    Write-Host @"
ImageMagick is not installed. 

To create a professional adaptive icon:

OPTION 1: Install ImageMagick and run this script again
   Download from: https://imagemagick.org/script/download.php
   
OPTION 2: Manual creation using image editor:
   1. Open logo-app.png in your favorite image editor (Photoshop, GIMP, Paint.NET)
   2. Create a new 1024x1024px canvas with white background
   3. Resize your logo to 676x676px (66% of 1024)
   4. Center the logo on the canvas (leaving 174px padding on all sides)
   5. Save as: assets/adaptive-icon.png

OPTION 3: Use online tool:
   Visit: https://icon.kitchen/
   - Upload your logo-app.png
   - Select "Adaptive Icons"
   - Adjust padding to 17-20%
   - Download and save as adaptive-icon.png

Why this matters:
Android launchers can display icons in different shapes (circle, rounded square, squircle).
With 17% padding, your logo stays visible in all shapes without being cut off.
"@ -ForegroundColor Yellow
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
