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
// =============================================================================

export function evaluate(node) {
  switch (node.type) {
    // A literal number evaluates to itself. This is the base case that stops
    // the recursion.
    case "Number":
      return node.value;

    // Unary minus: evaluate the operand, then negate it.
    case "Unary": {
      const value = evaluate(node.operand);
      if (node.op === "-") return -value;
      throw new Error(`Runtime error: unknown unary operator "${node.op}"`);
    }

    // A binary operation: evaluate BOTH sides first, then apply the operator.
    // Note the recursion — left and right may themselves be whole subtrees.
    case "Binary": {
      const left = evaluate(node.left);
      const right = evaluate(node.right);
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
