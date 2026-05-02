with open('main.py', 'r') as f:
    content = f.read()

# Count triple quotes
import re
triple_quotes = re.findall(r'"""', content)
print(f"Total triple quotes: {len(triple_quotes)}")
print(f"Should be even for balanced: {len(triple_quotes) % 2 == 0}")

if len(triple_quotes) % 2 != 0:
    print("\n❌ UNBALANCED: Odd number of triple quotes!")
    
    # Find the line numbers
    lines = content.split('\n')
    positions = []
    for i, line in enumerate(lines, 1):
        if '"""' in line:
            positions.append((i, line.count('"""')))
    
    print("\nAll triple quote locations:")
    balance = 0
    for line_num, count in positions:
        balance += count
        marker = " ⚠️ UNBALANCED" if balance % 2 != 0 else ""
        print(f"Line {line_num}: {count} quotes, balance={balance}{marker}")
else:
    print("\n✅ Triple quotes are balanced")
