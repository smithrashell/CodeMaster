#!/usr/bin/env python3
"""
Script to fix no-inner-declarations ESLint errors by converting
function declarations to const declarations.
"""

import re

def fix_function_declarations(file_path):
    """Convert function declarations to const declarations."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified_count = 0

    for i in range(len(lines)):
        line = lines[i]

        # Match async function declarations
        async_match = re.match(r'^(\s*)async function (\w+)\((.*?)\)\s*\{', line)
        if async_match:
            indent = async_match.group(1)
            func_name = async_match.group(2)
            params = async_match.group(3)
            lines[i] = f'{indent}const {func_name} = async function({params}) {{\n'
            modified_count += 1
            continue

        # Match regular function declarations
        func_match = re.match(r'^(\s*)function (\w+)\((.*?)\)\s*\{', line)
        if func_match:
            indent = func_match.group(1)
            func_name = func_match.group(2)
            params = func_match.group(3)
            lines[i] = f'{indent}const {func_name} = function({params}) {{\n'
            modified_count += 1
            continue

    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    return modified_count

if __name__ == '__main__':
    file_path = r'C:\Users\rashe\projects\codingprojects\codemaster\chrome-extension-app\src\background\index.js'
    count = fix_function_declarations(file_path)
    print(f'Fixed {count} function declarations')
