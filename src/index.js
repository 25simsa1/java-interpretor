#!/usr/bin/env node
// =============================================================================
// ENTRY POINT
// =============================================================================
//
// Wires the three stages together:  text -> tokenize -> parse -> evaluate.
//
// Two ways to use it:
//   1. One-shot:   node src/index.js "2 + 3 * 4"
//   2. Interactive REPL (Read-Eval-Print-Loop):  node src/index.js
//
// A REPL is the prompt you get in tools like the Python or Node shell: type an
// expression, see its value, repeat.
// =============================================================================

import readline from "node:readline";
import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { evaluate } from "./interpreter.js";

// Run a single line of source through all three stages. Errors from any stage
// are caught here so one bad line doesn't crash the whole REPL.
function run(source) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  return evaluate(ast);
}

function main() {
  // Everything after "node src/index.js" — if the user passed an expression,
  // evaluate it once and exit.
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const source = args.join(" ");
    try {
      console.log(run(source));
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  // No arguments -> start the interactive REPL.
  console.log("tinylang v0.1 — arithmetic. Type an expression, or Ctrl+C to quit.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
  rl.prompt();

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      try {
        console.log(run(trimmed));
      } catch (err) {
        // Show the error but keep the REPL alive.
        console.error(err.message);
      }
    }
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nbye!");
    process.exit(0);
  });
}

main();
