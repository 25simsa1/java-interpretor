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
  // --- new in Step 2 (variables) ---
  IDENTIFIER: "IDENTIFIER", // a name like x, total, my_var
  LET: "LET", // the keyword "let"
  EQUALS: "EQUALS", // =
  SEMICOLON: "SEMICOLON", // ;  (separates statements)
  // --- new in Step 3 (autodiff) ---
  GRAD: "GRAD", // the keyword "grad"
  COMMA: "COMMA", // ,  (separates grad's two arguments)
  // --- new in Step 4 (training) ---
  REPEAT: "REPEAT", // the keyword "repeat"
  PRINT: "PRINT", // the keyword "print"
  LBRACE: "LBRACE", // {  (starts a repeat block)
  RBRACE: "RBRACE", // }  (ends a repeat block)
  EOF: "EOF", // marks the end of input
};

// Words that look like identifiers but are actually reserved by the language.
// When we scan a name we check this table; "let" becomes a LET token, while
// "x" stays an IDENTIFIER. This is the standard way languages handle keywords.
const KEYWORDS = {
  let: TokenType.LET,
  grad: TokenType.GRAD,
  repeat: TokenType.REPEAT,
  print: TokenType.PRINT,
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

// Can this character START an identifier? Letters or underscore (not digits,
// so we never confuse "123" for a name).
function isIdentStart(ch) {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

// Can this character CONTINUE an identifier? Same as above, plus digits — so
// "my_var2" is one name.
function isIdentPart(ch) {
  return isIdentStart(ch) || isDigit(ch);
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
    if (ch === "/") {
      // "//" starts a line comment: skip everything to the end of the line.
      // A single "/" is still the division operator.
      if (source[i + 1] === "/") {
        while (i < source.length && source[i] !== "\n") i++;
        continue;
      }
      tokens.push(makeToken(TokenType.SLASH, "/", i));
      i++;
      continue;
    }
    if (ch === "(") { tokens.push(makeToken(TokenType.LPAREN, "(", i)); i++; continue; }
    if (ch === ")") { tokens.push(makeToken(TokenType.RPAREN, ")", i)); i++; continue; }
    if (ch === "=") { tokens.push(makeToken(TokenType.EQUALS, "=", i)); i++; continue; }
    if (ch === ";") { tokens.push(makeToken(TokenType.SEMICOLON, ";", i)); i++; continue; }
    if (ch === ",") { tokens.push(makeToken(TokenType.COMMA, ",", i)); i++; continue; }
    if (ch === "{") { tokens.push(makeToken(TokenType.LBRACE, "{", i)); i++; continue; }
    if (ch === "}") { tokens.push(makeToken(TokenType.RBRACE, "}", i)); i++; continue; }

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

    // 4. Identifiers and keywords. Like numbers, a name spans several
    //    characters, so we keep advancing while we see identifier characters.
    //    Then we check the keyword table: "let" is special, anything else is
    //    a plain variable name.
    if (isIdentStart(ch)) {
      const start = i;
      while (i < source.length && isIdentPart(source[i])) {
        i++;
      }
      const text = source.slice(start, i);
      const keywordType = KEYWORDS[text]; // undefined if it's not a keyword
      if (keywordType) {
        tokens.push(makeToken(keywordType, text, start));
      } else {
        tokens.push(makeToken(TokenType.IDENTIFIER, text, start));
      }
      continue;
    }

    // 5. Anything else is a character we don't recognize.
    throw new Error(`Lexer error: unexpected character "${ch}" at position ${i}`);
  }

  // Always finish with an EOF token. The parser relies on this sentinel so it
  // never has to check "did we run off the end of the array?" everywhere.
  tokens.push(makeToken(TokenType.EOF, null, i));
  return tokens;
}
