// =============================================================================
// THE LEXER  (a.k.a. tokenizer / scanner)
// =============================================================================
//
// The lexer's job is the simplest of the three stages: turn a flat string of
// source text into a list of "tokens" — the meaningful chunks of the language.
//
//   input:  "12 + 3 * 4"
//   output: [ NUMBER(12), PLUS, NUMBER(3), STAR, NUMBER(4), EOF ]
//
// It does NOT understand math or precedence — it just groups characters.
// Think of it like splitting an English sentence into words before you try to
// understand the grammar.
// =============================================================================

// The kinds of tokens our language has *so far* (Step 1: arithmetic only).
// We use plain strings as tags — easy to read when debugging.
export const TokenType = {
  NUMBER: "NUMBER",
  PLUS: "PLUS", // +
  MINUS: "MINUS", // -
  STAR: "STAR", // *
  SLASH: "SLASH", // /
  LPAREN: "LPAREN", // (
  RPAREN: "RPAREN", // )
  EOF: "EOF", // marks the end of input
};

// A token is just a small object: what kind it is, and (for numbers) its value.
// We also keep `pos` so error messages can point at where something went wrong.
function makeToken(type, value, pos) {
  return { type, value, pos };
}

// Helper: is this character a digit 0-9?
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

// The main function. Walk the string one character at a time and emit tokens.
export function tokenize(source) {
  const tokens = [];
  let i = 0; // our current position in the string

  while (i < source.length) {
    const ch = source[i];

    // 1. Skip whitespace — it doesn't mean anything in arithmetic.
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // 2. Single-character operators and parentheses.
    //    Each one is a fixed token, so we just record it and move on.
    if (ch === "+") { tokens.push(makeToken(TokenType.PLUS, "+", i)); i++; continue; }
    if (ch === "-") { tokens.push(makeToken(TokenType.MINUS, "-", i)); i++; continue; }
    if (ch === "*") { tokens.push(makeToken(TokenType.STAR, "*", i)); i++; continue; }
    if (ch === "/") { tokens.push(makeToken(TokenType.SLASH, "/", i)); i++; continue; }
    if (ch === "(") { tokens.push(makeToken(TokenType.LPAREN, "(", i)); i++; continue; }
    if (ch === ")") { tokens.push(makeToken(TokenType.RPAREN, ")", i)); i++; continue; }

    // 3. Numbers. A number is one-or-more digits, optionally with a decimal
    //    point and more digits (e.g. 12, 3.14). Because a number spans several
    //    characters, we keep advancing until we run out of digits.
    if (isDigit(ch) || ch === ".") {
      const start = i;
      while (i < source.length && (isDigit(source[i]) || source[i] === ".")) {
        i++;
      }
      const text = source.slice(start, i);
      // Number(".") or Number("1.2.3") would be NaN — catch that early.
      const value = Number(text);
      if (Number.isNaN(value)) {
        throw new Error(`Lexer error: invalid number "${text}" at position ${start}`);
      }
      tokens.push(makeToken(TokenType.NUMBER, value, start));
      continue;
    }

    // 4. Anything else is a character we don't recognize.
    throw new Error(`Lexer error: unexpected character "${ch}" at position ${i}`);
  }

  // Always finish with an EOF token. The parser relies on this sentinel so it
  // never has to check "did we run off the end of the array?" everywhere.
  tokens.push(makeToken(TokenType.EOF, null, i));
  return tokens;
}
