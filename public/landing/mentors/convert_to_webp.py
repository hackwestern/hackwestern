from PIL import Image
import os

current_dir = os.getcwd()

for filename in os.listdir(current_dir):
    file_path = os.path.join(current_dir, filename)

    if os.path.isfile(file_path) and filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        print(f"Converting {filename} to WebP...")
        with Image.open(file_path) as img:
            webp_filename = os.path.splitext(filename)[0] + ".webp"
            webp_path = os.path.join(current_dir, webp_filename)
            img.save(webp_path, format="WEBP")
            print(f"Converted {filename} to {webp_filename}")