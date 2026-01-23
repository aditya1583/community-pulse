#!/usr/bin/env python3
"""Extract XML plist from a provisioning profile (PKCS#7 signed data)."""
import sys
import re

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <input.mobileprovision> <output.plist>")
    sys.exit(1)

input_file = sys.argv[1]
output_file = sys.argv[2]

with open(input_file, 'rb') as f:
    data = f.read()

print(f"Read {len(data)} bytes from {input_file}")

# Find XML plist embedded in binary PKCS#7 data
# Simple pattern: from <?xml to </plist> (greedy to get last </plist>)
pattern = rb'<\?xml.*</plist>'
match = re.search(pattern, data, re.DOTALL)

if match:
    xml_content = match.group(0)
    print(f"Found XML plist: {len(xml_content)} bytes at offset {match.start()}")
    with open(output_file, 'wb') as f:
        f.write(xml_content)
    print(f"Wrote to {output_file}")
    sys.exit(0)
else:
    print("ERROR: Could not find XML plist in data")
    # Debug info
    if b'<?xml' in data:
        idx = data.index(b'<?xml')
        print(f"Found <?xml at offset {idx}")
        sample = data[idx:idx+100]
        print(f"Start sample: {sample}")
    else:
        print("NO <?xml found in data!")

    if b'</plist>' in data:
        idx = data.rindex(b'</plist>')  # Find LAST occurrence
        print(f"Found </plist> at offset {idx}")
    else:
        print("NO </plist> found in data!")
        # Show last 200 bytes to see what's there
        print(f"Last 200 bytes: {data[-200:]}")

    # Also show file size breakdown
    print(f"Total file size: {len(data)} bytes")
    sys.exit(1)
