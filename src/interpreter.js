// =============================================================================
// THE EVALUATOR (a.k.a. the interpreter, tree-walker)
// =============================================================================
//
// This is the part that actually computes an answer. The parser handed us a
// tree; we walk it from the bottom up. To evaluate a node we first evaluate
// its children, then combine them.
//
//        +            evaluate(+) =
//       / \             evaluate(12) + evaluate(*)
//     12   *          = 12 + (evaluate(3) * evaluate(4))
//         / \         = 12 + 12
//        3   4        = 24
//
// This style is called a "tree-walking interpreter". It's the most direct way
// to run a language, and it's exactly how the earliest versions of languages
// like Ruby and Python worked.
//
// NEW IN STEP 2: variables. To remember that `x` is 5, we need somewhere to
// store that binding. That place is the "environment" — just a Map from names
// to values. Every evaluate() call now receives the environment so it can both
// read variables (Identifier) and write them (Let).
// =============================================================================

// Create a fresh, empty environment. The REPL keeps one of these alive across
// lines so a `let` typed earlier is still visible later.
export function createEnv() {
  return new Map(); // name (string) -> value (number)
}

export function evaluate(node, env = createEnv()) {
  switch (node.type) {
    // A whole program: run each statement in order, sharing one environment so
    // a `let` in an early statement is visible to later ones. The program's
    // value is the value of its LAST statement (handy for the REPL).
    case "Program": {
      let result = null;
      for (const statement of node.statements) {
        result = evaluate(statement, env);
      }
      return result;
    }

    // `let name = value`: evaluate the right-hand side, then record the binding
    // in the environment. We return the value too, so typing `let x = 5` in the
    // REPL echoes 5.
    case "Let": {
      const value = evaluate(node.value, env);
      env.set(node.name, value);
      return value;
    }

    // A variable reference: look its name up in the environment. If it was
    // never defined, that's a runtime error rather than a silent `undefined`.
    case "Identifier": {
      if (!env.has(node.name)) {
        throw new Error(`Runtime error: undefined variable "${node.name}"`);
      }
      return env.get(node.name);
    }

    // A literal number evaluates to itself. This is the base case that stops
    // the recursion.
    case "Number":
      return node.value;

    // Unary minus: evaluate the operand, then negate it.
    case "Unary": {
      const value = evaluate(node.operand, env);
      if (node.op === "-") return -value;
      throw new Error(`Runtime error: unknown unary operator "${node.op}"`);
    }

    // A binary operation: evaluate BOTH sides first, then apply the operator.
    // Note the recursion — left and right may themselves be whole subtrees, and
    // we pass `env` down so any variables inside them resolve correctly.
    case "Binary": {
      const left = evaluate(node.left, env);
      const right = evaluate(node.right, env);
      switch (node.op) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/":
          if (right === 0) throw new Error("Runtime error: division by zero");
          return left / right;
        default:
          throw new Error(`Runtime error: unknown operator "${node.op}"`);
      }
    }

    default:
      throw new Error(`Runtime error: don't know how to evaluate node type "${node.type}"`);
  }
}
