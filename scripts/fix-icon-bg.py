#!/usr/bin/env python3
"""
修复图标 - 添加浅色背景使其在深色背景上可见
"""

from PIL import Image, ImageDraw
import os
import subprocess

ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
SOURCE_ICON = os.path.join(ASSETS_DIR, 'icon-512.png')
ICONSET_DIR = os.path.join(ASSETS_DIR, 'icon.iconset')

# macOS iconset 尺寸
ICONSET_SIZES = [
    (16, 1), (16, 2),
    (32, 1), (32, 2),
    (128, 1), (128, 2),
    (256, 1), (256, 2),
    (512, 1), (512, 2),
]

PNG_SIZES = [16, 32, 48, 64, 128, 256, 512]

def create_icon_with_background(source_path, output_path, canvas_size):
    """创建带浅色背景的图标"""
    # 打开源图标
    source = Image.open(source_path).convert('RGBA')
    
    # 图标尺寸（留出边距）
    padding_ratio = 0.08
    icon_size = int(canvas_size * (1 - padding_ratio * 2))
    
    # 缩放图标
    resized = source.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    # 创建带浅色背景的画布（淡灰色，接近白色）
    # 使用 #F5F5F7 类似 Apple 风格的浅灰色
    bg_color = (245, 245, 247, 255)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    
    # 创建圆角矩形背景
    bg_size = int(canvas_size * 0.85)  # 背景大小
    bg_offset = (canvas_size - bg_size) // 2
    corner_radius = int(bg_size * 0.22)  # 圆角半径，约 22%
    
    # 绘制圆角矩形背景
    bg_layer = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bg_layer)
    draw.rounded_rectangle(
        [bg_offset, bg_offset, bg_offset + bg_size, bg_offset + bg_size],
        radius=corner_radius,
        fill=bg_color
    )
    
    # 合成背景
    canvas = Image.alpha_composite(canvas, bg_layer)
    
    # 计算图标居中位置
    icon_offset = (canvas_size - icon_size) // 2
    
    # 将图标粘贴到画布中央
    canvas.paste(resized, (icon_offset, icon_offset), resized)
    
    # 保存
    canvas.save(output_path, 'PNG')
    return True

def main():
    print('🎨 修复图标背景...\n')
    
    os.makedirs(ICONSET_DIR, exist_ok=True)
    
    if not os.path.exists(SOURCE_ICON):
        print(f'❌ 源图标不存在: {SOURCE_ICON}')
        return False
    
    # 生成 iconset
    print('📁 生成 iconset...')
    for base_size, scale in ICONSET_SIZES:
        output_size = base_size * scale
        suffix = f'@{scale}x' if scale > 1 else ''
        filename = f'icon_{base_size}x{base_size}{suffix}.png'
        output_path = os.path.join(ICONSET_DIR, filename)
        
        try:
            create_icon_with_background(SOURCE_ICON, output_path, output_size)
            print(f'  ✅ {filename}')
        except Exception as e:
            print(f'  ❌ {filename}: {e}')
    
    # 清除扩展属性
    print('\n🧹 清除扩展属性...')
    for f in os.listdir(ICONSET_DIR):
        filepath = os.path.join(ICONSET_DIR, f)
        subprocess.run(['xattr', '-c', filepath], capture_output=True)
    
    # 生成 icns
    print('\n📦 生成 icon.icns...')
    icns_path = os.path.join(ASSETS_DIR, 'icon.icns')
    try:
        result = subprocess.run(
            ['iconutil', '-c', 'icns', ICONSET_DIR, '-o', icns_path],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print('  ✅ icon.icns 生成成功')
        else:
            print(f'  ❌ 失败: {result.stderr}')
    except Exception as e:
        print(f'  ❌ 异常: {e}')
    
    # 生成其他 PNG
    print('\n🖼️  更新 PNG 图标...')
    for size in PNG_SIZES:
        output_path = os.path.join(ASSETS_DIR, f'icon-{size}.png')
        try:
            create_icon_with_background(SOURCE_ICON, output_path, size)
            print(f'  ✅ icon-{size}.png')
        except Exception as e:
            print(f'  ❌ icon-{size}.png: {e}')
    
    print('\n✨ 完成！请重新构建应用。')
    return True

if __name__ == '__main__':
    main()
