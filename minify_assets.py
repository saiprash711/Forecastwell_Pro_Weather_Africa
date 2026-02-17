"""
Asset Minification Script
Minifies JavaScript and CSS files for faster loading
Uses rjsmin for JS and rcssmin for CSS (pure Python, no Node.js needed)
"""
import os
import re
import sys
import hashlib
from pathlib import Path

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Try to install minification libraries if not present
try:
    import rjsmin
    import rcssmin
except ImportError:
    print("Installing minification libraries...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'rjsmin', 'rcssmin'])
    import rjsmin
    import rcssmin


def get_file_hash(filepath):
    """Generate a short hash for cache busting"""
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def minify_js(input_path, output_path):
    """Minify JavaScript file"""
    with open(input_path, 'r', encoding='utf-8') as f:
        js_content = f.read()
    
    # Use rjsmin to minify
    minified = rjsmin.jsmin(js_content, keep_bang_comments=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(minified)
    
    original_size = os.path.getsize(input_path)
    minified_size = os.path.getsize(output_path)
    reduction = ((original_size - minified_size) / original_size) * 100
    
    print(f"JS: {input_path.name} -> {output_path.name}")
    print(f"  Size: {original_size:,} -> {minified_size:,} bytes ({reduction:.1f}% reduction)")


def minify_css(input_path, output_path):
    """Minify CSS file"""
    with open(input_path, 'r', encoding='utf-8') as f:
        css_content = f.read()
    
    # Use rcssmin to minify
    minified = rcssmin.cssmin(css_content)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(minified)
    
    original_size = os.path.getsize(input_path)
    minified_size = os.path.getsize(output_path)
    reduction = ((original_size - minified_size) / original_size) * 100
    
    print(f"CSS: {input_path.name} -> {output_path.name}")
    print(f"  Size: {original_size:,} -> {minified_size:,} bytes ({reduction:.1f}% reduction)")


def add_version_comment(filepath, version_hash):
    """Add version comment to minified file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"/* Version: {version_hash} */\n" + content)


def minify_all(static_dir):
    """Minify all JS and CSS files"""
    static_path = Path(static_dir)
    
    js_dir = static_path / 'js'
    css_dir = static_path / 'css'
    
    print("=" * 60)
    print("Minifying Static Assets")
    print("=" * 60)
    
    total_saved = 0
    
    # Minify JavaScript
    if js_dir.exists():
        for js_file in js_dir.glob('*.js'):
            if '.min.js' in str(js_file):
                continue  # Skip already minified files
            
            output_path = js_file.with_name(js_file.stem + '.min.js')
            original_size = os.path.getsize(js_file)
            
            minify_js(js_file, output_path)
            version_hash = get_file_hash(output_path)
            add_version_comment(output_path, version_hash)
            
            minified_size = os.path.getsize(output_path)
            total_saved += original_size - minified_size
    
    # Minify CSS
    if css_dir.exists():
        for css_file in css_dir.glob('*.css'):
            if '.min.css' in str(css_file):
                continue  # Skip already minified files
            
            output_path = css_file.with_name(css_file.stem + '.min.css')
            original_size = os.path.getsize(css_file)
            
            minify_css(css_file, output_path)
            version_hash = get_file_hash(output_path)
            add_version_comment(output_path, version_hash)
            
            minified_size = os.path.getsize(output_path)
            total_saved += original_size - minified_size
    
    print("=" * 60)
    print(f"Total space saved: {total_saved:,} bytes ({total_saved/1024:.1f} KB)")
    print("=" * 60)


if __name__ == '__main__':
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    static_dir = script_dir / 'static'
    
    minify_all(static_dir)
    print("\n✅ Minification complete!")
    print("\n📝 Next steps:")
    print("   1. Update index.html to use .min.js and .min.css files")
    print("   2. Add cache-busting query parameters (?v=HASH)")
    print("   3. Test the dashboard to ensure everything works")
