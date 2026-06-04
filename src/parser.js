// =============================================================================
// THE PARSER
// =============================================================================
//
// The lexer gave us a flat list of tokens. But "12 + 3 * 4" is not flat in
// meaning — multiplication binds tighter than addition, so it really means
// "12 + (3 * 4)". The parser's job is to turn the flat token list into a TREE
// (an "Abstract Syntax Tree", or AST) that captures that structure:
//
//        +
//       / \
//     12   *
//         / \
//        3   4
//
// The evaluator (next file) will walk this tree to compute the answer.
//
// We use a technique called "recursive descent": one function per level of
// precedence, and the functions call each other. Lower-precedence operators
// (like +) are handled by the OUTER functions; higher-precedence operators
// (like *) by the INNER ones. That ordering is exactly what makes * bind
// tighter than +.
//
//   program     ->  statement (";" statement)* ";"?       <- whole input
//   statement   ->  "let" IDENTIFIER "=" expression | expression
//   expression  ->  term  (("+" | "-") term)*             <- lowest precedence
//   term        ->  factor (("*" | "/") factor)*
//   factor      ->  NUMBER | IDENTIFIER | "grad" "(" expression "," expression ")"
//                 | "(" expression ")" | "-" factor              <- highest
//
// Read the expression/term/factor part top-to-bottom = loosest-to-tightest
// binding. The program/statement rules on top are the new Step 2 structure:
// the input is now a *list* of statements, not a single expression.
// =============================================================================

import { TokenType } from "./lexer.js";

// --- AST node constructors -------------------------------------------------
// Each node is a plain object with a `type` tag. Keeping them as simple data
// (no behavior) means the evaluator can decide what to *do* with each node.

function numberNode(value) {
  return { type: "Number", value };
}
// A whole program: a list of statements run top to bottom.
function programNode(statements) {
  return { type: "Program", statements };
}
// `let name = value` — binds a name to the result of an expression.
function letNode(name, value) {
  return { type: "Let", name, value };
}
// A reference to a variable by name, e.g. the `x` in `x * x`.
function identifierNode(name) {
  return { type: "Identifier", name };
}
// `grad(target, variable)` — asks for the derivative of `target` with respect
// to `variable`, e.g. grad(f, x).
function gradNode(target, variable) {
  return { type: "Grad", target, variable };
}
// `name = value` — reassign an existing variable (used for parameter updates).
function assignNode(name, value) {
  return { type: "Assign", name, value };
}
// `repeat count { body }` — run a block of statements `count` times.
function repeatNode(count, body) {
  return { type: "Repeat", count, body };
}
// `print(expr)` — evaluate and display a value (handy for watching training).
function printNode(expr) {
  return { type: "Print", expr };
}
function binaryNode(op, left, right) {
  return { type: "Binary", op, left, right }; // op is "+", "-", "*", or "/"
}
function unaryNode(op, operand) {
  return { type: "Unary", op, operand }; // op is "-" (negation)
}

// --- The parser itself -----------------------------------------------------

