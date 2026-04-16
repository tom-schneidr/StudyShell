import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    open_braces = content.count('{')
    close_braces = content.count('}')
    open_parens = content.count('(')
    close_parens = content.count(')')
    
    print(f"Braces: Open={open_braces}, Close={close_braces}")
    print(f"Parens: Open={open_parens}, Close={close_parens}")
    
    if open_braces != close_braces:
        print("ERROR: Imbalanced braces!")
    if open_parens != close_parens:
        print("ERROR: Imbalanced parentheses!")

if __name__ == "__main__":
    check_braces(sys.argv[1])
