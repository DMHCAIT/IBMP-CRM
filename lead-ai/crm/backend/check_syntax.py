import ast
import sys

try:
    with open('main.py', 'r') as f:
        code = f.read()
    ast.parse(code)
    print("✅ No syntax errors")
    sys.exit(0)
except SyntaxError as e:
    print(f"❌ Syntax error at line {e.lineno}: {e.msg}")
    print(f"   {e.text}")
    sys.exit(1)