export function parse(tokens) {
  let pos = 0; // index of the token we're currently looking at

  // Look at the current token without consuming it.
  function peek() {
    return tokens[pos];
  }

  // Consume the current token and return it (advance the cursor).
  function advance() {
    return tokens[pos++];
  }

  // If the current token is `type`, consume it and return true. Otherwise
  // leave it alone and return false. Handy for "is there a + next?" checks.
  function match(type) {
    if (peek().type === type) {
      advance();
      return true;
    }
    return false;
  }

  // Consume a token we *require* to be there; error if it isn't.
  function expect(type, message) {
    if (peek().type !== type) {
      throw new Error(`Parse error: ${message} (got ${peek().type} at position ${peek().pos})`);
    }
    return advance();
  }

  // expression -> term (("+" | "-") term)*
  // Parse a term, then keep folding in any +/- terms that follow. The loop is
  // what turns "1 - 2 - 3" into ((1 - 2) - 3) — left-to-right, as math expects.
  function expression() {
    let node = term();
    while (peek().type === TokenType.PLUS || peek().type === TokenType.MINUS) {
      const op = advance().value; // "+" or "-"
      const right = term();
      node = binaryNode(op, node, right);
    }
    return node;
  }

  // term -> factor (("*" | "/") factor)*
  // Same shape as expression(), but for * and /. Because term() is called from
  // inside expression(), a whole "3 * 4" gets grouped before the + ever sees it.
  function term() {
    let node = factor();
    while (peek().type === TokenType.STAR || peek().type === TokenType.SLASH) {
      const op = advance().value; // "*" or "/"
      const right = factor();
      node = binaryNode(op, node, right);
    }
    return node;
  }

  // factor -> NUMBER | "(" expression ")" | "-" factor
  // The "atoms" of an expression, plus parentheses and unary minus.
  function factor() {
    const tok = peek();

    // A literal number.
    if (tok.type === TokenType.NUMBER) {
      advance();
      return numberNode(tok.value);
    }

    // A variable reference, e.g. the `x` in `x * x`. The evaluator will look
    // up its value at run time.
    if (tok.type === TokenType.IDENTIFIER) {
      advance();
      return identifierNode(tok.value);
    }

    // grad(target, variable) — the only "function call" in the language so far,
    // so we parse it as its own special form: keyword, '(', expression, ',',
    // expression, ')'. Both arguments are full expressions, so grad(x*x, x)
    // works just as well as grad(f, x).
    if (tok.type === TokenType.GRAD) {
      advance(); // consume "grad"
      expect(TokenType.LPAREN, "expected '(' after 'grad'");
      const target = expression();
      expect(TokenType.COMMA, "expected ',' between grad's two arguments");
      const variable = expression();
      expect(TokenType.RPAREN, "expected ')' to close grad(...)");
      return gradNode(target, variable);
    }

    // print(expr) — another built-in call, shaped like grad but with one arg.
    // It's an expression so it can appear anywhere a value can.
    if (tok.type === TokenType.PRINT) {
      advance(); // consume "print"
      expect(TokenType.LPAREN, "expected '(' after 'print'");
      const expr = expression();
      expect(TokenType.RPAREN, "expected ')' to close print(...)");
      return printNode(expr);
    }

    // Unary minus, e.g. "-5" or "-(2 + 3)". It recurses into factor() so that
    // "-2 * 3" parses as "(-2) * 3", not "-(2 * 3)" — negation binds tightly.
    if (tok.type === TokenType.MINUS) {
      advance();
      return unaryNode("-", factor());
    }

    // Parentheses: re-enter at the top of the grammar, then require a ")".
    // This is the recursion that lets expressions nest to any depth.
    if (tok.type === TokenType.LPAREN) {
      advance();
      const inner = expression();
      expect(TokenType.RPAREN, "expected ')' to close '('");
      return inner;
    }

    throw new Error(`Parse error: unexpected ${tok.type} at position ${tok.pos}`);
  }

  // statement -> "let" IDENTIFIER "=" expression
  //            |  IDENTIFIER "=" expression           (reassignment)
  //            |  "repeat" expression "{" statement* "}"
  //            |  expression
  // A statement is one "instruction".
  function statement() {
    // let NAME = value  — a new binding.
    if (peek().type === TokenType.LET) {
      advance(); // consume "let"
      const name = expect(TokenType.IDENTIFIER, "expected a variable name after 'let'").value;
      expect(TokenType.EQUALS, "expected '=' after the variable name");
      const value = expression();
      return letNode(name, value);
    }

    // repeat COUNT { ... }  — a loop. The count is any expression.
    if (peek().type === TokenType.REPEAT) {
      advance(); // consume "repeat"
      const count = expression();
      expect(TokenType.LBRACE, "expected '{' to start the repeat block");
      const body = statementList(TokenType.RBRACE);
      expect(TokenType.RBRACE, "expected '}' to end the repeat block");
      return repeatNode(count, body);
    }

    // NAME = value  — reassignment. We distinguish it from a bare expression
    // that merely starts with a name (like `x * 2`) by peeking one token ahead:
    // an identifier immediately followed by '=' means assignment.
    if (peek().type === TokenType.IDENTIFIER && tokens[pos + 1] && tokens[pos + 1].type === TokenType.EQUALS) {
      const name = advance().value; // the identifier
      advance(); // the '='
      const value = expression();
      return assignNode(name, value);
    }

    // Otherwise it's just an expression.
    return expression();
  }

  // Parse a run of statements until we hit `endType` (either RBRACE for a block
  // or EOF for the whole program). Semicolons between statements are optional —
  // a newline-separated script and a `a; b; c` one-liner both work — because a
  // block-terminating `}` already tells us where each statement ends.
  function statementList(endType) {
    const statements = [];
    while (peek().type !== endType && peek().type !== TokenType.EOF) {
      statements.push(statement());
      // Eat a separating ';' if present; otherwise just continue.
      if (peek().type === TokenType.SEMICOLON) advance();
    }
    return statements;
  }

  // program -> statement* EOF  (the new top level)
  const program = programNode(statementList(TokenType.EOF));

  // After the program there should be nothing but EOF left.
  if (peek().type !== TokenType.EOF) {
    throw new Error(`Parse error: unexpected ${peek().type} at position ${peek().pos}`);
  }

  return program;
}
