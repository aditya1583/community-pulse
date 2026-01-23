import re
import os

def clean_rtf_to_base64(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # RTF text is often in the format: ... \f0\fs24 \cf0 BASE64_STRING \
    # We want to extract the string after \cf0 or similar.
    # A simple way for these files is to look for the long base64-like string.
    
    # Remove RTF tags and headers
    # This is rough but let's try to find the start of the base64 (usually MII...)
    match = re.search(r'MII[A-Za-z0-9+/= \r\n\\]+', content)
    if not match:
        return None
    
    raw_text = match.group(0)
    # Remove backslashes, newlines, and spaces
    clean_text = re.sub(r'[\r\n\s\\]', '', raw_text)
    return clean_text

base_dir = r"c:\Users\adity\Downloads\App5156\community-pulse\iOS Secrets"
files = ["p12_base64.txt.rtf", "profile_base64.txt.rtf"]

for filename in files:
    path = os.path.join(base_dir, filename)
    clean_b64 = clean_rtf_to_base64(path)
    if clean_b64:
        out_path = os.path.join(base_dir, filename.replace(".txt.rtf", "_clean.txt"))
        with open(out_path, 'w') as f:
            f.write(clean_b64)
        print(f"Cleaned {filename} -> {os.path.basename(out_path)}")
    else:
        print(f"Failed to clean {filename}")
