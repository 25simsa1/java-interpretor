#!/usr/bin/env node
// =============================================================================
// ENTRY POINT
// =============================================================================
//
// Wires the three stages together:  text -> tokenize -> parse -> evaluate.
//
// Three ways to use it:
//   1. Run a script file:  node src/index.js examples/linear_regression.tl
//   2. One-shot expr:      node src/index.js "2 + 3 * 4"
//   3. Interactive REPL:   node src/index.js
//
// A REPL is the prompt you get in tools like the Python or Node shell: type an
// expression, see its value, repeat.
// =============================================================================

import readline from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { evaluate, createEnv } from "./interpreter.js";

// Run a source string through all three stages, using the given environment so
// variables defined earlier stay available. Errors from any stage propagate to
// the caller, which decides whether to keep going (REPL) or exit (one-shot).
function run(source, env) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  return evaluate(ast, env);
}

// The evaluator returns Value objects (or null for an empty program). Pull out
// the plain number for display.
function format(result) {
  return result === null ? "" : result.data;
}

function main() {
  // Everything after "node src/index.js" — if the user passed an expression,
  // evaluate it once and exit.
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // If the single argument names a file that exists, run it as a script. Its
    // own print(...) statements produce the output, so we don't auto-print the
    // final value here (that would be noise after a training loop).
    if (args.length === 1 && existsSync(args[0])) {
      try {
        run(readFileSync(args[0], "utf8"), createEnv());
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
      return;
    }

    // Otherwise treat the arguments as a one-shot expression and print its value.
    const source = args.join(" ");
    try {
      console.log(format(run(source, createEnv())));
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  // No arguments -> start the interactive REPL.
  console.log("tinylang v0.4 — arithmetic, variables, grad(), repeat, print. Type code, or Ctrl+C to quit.");
  // One environment shared across every line, so `let x = 5` on one line is
  // still in scope when you type `x * x` on the next.
  const env = createEnv();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
  rl.prompt();

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      try {
        console.log(format(run(trimmed, env)));
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
