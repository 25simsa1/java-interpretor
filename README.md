# tinylang

A small interpreted language, built from scratch in JavaScript — one stage at a
time. The long-term goal is a usable mini-language with **automatic
differentiation** (the math engine behind machine-learning frameworks like
PyTorch).

## How an interpreter works

Source text flows through three stages:

```
"12 + 3 * 4"  ──tokenize──►  [12, +, 3, *, 4]  ──parse──►   +        ──evaluate──►  24
                                                           / \
   (lexer)                      (parser)                 12  *        (interpreter)
                                                            / \
                                                           3   4
```

- **Lexer** (`src/lexer.js`) — splits text into tokens.
- **Parser** (`src/parser.js`) — builds a tree that captures precedence.
- **Interpreter** (`src/interpreter.js`) — walks the tree and computes a value.
- **Entry point** (`src/index.js`) — ties them together; runs a REPL or one expression.

## Usage

```bash
# Evaluate one expression
node src/index.js "12 + 3 * 4"      # -> 24
node src/index.js "(1 + 2) * -3"    # -> -9

# Or start the interactive REPL
node src/index.js
> 2 + 2
4
```

## Roadmap

- [x] **Step 1** — arithmetic: `+ - * /`, parentheses, unary minus
- [ ] **Step 2** — variables and `let`
- [ ] **Step 3** — reverse-mode automatic differentiation (`grad`)
- [ ] **Step 4** — train a tiny linear-regression model in the language
