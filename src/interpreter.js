// =============================================================================
// THE EVALUATOR (a.k.a. the interpreter, tree-walker)
// =============================================================================
//
// Walks the AST the parser produced and computes a result, from the bottom up.
//
// BIG CHANGE IN STEP 3: every value flowing through the interpreter is now a
// `Value` object from value.js, not a raw JavaScript number. Why? Because doing
// arithmetic on Values automatically records the computation graph, which is
// what lets us compute gradients later. A literal `5` becomes value(5); `a + b`
// becomes add(a, b); and so on. The numbers come out identical — we've just
// also recorded *how* we got them.
//
// The environment now maps variable names to Value objects. Because a `let`
// stores the SAME Value object that later expressions reference, the graph
// connects across statements — so by the time you call grad(f, x), the Value
// for f still has a path back to the Value for x.
// =============================================================================

import { value, add, sub, mul, div, neg } from "./value.js";

// Create a fresh, empty environment. The REPL keeps one alive across lines so a
// `let` typed earlier is still visible later.
export function createEnv() {
  return new Map(); // name (string) -> Value
}

export function evaluate(node, env = createEnv()) {
  switch (node.type) {
    // A whole program: run each statement in order, sharing one environment.
    // The program's value is the value of its LAST statement.
    case "Program": {
      let result = null;
      for (const statement of node.statements) {
        result = evaluate(statement, env);
      }
      return result;
    }

    // `let name = value`: evaluate the right-hand side to a Value, then record
    // the binding. Storing the Value object (not just its number) is what keeps
    // the computation graph intact for later grad() calls.
    case "Let": {
      const v = evaluate(node.value, env);
      env.set(node.name, v);
      return v;
    }

    // A variable reference: hand back the SAME Value object stored under this
    // name, so it stays wired into the graph.
    case "Identifier": {
      if (!env.has(node.name)) {
        throw new Error(`Runtime error: undefined variable "${node.name}"`);
      }
      return env.get(node.name);
    }

    // `name = value` — reassignment, used for parameter updates like
    // `w = w - lr * gw`. The variable must already exist (use `let` to create).
    //
    // The crucial detail: we store a BRAND-NEW leaf Value holding just the
    // resulting number, throwing away the graph that produced it. This is the
    // equivalent of PyTorch's `.detach()` / `with no_grad()`. Without it, every
    // training step would chain onto the previous one, the graph would grow
    // forever, and gradients would try to flow back through the optimizer's own
    // arithmetic. Detaching keeps each step's gradient about the model, not the
    // update math.
    case "Assign": {
      if (!env.has(node.name)) {
        throw new Error(`Runtime error: cannot assign to undefined variable "${node.name}" (use 'let' first)`);
      }
      const v = evaluate(node.value, env);
      const fresh = value(v.data); // new leaf — detached from the graph
      env.set(node.name, fresh);
      return fresh;
    }

    // `repeat count { body }` — evaluate `count`, then run the body that many
    // times, all sharing the same environment so updates accumulate. Returns
    // the value of the body's last statement on the final pass.
    case "Repeat": {
      const times = Math.trunc(evaluate(node.count, env).data);
      let result = null;
      for (let n = 0; n < times; n++) {
        for (const statement of node.body) {
          result = evaluate(statement, env);
        }
      }
      return result;
    }

    // `print(expr)` — evaluate, show the number, and return the Value so print
    // can still be used inside a larger expression.
    case "Print": {
      const v = evaluate(node.expr, env);
      console.log(v.data);
      return v;
    }

    // A literal number becomes a leaf Value — the starting points of the graph.
    case "Number":
      return value(node.value);

    // Unary minus, via the graph-aware neg() so the gradient flows through it.
    case "Unary": {
      const operand = evaluate(node.operand, env);
      if (node.op === "-") return neg(operand);
      throw new Error(`Runtime error: unknown unary operator "${node.op}"`);
    }

    // A binary operation: evaluate both sides to Values, then combine them with
    // the graph-building ops. (Division-by-zero is checked inside div().)
    case "Binary": {
      const left = evaluate(node.left, env);
      const right = evaluate(node.right, env);
      switch (node.op) {
        case "+": return add(left, right);
        case "-": return sub(left, right);
        case "*": return mul(left, right);
        case "/": return div(left, right);
        default:
          throw new Error(`Runtime error: unknown operator "${node.op}"`);
      }
    }

    // grad(target, variable): the payoff. Evaluate the target expression (which
    // builds/reuses a graph), run the backward pass from it, then read off the
    // gradient that landed on the variable's Value. We return it as a new leaf
    // Value so it can be used in further arithmetic like any other number.
    case "Grad": {
      const target = evaluate(node.target, env);
      const variable = evaluate(node.variable, env);
      target.backward(); // fills in .grad on every Value feeding into target
      return value(variable.grad);
    }

    default:
      throw new Error(`Runtime error: don't know how to evaluate node type "${node.type}"`);
  }
}
