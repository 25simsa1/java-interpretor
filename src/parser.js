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
//   expression  ->  term  (("+" | "-") term)*       <- lowest precedence
//   term        ->  factor (("*" | "/") factor)*
//   factor      ->  NUMBER | "(" expression ")" | "-" factor   <- highest
//
// Read that grammar top-to-bottom = loosest-to-tightest binding.
// =============================================================================

import { TokenType } from "./lexer.js";

// --- AST node constructors -------------------------------------------------
// Each node is a plain object with a `type` tag. Keeping them as simple data
// (no behavior) means the evaluator can decide what to *do* with each node.

function numberNode(value) {
  return { type: "Number", value };
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

  // Kick off parsing at the lowest-precedence rule...
  const tree = expression();

  // ...and make sure we consumed everything. Leftover tokens mean malformed
  // input like "1 2" or "(1 + 2) 3".
  if (peek().type !== TokenType.EOF) {
    throw new Error(`Parse error: unexpected ${peek().type} at position ${peek().pos}`);
  }

  return tree;
}
