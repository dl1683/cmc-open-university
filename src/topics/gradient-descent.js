// Gradient descent: roll downhill on the loss curve, one learning-rate-sized
// step at a time. The loop that trains every neural network.

import { plotState, parseNumber, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-descent',
  title: 'Gradient Descent',
  category: 'AI & ML',
  summary: 'Follow the slope downhill to minimize loss — the algorithm that trains every neural network.',
  controls: [
    { id: 'start', label: 'Start weight w', type: 'number', defaultValue: '-4' },
    { id: 'lr', label: 'Learning rate', type: 'select', options: ['0.1', '0.35', '0.8', '1.05 (too big!)'], defaultValue: '0.35' },
  ],
  run,
};

// A toy loss with its minimum at w = 3. Real losses have billions of
// dimensions, but the picture — and the update rule — are exactly this.
const loss = (w) => (w - 3) ** 2 + 1;
const gradient = (w) => 2 * (w - 3);

export function* run(input) {
  const start = parseNumber(input.start, { label: 'a start weight' });
  if (Math.abs(start - 3) > 12) throw new InputError('Start between −9 and 15 so the curve stays visible.');
  const lr = parseFloat(input.lr);

  const trajectory = [start];
  let w = start;
  for (let i = 0; i < 8 && Math.abs(gradient(w)) > 0.05; i += 1) {
    w -= lr * gradient(w);
    trajectory.push(w);
  }

  const xs = [...trajectory, -2, 8, 3];
  const lo = Math.min(...xs) - 1;
  const hi = Math.max(...xs) + 1;
  const curvePoints = Array.from({ length: 61 }, (_, i) => {
    const x = lo + (i / 60) * (hi - lo);
    return { x, y: loss(x) };
  });
  const axes = { x: { label: 'weight w' }, y: { label: 'loss' } };
  const curve = { id: 'loss', label: 'loss(w)', points: curvePoints };

  const frame = (upto, vectors = []) => plotState({
    axes,
    series: [curve],
    markers: trajectory.slice(0, upto + 1).map((tw, i) => ({
      id: `w${i}`, x: tw, y: loss(tw), label: i === upto ? `w = ${tw.toFixed(2)}` : '',
    })),
    vectors,
  });

  yield {
    state: frame(0),
    highlight: { active: ['w0'] },
    explanation: `The curve is the LOSS — how wrong the model is for each possible weight w. Training = finding the bottom. We cannot see the whole curve (in real models it has billions of dimensions); we can only feel the SLOPE under our feet. Start at w = ${start}.`,
  };

  for (let i = 1; i < trajectory.length; i += 1) {
    const prev = trajectory[i - 1];
    const grad = gradient(prev);
    yield {
      state: frame(i - 1, [{
        id: 'step',
        from: { x: prev, y: loss(prev) },
        to: { x: trajectory[i], y: loss(trajectory[i]) },
        label: `−lr × ${grad.toFixed(2)}`,
      }]),
      highlight: { active: [`w${i - 1}`] },
      explanation: `The gradient (slope) at w = ${prev.toFixed(2)} is ${grad.toFixed(2)} — ${grad > 0 ? 'uphill to the right, so step LEFT' : 'uphill to the left, so step RIGHT'}. Update rule: w ← w − learning_rate × gradient = ${prev.toFixed(2)} − ${lr} × ${grad.toFixed(2)} = ${trajectory[i].toFixed(2)}.`,
      invariant: 'Always step OPPOSITE the gradient — that is the steepest way down.',
    };
    yield {
      state: frame(i),
      highlight: { active: [`w${i}`], visited: trajectory.slice(0, i).map((_, k) => `w${k}`) },
      explanation: `Now at w = ${trajectory[i].toFixed(2)}, loss ${loss(trajectory[i]).toFixed(2)} ${loss(trajectory[i]) < loss(prev) ? '— lower than before. Progress.' : '— HIGHER than before! The step overshot the valley.'}`,
    };
  }

  const final = trajectory[trajectory.length - 1];
  const converged = Math.abs(gradient(final)) <= 0.05 || Math.abs(final - 3) < Math.abs(start - 3);
  yield {
    state: frame(trajectory.length - 1),
    highlight: { found: [`w${trajectory.length - 1}`] },
    explanation: converged
      ? `Settled at w = ${final.toFixed(2)} (the true minimum is 3). Notice the steps shrank automatically near the bottom — flatter slope, smaller gradient, smaller step. Replace this one weight with billions and this EXACT loop — forward pass, gradient, step — is how every neural network, including the LLM you might be reading this with, was trained.`
      : `It DIVERGED: with learning rate ${lr}, each step overshoots the valley and lands higher up the other side — the oscillation grows forever. Too-large learning rates are the classic way training "explodes" (loss → NaN). Try 0.35: same start, same rule, opposite outcome. Tuning this one number well is half of practical deep learning.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The curve on screen is a loss function: it maps every possible value of a single weight w to a number measuring how wrong the model is. Lower is better. The dot sitting on the curve is the current weight. The arrow connecting one dot to the next is one gradient descent update, and the label on that arrow shows the arithmetic: the slope at the current point, multiplied by the learning rate, subtracted from the current weight to produce the next weight.',
        'Pay attention to arrow direction and length. Left of the minimum the curve slopes downward to the right, so the slope (gradient) is negative and the update pushes w rightward. Right of the minimum the slope is positive and the update pushes w leftward. The arrow always points opposite the gradient. Near the bottom the curve flattens, so the gradient shrinks, the arrow shortens, and the steps get smaller on their own without anyone changing the learning rate.',
        {type: 'callout', text: 'Gradient descent is a local rule with a global goal: measure the slope here, then step in the direction that lowers loss fastest.'},
        'Select the "1.05 (too big!)" learning rate and watch what happens. Each arrow overshoots the valley, landing on the opposite wall higher than where it started. The next arrow overshoots further. The update rule is mathematically correct, but the step size exceeds what the local curvature can absorb, so the loss grows instead of shrinking. This is divergence, and it is the visual proof that the learning rate is not a minor detail.',
        {type: 'image', src: './assets/gifs/gradient-descent.gif', alt: 'Animated walkthrough of the gradient descent visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Machine learning models have parameters, sometimes billions of them, and the goal of training is to find the parameter values that make the model\'s predictions as accurate as possible. Accuracy is measured by a loss function: a formula that takes the model\'s output and the correct answer and returns a single number, where lower means better. Training a model means minimizing that loss function over the parameter space.',
        'For tiny problems, you can solve for the minimum directly. Linear regression with n features has the normal equation, which inverts an n-by-n matrix to find the exact best weights in one shot. But matrix inversion is O(n^3), so with a million features it is already impractical. Neural networks are worse: their loss functions are non-linear compositions of many layers, and no closed-form solution exists at all. You cannot solve for the best weights of GPT; you have to search for them.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Gradient_descent.svg', alt: 'Gradient descent path moving downhill on a contour surface', caption: 'The gradient descent path makes the local rule visible: each step follows the negative gradient toward lower loss. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Gradient_descent.svg'},
        'Augustin-Louis Cauchy published the first gradient descent method in 1847 for solving systems of equations. The core idea has not changed: if you can compute how the output changes when you nudge the input, you can nudge the input in the direction that improves the output. That nudge-and-improve loop scales to any number of parameters because the cost of computing the nudge (the gradient) grows linearly with parameter count, not exponentially.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Grid search divides each parameter axis into evenly spaced values, evaluates the loss at every combination, and picks the combination with the lowest loss. For one parameter with 100 grid points, that is 100 evaluations. For two parameters with 100 points each, it is 10,000. The method requires no calculus and makes no assumptions about the loss surface. If the grid is fine enough, it finds the minimum.',
        'Random search is similar but samples parameter values from a distribution instead of a fixed grid. Bergstra and Bengio showed in 2012 that random search often beats grid search for hyperparameter tuning because it does not waste evaluations on dimensions that do not matter much. Both methods are derivative-free: they treat the loss as a black box, evaluating it at chosen points and comparing results.',
        'For a handful of parameters, both approaches work. A robotics team tuning 5 PID constants can evaluate 100,000 combinations in minutes. The methods are simple to implement, easy to parallelize, and guaranteed to find the optimum if the grid or sample set is dense enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Grid search is exponential in the number of parameters. With 100 grid points per axis, 10 parameters require 100^10 = 10^20 evaluations. A small neural network has a million parameters. A modern language model has billions. The grid for a million-parameter network has more points than atoms in the observable universe, and each point requires a full loss evaluation over the training data. No amount of compute makes this feasible.',
        'Random search escapes the grid\'s exponential blowup but has no direction. Each sample is independent of every previous sample, so a million evaluations tell you nothing about where to look next. You might find a decent region by luck, but you cannot systematically improve because you never ask the loss function which direction is downhill.',
        'The fundamental waste in both methods is ignoring information the loss function is willing to give. At every point, the loss function can tell you not just its value but its slope in every direction. That slope, the gradient, is a vector pointing toward steepest increase. Stepping opposite it is the fastest local decrease. Ignoring the gradient and searching blindly costs exponentially more compute than using it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The gradient of a function at a point is a vector whose components are the partial derivatives with respect to each parameter. It points in the direction of steepest local increase. Moving in the exact opposite direction, the negative gradient, is the steepest local decrease. This is not an approximation or a heuristic; it is a theorem of multivariable calculus.',
        'The insight that makes gradient descent practical is that computing this gradient costs roughly the same as computing the loss itself. For a neural network with d parameters, the forward pass (computing the loss) takes O(d) work, and the backward pass (computing the gradient via backpropagation and the chain rule) takes about 2 to 3 times that. So for the price of 3 to 4 loss evaluations, you get a d-dimensional direction vector that tells you exactly which way to step.',
        'Grid search with 100 points per axis needs 100^d evaluations to cover a d-dimensional space. Gradient descent needs one gradient computation per step and typically converges in thousands to millions of steps regardless of d. The method trades the exponential cost of exhaustive search for the linear cost of following the slope.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The update rule is one line: theta <- theta - alpha * gradient(L(theta)). Theta is the parameter vector (all the weights in the model). L is the loss function. The gradient of L with respect to theta is a vector of partial derivatives, one per parameter. Alpha is the learning rate, a positive scalar that controls step size. Each iteration computes the gradient at the current theta, multiplies it by alpha, and subtracts the result from theta. The new theta has lower loss if alpha is small enough.',
        'Batch gradient descent computes the gradient using the entire training dataset. If the dataset has n examples, each gradient computation sums n individual gradients and averages them. The result is the exact gradient of the average loss, so every step is a reliable downhill move. The cost is O(n) per step, which is prohibitive when n is millions of examples.',
        'Stochastic gradient descent (SGD), introduced by Robbins and Monro in 1951, replaces the full-dataset gradient with the gradient from a single randomly chosen training example. This gradient is a noisy estimate of the true gradient: on average it points downhill, but any individual step may point sideways or even slightly uphill. The tradeoff is speed: each step costs O(1) instead of O(n), so SGD can take n steps in the time batch GD takes one.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Stogra.png', alt: 'Stochastic gradient descent path with noisy steps around a smoother descent direction', caption: 'Stochastic gradients wobble around the full-gradient direction; the noise is the price of cheap updates. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Stogra.png'},
        'Mini-batch SGD is the practical middle ground. Instead of one example or all n, sample a batch of B examples (typically 32 to 512), compute the average gradient over the batch, and update. The gradient is less noisy than single-sample SGD (variance drops as 1/B) and far cheaper than full-batch. When practitioners say "training," they almost always mean mini-batch SGD over shuffled data for multiple epochs.',
        'Momentum, introduced by Polyak in 1964, adds a velocity term to the update. Instead of theta <- theta - alpha * g, it computes v <- beta * v - alpha * g, then theta <- theta + v. The parameter beta (typically 0.9) controls how much of the previous velocity carries forward. If the gradient points consistently in one direction across steps, velocity builds up and the optimizer accelerates. If the gradient oscillates (because the loss surface is a narrow valley), the oscillating components cancel and the optimizer follows the valley floor. Momentum turns zig-zag paths into smooth curves.',
        'Adam (Kingma and Ba, 2015) combines momentum with per-parameter learning rate adaptation. It maintains two running averages: m, the mean gradient (first moment), and v, the mean squared gradient (second moment). Each parameter\'s update is scaled by m / sqrt(v), so parameters with large, consistent gradients get effectively smaller learning rates, and parameters with small, noisy gradients get larger ones. Adam converges faster than plain SGD on most problems and requires less manual learning rate tuning, which is why it is the default optimizer in most deep learning frameworks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For convex loss functions, where every local minimum is also the global minimum, gradient descent provably converges. The gradient at any non-optimal point is nonzero and points away from the minimum, so stepping opposite the gradient always reduces the distance to the optimum (provided the step is small enough). The loss decreases monotonically, and the iterates approach the minimum.',
        'The convergence rate depends on the loss surface geometry. For a convex loss with Lipschitz-continuous gradients (the gradient does not change faster than some constant L), batch GD with learning rate alpha = 1/L converges at rate O(1/T): after T steps, the gap between the current loss and the optimal loss is at most proportional to 1/T. For strongly convex losses (the surface curves upward by at least some constant mu everywhere), convergence is linear: the gap shrinks by a fixed factor (1 - mu/L) each step, so O(log(1/epsilon)) steps reach epsilon accuracy.',
        'SGD converges more slowly, at rate O(1/sqrt(T)) for convex losses, because the gradient noise prevents the effective step size from shrinking as fast as in the exact-gradient case. But the noise buys something in return: for non-convex losses like those of neural networks, stochastic gradients help the optimizer escape sharp local minima and saddle points. Empirically, SGD with momentum often converges to flatter minima that generalize better to unseen data than the sharp minima batch GD settles into.',
        'Neural network loss surfaces are non-convex and high-dimensional. There is no proof that gradient descent finds the global minimum. What happens in practice is that the loss decreases rapidly at first, then more slowly, eventually reaching a region where the loss is low enough for the model to be useful. The theoretical guarantees for convex functions do not apply, but the empirical track record across every domain of deep learning shows that gradient descent finds good-enough solutions reliably.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One gradient descent step has two phases. The forward pass evaluates the loss: push the input through the network, layer by layer, and compute the scalar loss at the end. The backward pass computes the gradient: propagate the loss backward through the network using the chain rule, computing the partial derivative of the loss with respect to every parameter. The backward pass costs roughly 2 to 3 times the forward pass because it traverses every layer in reverse and must access the intermediate activations stored during the forward pass.',
        'Time cost per step depends on the variant. Batch GD processes all n training examples per step, so each step is O(n * d) where d is the number of parameters. SGD processes one example per step: O(d). Mini-batch with batch size B: O(B * d). For a dataset of 1 million examples and a model with 1 billion parameters, one batch GD step touches 10^15 multiply-adds. One mini-batch step with B = 256 touches 2.56 * 10^11, almost 4,000 times cheaper.',
        'Memory cost depends on the optimizer. Plain SGD stores one copy of the parameter vector: d floats. SGD with momentum adds one velocity vector: 2d floats. Adam stores the parameter vector, the first-moment vector, and the second-moment vector: 3d floats. For a 7-billion-parameter model at 32-bit (4 bytes per float), parameters alone occupy 28 GB. Adam triples that to 84 GB, which is why large-model training relies on mixed-precision arithmetic (16-bit parameters, 32-bit optimizer states) and distributes optimizer state across multiple GPUs.',
        'Total training cost is the per-step cost multiplied by the number of steps. A typical image classifier might train for 100 epochs over a million images with batch size 256, which is about 390,000 steps. A large language model might train for one epoch over trillions of tokens, which is tens of millions of steps. The learning rate schedule, optimizer choice, and batch size all affect how many steps are needed to reach a given loss level.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every neural network ever deployed was trained by some variant of gradient descent. Image classifiers (ResNet, ConvNeXt), language models (GPT, LLaMA), speech recognizers (Whisper), text-to-image generators (Stable Diffusion), and protein structure predictors (AlphaFold) all reach their final parameters through the same loop: forward pass, loss computation, backward pass, parameter update.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes and connections', caption: 'Neural networks make gradient descent high dimensional: the same update rule adjusts many connected weights at once. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg'},
        'Outside deep learning, gradient descent trains logistic regression classifiers, fits linear regression models when the normal equation is too expensive (millions of features), optimizes matrix factorizations for recommender systems (Netflix, Spotify), and tunes support vector machines via subgradient methods. Reinforcement learning uses policy gradient methods to adjust agent behavior based on reward signals. Differentiable physics simulators backpropagate through simulation steps to optimize control parameters for robotics.',
        'The pattern that signals gradient descent is the right tool: the objective function is differentiable (or can be made differentiable with smooth relaxations), the parameter space is continuous, and the number of parameters is large enough that exhaustive search is impossible. When all three conditions hold, gradient descent is almost always the method used in practice.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Saddle points are locations where the gradient is zero but the point is not a minimum. In high-dimensional spaces, saddle points vastly outnumber local minima. The gradient vanishes, so plain gradient descent stalls. Momentum and Adam help because accumulated velocity carries the optimizer through the flat region, but convergence slows dramatically near saddle points even with these methods.',
        'Vanishing gradients plague deep networks with sigmoid or tanh activation functions. These functions saturate for large inputs, producing derivatives close to zero. When many layers multiply near-zero derivatives together via the chain rule, the gradient reaching early layers is effectively zero and those parameters stop learning. ReLU activations, residual connections (skip connections that add the input to the output), and careful weight initialization (He or Xavier) are engineering responses to this failure mode.',
        'Learning rate sensitivity is a persistent practical challenge. Too large and the loss diverges, as the animation demonstrates with lr = 1.05. Too small and training takes prohibitively long because each step barely moves. The optimal learning rate depends on the loss surface curvature, which changes as training progresses. Learning rate schedules (warmup followed by cosine decay), learning rate finders (sweep lr from small to large and pick the steepest descent region), and adaptive optimizers (Adam) all exist because manual tuning of a fixed learning rate is fragile.',
        'Non-convex loss surfaces mean gradient descent has no guarantee of finding the global minimum. The optimizer settles into whichever basin its initialization falls into. Different random seeds produce different final parameters with different generalization quality. Practitioners mitigate this with ensemble methods (train multiple models and average their predictions), careful initialization schemes, and stochastic noise from mini-batching, but none of these are guarantees.',
        'Optimizing the wrong objective is the most dangerous failure because the optimizer succeeds perfectly at the wrong thing. If the loss function does not capture what you actually want, gradient descent will minimize it faithfully and deliver a model that is precisely, confidently wrong. Label noise, data leakage, distribution shift between training and deployment, and reward hacking in reinforcement learning are all instances of this failure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Minimize f(x) = x^2 + 4x + 4. This factors as (x + 2)^2, so the minimum is at x = -2 where f(-2) = 0. The derivative (gradient in one dimension) is f\'(x) = 2x + 4. Start at x = 4 with learning rate alpha = 0.1.',
        'Step 1: f\'(4) = 2(4) + 4 = 12. The slope is 12, meaning f increases steeply to the right of x = 4. Update: x = 4 - 0.1 * 12 = 2.8. Loss: f(2.8) = (2.8 + 2)^2 = 23.04, down from f(4) = 36.',
        'Step 2: f\'(2.8) = 2(2.8) + 4 = 9.6. Update: x = 2.8 - 0.1 * 9.6 = 1.84. Loss: f(1.84) = (1.84 + 2)^2 = 14.7456. The gradient is smaller because x is closer to the minimum, so the step is shorter.',
        'Step 3: f\'(1.84) = 2(1.84) + 4 = 7.68. Update: x = 1.84 - 0.1 * 7.68 = 1.072. Loss: f(1.072) = (1.072 + 2)^2 = 9.437. Each step shrinks the loss by a smaller absolute amount but a roughly constant ratio.',
        'Step 4: f\'(1.072) = 6.144. Update: x = 1.072 - 0.1 * 6.144 = 0.4576. Loss: f(0.4576) = 6.040. Step 5: f\'(0.4576) = 4.9152. Update: x = 0.4576 - 0.1 * 4.9152 = -0.0339. Loss: f(-0.0339) = 3.866.',
        'After 5 steps, x moved from 4 to -0.034, and the loss dropped from 36 to 3.87. The pattern is visible in the algebra: x_new = x - 0.1 * (2x + 4) = 0.8x - 0.4. Each step contracts the distance from x to the minimum (-2) by a factor of 0.8. This contraction factor is (1 - alpha * L) where L = 2 is the second derivative (curvature). After 20 steps the contraction has been applied 20 times: 0.8^20 = 0.012, so x is within 0.012 * 6 = 0.07 of the minimum. After 50 steps, 0.8^50 < 0.00002, and x is essentially at -2.',
        'Now change the learning rate to alpha = 1.1. The contraction factor becomes 1 - 1.1 * 2 = -1.2. The absolute value exceeds 1, which means each step moves x further from the minimum, not closer. Step 1: x = 4 - 1.1 * 12 = -9.2. Step 2: x = -9.2 - 1.1 * (-14.4) = 6.64. The optimizer bounces back and forth with growing amplitude. This is divergence, and it happens the instant alpha > 1/L = 0.5 for this quadratic. The maximum stable learning rate is a property of the loss surface, not a free choice.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Cauchy, "Methode generale pour la resolution des systemes d\'equations simultanees," 1847 — the first published gradient descent method. Robbins and Monro, "A Stochastic Approximation Method," Annals of Mathematical Statistics, 1951 — the foundations of stochastic gradient descent. Polyak, "Some methods of speeding up the convergence of iteration methods," USSR Computational Mathematics and Mathematical Physics, 1964 — introduced momentum. Kingma and Ba, "Adam: A Method for Stochastic Optimization," ICLR, 2015 — the most widely used adaptive optimizer. Ruder, "An Overview of Gradient Descent Optimization Algorithms," arXiv:1609.04747, 2016 — a clear modern survey covering SGD variants, momentum, Adam, and more.',
        'Prerequisite gaps: Loss Functions (what gradient descent minimizes, and how the choice of loss shapes what the model learns), Backpropagation (how the chain rule computes gradients efficiently through a neural network\'s layers). Natural extensions: the Adam Optimizer page on this site covers adaptive per-parameter learning rates in detail; Learning Rate Schedules covers warmup, cosine decay, and step decay strategies. Production-scale concerns: mixed-precision training (16-bit forward pass, 32-bit optimizer state), gradient accumulation (simulate large batches on small GPUs), and distributed data parallelism (split batches across many GPUs and average gradients).',
        'Contrasting alternatives worth studying: evolutionary strategies use random perturbations instead of gradients and work for non-differentiable objectives; Bayesian optimization models the objective as a Gaussian process and chooses evaluation points to maximize information, which is effective when each evaluation is expensive (hyperparameter search, drug design); second-order methods like L-BFGS use curvature information (the Hessian or an approximation) to choose better step directions, but storing and inverting the Hessian is O(d^2) in memory and O(d^3) in time, so they do not scale to the billions of parameters in modern networks.',
      ],
    },
  ],
};
