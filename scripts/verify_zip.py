import zipfile
import json
import re
import sys
import os

def verify_zip(zip_path):
    if not os.path.exists(zip_path):
        print(f"❌ Error: File not found: {zip_path}")
        return

    print(f"🔍 Verifying: {zip_path}")
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            # 1. Check manifest.json
            if 'manifest.json' in z.namelist():
                with z.open('manifest.json') as f:
                    manifest = json.load(f)
                    version = manifest.get('version', 'Unknown')
                    name = manifest.get('name', 'Unknown')
                    print(f"📄 manifest.json version: {version}")
                    print(f"🏷️  manifest.json name:    {name}")
            else:
                print("❌ manifest.json not found in zip!")

            # 2. Check main.js for version string
            if 'main.js' in z.namelist():
                with z.open('main.js') as f:
                    content = f.read().decode('utf-8', errors='ignore')
                    # Look for vX.X.X pattern
                    matches = re.findall(r'v\d+\.\d+\.\d+', content)
                    if matches:
                        # Taking the most frequent or first match? Usually just printing found ones.
                        # Since we expect v2.0.2, let's limit output.
                        unique_versions = sorted(list(set(matches)))
                        print(f"💻 main.js version strings found: {unique_versions}")
                    else:
                        print("⚠️  No 'vX.X.X' version string found in main.js")
            else:
                print("❌ main.js not found in zip!")

    except zipfile.BadZipFile:
        print("❌ Error: Invalid zip file")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 verify_zip.py <zip_file>")
    else:
        verify_zip(sys.argv[1])
