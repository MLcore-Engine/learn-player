#!/usr/bin/env python3
"""
修复 macOS 图标 - 添加适当的边距
macOS 图标规范要求图标内容周围有约 10% 的透明边距
"""

from PIL import Image
import os
import subprocess

# 配置
ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
SOURCE_ICON = os.path.join(ASSETS_DIR, 'icon-512.png')
ICONSET_DIR = os.path.join(ASSETS_DIR, 'icon.iconset')
PADDING_RATIO = 0.12  # 12% 边距，让图标看起来更舒适

# macOS iconset 尺寸
ICONSET_SIZES = [
    (16, 1), (16, 2),
    (32, 1), (32, 2),
    (128, 1), (128, 2),
    (256, 1), (256, 2),
    (512, 1), (512, 2),
]

# 额外的 PNG 尺寸
PNG_SIZES = [16, 32, 48, 64, 128, 256, 512]

def create_padded_icon(source_path, output_path, canvas_size, padding_ratio=0.12):
    """创建带边距的图标"""
    # 打开源图标
    source = Image.open(source_path).convert('RGBA')
    
    # 计算图标在画布上的实际尺寸
    icon_size = int(canvas_size * (1 - padding_ratio * 2))
    
    # 缩放图标
    resized = source.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    # 创建透明画布
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    
    # 计算居中位置
    offset = (canvas_size - icon_size) // 2
    
    # 将图标粘贴到画布中央
    canvas.paste(resized, (offset, offset), resized)
    
    # 保存
    canvas.save(output_path, 'PNG')
    return True

def main():
    print('🎨 开始修复 macOS 图标...\n')
    
    # 确保目录存在
    os.makedirs(ICONSET_DIR, exist_ok=True)
    
    # 检查源文件
    if not os.path.exists(SOURCE_ICON):
        print(f'❌ 源图标不存在: {SOURCE_ICON}')
        return False
    
    # 生成 iconset 中的所有尺寸
    print('📁 生成 iconset 文件...')
    for base_size, scale in ICONSET_SIZES:
        output_size = base_size * scale
        suffix = f'@{scale}x' if scale > 1 else ''
        filename = f'icon_{base_size}x{base_size}{suffix}.png'
        output_path = os.path.join(ICONSET_DIR, filename)
        
        try:
            create_padded_icon(SOURCE_ICON, output_path, output_size, PADDING_RATIO)
            print(f'  ✅ {filename} ({output_size}x{output_size})')
        except Exception as e:
            print(f'  ❌ {filename}: {e}')
    
    # 生成 .icns 文件
    print('\n📦 生成 icon.icns...')
    icns_path = os.path.join(ASSETS_DIR, 'icon.icns')
    try:
        subprocess.run(['iconutil', '-c', 'icns', ICONSET_DIR, '-o', icns_path], check=True)
        print(f'  ✅ icon.icns 生成成功')
    except subprocess.CalledProcessError as e:
        print(f'  ❌ 生成失败: {e}')
    
    # 生成其他 PNG 尺寸
    print('\n🖼️  更新 PNG 图标...')
    for size in PNG_SIZES:
        output_path = os.path.join(ASSETS_DIR, f'icon-{size}.png')
        try:
            create_padded_icon(SOURCE_ICON, output_path, size, PADDING_RATIO)
            print(f'  ✅ icon-{size}.png')
        except Exception as e:
            print(f'  ❌ icon-{size}.png: {e}')
    
    print('\n✨ 图标修复完成！')
    print('💡 请运行以下命令重新构建应用:')
    print('   npm run build:mac')
    
    return True

if __name__ == '__main__':
    main()
