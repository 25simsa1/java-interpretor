// =============================================================================
// Linear regression, trained with gradient descent — written entirely in
// tinylang, powered by the grad() engine we built in Step 3.
//
// We have three data points that lie on the line y = 2x + 1:
//     (1, 3)   (2, 5)   (3, 7)
// The model starts knowing nothing (w = 0, b = 0) and should *learn* that
// w -> 2 and b -> 1 just by following the gradient of its error downhill.
// =============================================================================

let w = 0      // weight (slope)    — what we're learning
let b = 0      // bias (intercept)  — what we're learning
let lr = 0.01  // learning rate: how big a step to take each update

repeat 1000 {
  // Prediction error on each data point: (w*x + b) - y
  let e1 = w * 1 + b - 3
  let e2 = w * 2 + b - 5
  let e3 = w * 3 + b - 7

  // Loss = sum of squared errors. Minimizing this fits the line.
  let loss = e1 * e1 + e2 * e2 + e3 * e3

  // Ask the autodiff engine which way reduces the loss...
  let gw = grad(loss, w)
  let gb = grad(loss, b)

  // ...and step the parameters a little in that downhill direction.
  w = w - lr * gw
  b = b - lr * gb
}

// After training, w should be ~2 and b should be ~1.
print(w)
print(b)
