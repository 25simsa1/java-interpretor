
// THE AUTODIFF ENGINE  (reverse-mode automatic differentiation)

// This is the heart of Step 3 — and the same idea that powers PyTorch and
// TensorFlow. The goal: given a formula like  f = x*x*y + y , automatically
// compute its derivatives  df/dx  and  df/dy  — without you doing any calculus
// by hand.
//
// THE KEY INSIGHT
// Instead of computing with plain numbers, we compute with little `Value`
// objects. Each Value remembers not just its number (`data`) but ALSO the
// operation that produced it and which other Values fed into it. Doing a bunch
// of arithmetic therefore quietly builds a graph of how everything was
// computed:
//
//     x ─┐
//        ×──► (x*x) ─┐
//     x ─┘           ×──► (x*x*y) ─┐
//     y ─────────────┘            +──► f
//     y ──────────────────────────┘
//
// The two phases
//   1. Forward:  do the arithmetic normally, recording the graph as you go.
//   2. Backward: start at the output with gradient 1, then walk the graph in
//      reverse, handing each node its share of the gradient using the chain
//      rule from calculus. Every Value ends up knowing df/d(itself).
//
// Each operation knows its own *local* derivative. The chain rule says: to get
// how the final output changes with some input, multiply the local derivatives
// along the path. The backward pass does exactly that multiplication for us.

export class Value {
  // `data` is the actual number. `children` are the Values this one was built
  // from (empty for a leaf like a variable or a literal). `op` is just a label
  // that's handy when printing the graph for debugging.
  constructor(data, children = [], op = "") {
    this.data = data;
    this.grad = 0; // df/d(this) — filled in during the backward pass
    this._prev = children;
    this._op = op;
    // How to push THIS node's gradient back to its children. The default does
    // nothing (correct for leaves); each operation below installs its own.
    this._backward = () => {};
  }

 
  // The backward pass. Call this on the final output (e.g. f.backward()) to
  // fill in `.grad` on every Value that contributed to it.

  backward() {
    // 1. Build a topological order of the graph: every node appears AFTER all
    //    the nodes that feed into it. I'll then process it in reverse, so a
    //    node always has its full gradient before it passes any to its inputs.
    const topo = [];
    const visited = new Set();
    function buildTopo(node) {
      if (visited.has(node)) return;
      visited.add(node);
      for (const child of node._prev) buildTopo(child);
      topo.push(node);
    }
    buildTopo(this);

    // 2. Reset gradients on everything in this graph. Values for variables live
    //    on across multiple grad() calls, so we must clear stale gradients or
    //    they'd accumulate from a previous call.
    for (const node of topo) node.grad = 0;

    // 3. Seed the output: df/df = 1. (The derivative of anything w.r.t. itself.)
    this.grad = 1;

    // 4. Walk in reverse topological order, letting each node distribute its
    //    gradient to its inputs via the chain rule.
    for (let i = topo.length - 1; i >= 0; i--) {
      topo[i]._backward();
    }
  }

  toString() {
    return `Value(${this.data})`;
  }
}

// Convenience constructor so callers can write value(3) instead of new Value(3).
export function value(data) {
  return new Value(data);
}


// The Operations
// Each one does the forward computation, builds the result node, and installs a
// `_backward` that applies that operation's local derivative (the chain rule).
// We use `+=` when accumulating into a child's grad because the same Value can
// feed into a result more than once — e.g. x*x uses x twice, and both paths
// contribute. (That's why df/dx of x*x correctly comes out as 2x.)


// Addition:  out = a + b.  Local derivatives: d/da = 1, d/db = 1.
// So each input just receives the output's gradient unchanged.
export function add(a, b) {
  const out = new Value(a.data + b.data, [a, b], "+");
  out._backward = () => {
    a.grad += out.grad;
    b.grad += out.grad;
  };
  return out;
}

// Subtraction:  out = a - b.  Local derivatives: d/da = 1, d/db = -1.
export function sub(a, b) {
  const out = new Value(a.data - b.data, [a, b], "-");
  out._backward = () => {
    a.grad += out.grad;
    b.grad += -out.grad;
  };
  return out;
}

// Multiplication:  out = a * b.  Local derivatives: d/da = b, d/db = a.
// This is the product rule — each input's gradient is scaled by the OTHER input.
export function mul(a, b) {
  const out = new Value(a.data * b.data, [a, b], "*");
  out._backward = () => {
    a.grad += b.data * out.grad;
    b.grad += a.data * out.grad;
  };
  return out;
}

// Division:  out = a / b.  Local derivatives: d/da = 1/b, d/db = -a/b^2.
export function div(a, b) {
  if (b.data === 0) throw new Error("Runtime error: division by zero");
  const out = new Value(a.data / b.data, [a, b], "/");
  out._backward = () => {
    a.grad += (1 / b.data) * out.grad;
    b.grad += (-a.data / (b.data * b.data)) * out.grad;
  };
  return out;
}

// Negation:  out = -a.  Local derivative: d/da = -1.
export function neg(a) {
  const out = new Value(-a.data, [a], "neg");
  out._backward = () => {
    a.grad += -out.grad;
  };
  return out;
}
