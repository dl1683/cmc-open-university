// Gradient flow: the chain rule is a chain of multiplications, and a long
// product of numbers below one is zero in disguise. Why deep nets were
// untrainable for decades — and the three fixes that ended it.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-flow',
  title: 'Vanishing & Exploding Gradients',
  category: 'AI & ML',
  summary: 'Backprop multiplies a factor per layer — below 1 the signal starves, above 1 it detonates. Depth was unusable until three fixes.',
  controls: [
    { id: 'view', label: 'Follow', type: 'select', options: ['the signal dying layer by layer', 'the fixes that made depth possible'], defaultValue: 'the signal dying layer by layer' },
  ],
  run,
};

const DEPTHS = Array.from({ length: 10 }, (_, i) => i + 1);
// Gradient magnitude reaching layer (10 âˆ’ k): one multiplicative factor per layer.
const chain = (factor) => DEPTHS.map((d) => ({ x: d, y: factor ** (10 - d) }));

function* dying() {
  yield {
    state: matrixState({
      title: 'Backprop through 10 sigmoid layers: one multiplication each',
      rows: [{ id: 'rule', label: 'chain rule' }],
      columns: [{ id: 'formula', label: '' }],
      values: [[1]],
      format: () => 'grad(layer 1) = grad(loss) Ã— fâ‚â‚€′ Ã— fâ‚‰′ Ã— … Ã— fâ‚‚′',
    }),
    highlight: { active: ['rule:formula'] },
    explanation: 'Backpropagation\'s engine is the chain rule, and the chain rule is a PRODUCT: the gradient reaching layer 1 is the loss gradient multiplied by one local derivative per layer passed through. Each sigmoid contributes Ïƒ′(z) — at very best 0.25, usually less (the saturation flats of the S-curve from Logistic Regression give nearly 0). A product of ten numbers each â‰¤ 0.25 — multiply it out before scrolling on. This arithmetic, not a lack of ideas, is why neural networks stalled at 2–3 layers for twenty years.',
    invariant: 'A product of per-layer factors below 1 shrinks exponentially with depth.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [{ id: 'vanish', label: 'sigmoid chain (Ã—0.25/layer)', points: chain(0.25) }],
      markers: [{ id: 'dead', x: 1, y: 0.25 ** 9, label: '0.0000038' }],
    }),
    highlight: { removed: ['dead'], active: ['vanish'] },
    explanation: 'The product, plotted. The output layer gets gradient 1; nine multiplications later, layer 1 receives 0.25⁹ â‰ˆ 0.0000038 — four MILLIONTHS of the signal. Layer 1 is not learning slowly; on any practical clock it is frozen, while the layers nearest the loss race ahead. This is the VANISHING GRADIENT: the early layers — the ones that must learn the basic features everything else builds on — are precisely the ones the learning signal cannot reach. The same disease killed early RNNs along the time axis: by 30 timesteps back, the gradient is archaeology.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [
        { id: 'vanish', label: 'Ã—0.25 â†’ starves', points: chain(0.25) },
        { id: 'explode', label: 'Ã—1.5 â†’ detonates', points: chain(1.5) },
      ],
      markers: [{ id: 'boom', x: 1, y: 1.5 ** 9, label: 'â‰ˆ38' }],
    }),
    highlight: { compare: ['vanish', 'explode'], removed: ['boom'] },
    explanation: 'The evil twin: make the per-layer factor 1.5 — large weights do it — and the same arithmetic runs in reverse: 1.5⁹ â‰ˆ 38Ã— amplification, and in a 50-layer net, 1.5⁴⁹ â‰ˆ 600 million. Weights take a single enormous step, the loss prints NaN, training is dead. EXPLODING gradients are vanishing\'s mirror — both are the same theorem about long products, and notice how absurdly narrow the safe corridor is: the per-layer factor must hug 1.0 almost exactly, across every layer, for the whole of training. Depth is a tightrope.',
    invariant: 'Stable depth requires the per-layer gradient factor to stay near 1 — above explodes, below starves.',
  };

  yield {
    state: matrixState({
      title: 'The two diseases at the bedside',
      rows: [{ id: 'van', label: 'vanishing' }, { id: 'exp', label: 'exploding' }],
      columns: [{ id: 'sym', label: 'symptom' }, { id: 'cause', label: 'mechanism' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'early layers frozen, loss plateaus', 'product of factors < 1', 'loss spikes to NaN', 'product of factors > 1'][v],
    }),
    highlight: { compare: ['van:sym', 'exp:sym'] },
    explanation: 'The diagnostic table — and both rows were considered fatal. The 1991 diagnosis (Hochreiter\'s thesis, later the LSTM motivation) made it look structural: depth multiplies factors, multiplication is unforgiving, therefore deep networks cannot train. Every modern architecture you have studied on this site is, at its core, a scheme for smuggling gradient past this product. The next view shows the three smuggling routes.',
  };
}

function* fixes() {
  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [
        { id: 'sigmoid', label: 'sigmoid chain', points: chain(0.25) },
        { id: 'relu', label: 'ReLU + good init', points: chain(0.95) },
      ],
      markers: [{ id: 'alive', x: 1, y: 0.95 ** 9, label: '0.63 — alive!' }],
    }),
    highlight: { found: ['relu', 'alive'], visited: ['sigmoid'] },
    explanation: 'Fix 1 — CHANGE THE FACTOR: ReLU, max(0, z). Its derivative is exactly 1 for every active unit — not 0.25, not a saturating curve: 1. The per-layer factor becomes the weight scale alone, and proper initialization (He/Xavier — draw starting weights so each layer preserves signal variance) pins that near 1. The product 0.95⁹ â‰ˆ 0.63: layer 1 hears the loss loud and clear. This pairing — ReLU plus principled init — is a quiet hero of the 2012 deep-learning breakout: the difference between 0.25 and 0.95 per layer is the difference between 4 millionths and two-thirds.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [
        { id: 'plain', label: 'plain chain', points: chain(0.25) },
        { id: 'residual', label: 'residual: identity floor', points: DEPTHS.map((d) => ({ x: d, y: 1 + 0.25 ** (10 - d) })) },
      ],
    }),
    highlight: { found: ['residual'], removed: ['plain'] },
    explanation: 'Fix 2 — BUILD A BYPASS: residual connections. A ResNet block computes x + f(x) instead of f(x), and differentiate that: the gradient factor is 1 + f′ — there is ALWAYS a 1, an identity highway the gradient rides untouched, with f′ as a bonus lane. The product of (1 + small) terms never collapses to zero no matter the depth. This single plus sign took networks from 19 layers (VGG, straining) to 152 (ResNet, 2015) overnight, and it is the same skip connection you saw wrapping every sublayer of the Transformer Block — no residual stream, no 100-layer LLMs.',
    invariant: 'd(x + f(x))/dx = 1 + f′: the identity path guarantees a gradient floor at every depth.',
  };

  yield {
    state: matrixState({
      title: 'Fix 3 — keep every layer in the comfortable zone',
      rows: [{ id: 'norm', label: 'normalization (LayerNorm/BatchNorm)' }, { id: 'clip', label: 'gradient clipping' }],
      columns: [{ id: 'does', label: 'what it does' }, { id: 'guards', label: 'guards against' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 're-centers activations to mean 0, var 1 each layer', 'saturation â†’ vanishing', 'caps gradient norm at a ceiling (e.g. 1.0)', 'explosion â†’ NaN'][v],
    }),
    highlight: { active: ['norm:does'], compare: ['clip:does'] },
    explanation: 'Fix 3 — POLICE THE SCALE: normalization layers re-standardize activations at every layer (mean 0, variance 1), so inputs stay on the steep, healthy part of every nonlinearity instead of drifting into saturated flats as training shifts the distributions. And for the exploding side, the bluntest tool in the kit: GRADIENT CLIPPING — if the gradient norm exceeds a ceiling, rescale it down. Inelegant, unprincipled, and it is in the training loop of essentially every LLM, because one detonated batch otherwise erases a million dollars of progress.',
  };

  yield {
    state: matrixState({
      title: 'Why your 100-layer transformer trains at all',
      rows: [
        { id: 'relu', label: 'ReLU-family activations' },
        { id: 'init', label: 'He/Xavier init' },
        { id: 'res', label: 'residual connections' },
        { id: 'norm', label: 'LayerNorm + clipping' },
      ],
      columns: [{ id: 'where', label: 'where you have seen it' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'every hidden layer since 2012 (GELU in transformers)', 'the silent default in every framework', 'Transformer Block, ResNet — the + in x + f(x)', 'twice per transformer layer; every LLM training loop'][v],
    }),
    highlight: { found: ['res:where'] },
    explanation: 'The full armor, assembled. A modern transformer stacks ALL of these — GELU activations, scaled initialization, a residual highway past every sublayer, LayerNorm twice per block, clipping at the optimizer — and that is why "just stack 96 layers" works in 2026 when 5 layers failed in 1996. The arithmetic never changed; a product of 96 factors is as merciless as ever. Engineering changed: every factor is now held so close to 1 that the product survives. When a training run of yours plateaus mysteriously or NaNs at 3 a.m., check the gradient norms per layer first — this page is the chart the doctors read.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the signal dying layer by layer') yield* dying();
  else if (view === 'the fixes that made depth possible') yield* fixes();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view plots gradient magnitude reaching each layer of a 10-layer network during backpropagation. The curve falling toward zero is the vanishing gradient: each layer multiplies the signal by a factor below 1, and the product collapses exponentially. The skip connection (residual) curve in the second view shows the fix: an identity path that floors the gradient at 1 regardless of depth.',
        'Active items mark the current layer being traced. Found markers flag the residual bypass that keeps the signal alive. The comparison between sigmoid chains and residual chains is the central visual claim: skip connections turn an exponentially dying signal into a stable one. Watch the gap between curves widen as depth increases.',
        {type: 'callout', text: 'Depth trains only when the backward signal has a path whose product does not collapse or explode.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'By 2014, convolutional networks were winning competitions by going deeper. VGG-16 and VGG-19 stacked 16 and 19 layers of 3x3 convolutions and set records on ImageNet. The obvious next step was to keep stacking. He, Zhang, Ren, and Sun at Microsoft Research tried it and hit a paradox: a 56-layer plain network had higher training error than a 20-layer one. Not higher test error from overfitting. Higher training error. The deeper network was strictly worse at fitting its own training data.',
        'This is the degradation problem. It is not about capacity, regularization, or data. A 56-layer network contains every function a 20-layer network can represent: set the extra 36 layers to identity mappings and you recover the 20-layer network exactly. The deeper network should be at least as good. The fact that it is worse proves that standard gradient-based training cannot find those identity mappings. The optimizer is failing, not the architecture.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Stack more layers. Each layer learns one more level of abstraction. VGG proved that many small 3x3 filters outperform fewer large filters at the same receptive field. So build VGG-56, VGG-100, VGG-200. Every layer is differentiable. Backpropagation can compute the gradient. Gradient descent should find good weights.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Logistic-curve.svg', alt: 'Logistic sigmoid curve flattening near zero and one', caption: 'The sigmoid curve shows why saturation starves gradients: at the flat tails, small input changes barely move the output. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Logistic-curve.svg'},
        'This works up to about 20 layers. Past that threshold, the learning signal reaching early layers is too weak to be useful. The chain rule multiplies one local derivative per layer, and with sigmoid or tanh activations, each derivative is at most 0.25. Over 50 layers: 0.25 to the 49th power is roughly 0.000000000000000000000000000003. The early layers, the ones responsible for learning edges and textures, are frozen. Adding layers does not add capability; it adds dead weight.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The degradation problem is sharper than vanishing gradients alone. Even with ReLU activations (derivative 1 for positive inputs) and batch normalization (which stabilizes activation distributions), plain networks still degrade past 30-50 layers. He et al. 2015 showed this experimentally on CIFAR-10: a 56-layer plain network has 6.97% error versus 6.41% for a 20-layer one. The optimizer cannot navigate to the region of weight space where the extra layers act as identities.',
        'Identity mapping should be easy. A layer that does nothing useful just needs to learn the identity function. But a standard convolutional layer parameterized as H(x) must push all its weights to the exact configuration where H(x) = x. That is a hard optimization target surrounded by the vast space of all possible transformations. The optimizer has no structural bias toward identity. It finds a bad local minimum instead, and depth becomes a liability.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Rewrite the layer as F(x) + x instead of H(x). The network no longer learns the full mapping H(x). It learns the residual F(x) = H(x) - x: the difference between the desired output and the input. If the optimal mapping is close to identity, the residual F is close to zero. Learning a near-zero function is easy: zero-initialized weights already produce it. The optimization landscape tilts toward identity by construction.',
        'The plus sign is the entire invention. It creates a skip connection (also called a shortcut or identity mapping) that carries the input past the layer unchanged. The learned branch F(x) only needs to capture what should change. Differentiate y = F(x) + x and the gradient is dF/dx + I. That identity matrix I means the gradient always has a direct path with magnitude 1. No matter how deep the network, no matter how poorly F is currently parameterized, the gradient reaches every layer through the skip path.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/ResBlock.png', alt: 'Residual block diagram with a shortcut path added to a learned branch', caption: 'A residual block gives gradients a shortcut around the learned branch, turning depth into optional refinements rather than one fragile chain. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:ResBlock.png'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic residual block has two paths. The main path passes the input through conv, batch normalization, ReLU, conv, batch normalization. The skip path carries the input unchanged. The two paths are added element-wise, then a final ReLU is applied. This is the building block of ResNet-34: stacks of these two-layer residual blocks.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Rectifier_and_softplus_functions.svg', alt: 'Rectifier and softplus activation functions plotted together', caption: 'ReLU-like activations avoid the fully saturated tails of sigmoid units on the positive side, which helps gradient flow in deep nets. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Rectifier_and_softplus_functions.svg'},
        'For deeper networks (ResNet-50, ResNet-101, ResNet-152), the bottleneck block is more efficient. It uses three convolutions: 1x1 to reduce channels (say 256 to 64), 3x3 to process at the reduced dimension, 1x1 to expand back (64 to 256). The 3x3 convolution operates on 64 channels instead of 256, cutting computation by roughly 4x. Batch normalization follows each convolution. The skip connection still adds the original 256-channel input to the output.',
        'When the spatial dimensions or channel count change between blocks (a stride-2 convolution for downsampling), the skip connection uses a 1x1 convolution with matching stride to project the input to the correct shape. This projection shortcut is the only case where the skip path has learned parameters.',
        'Pre-activation ResNet (He et al. 2016, "Identity Mappings in Deep Residual Networks") reorders the block: BN, ReLU, conv, BN, ReLU, conv. The skip connection becomes a pure identity y = x + F(BN(ReLU(x))). This cleans up the gradient path further and trains successfully at 1001 layers on CIFAR-10.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The gradient through a stack of L residual blocks is a sum of 2 to the L path combinations. Each path passes through a different subset of the F blocks, and every path includes at most L multiplicative terms. Crucially, the all-skip path (through every identity shortcut, through zero F blocks) contributes a gradient of exactly 1. This means the gradient can never fully vanish: even if every F has a bad Jacobian, the identity path survives.',
        'Veit et al. 2016 ("Residual Networks Behave Like Ensembles of Relatively Shallow Networks") showed experimentally that ResNets behave as implicit ensembles. Deleting individual layers at test time causes only small accuracy drops, unlike plain networks where removing one layer is catastrophic. The skip connections make each layer an optional refinement rather than a critical link in a fragile chain.',
        'Li et al. 2018 ("Visualizing the Loss Landscape of Neural Nets") showed that ResNet loss surfaces are measurably smoother than those of plain networks at the same depth. Skip connections reshape the optimization landscape itself, not just the gradient magnitude. The optimizer walks a smoother surface with fewer sharp barriers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ResNet-50: 25.6 million parameters, 3.8 billion multiply-add operations (GFLOPs) for a single 224x224 image. ResNet-101: 44.5 million parameters, 7.6 GFLOPs. ResNet-152: 60.2 million parameters, 11.5 GFLOPs. For comparison, VGG-16 has 138 million parameters and 15.5 GFLOPs. ResNet-152 is deeper, more accurate, and cheaper than VGG-16.',
        'Skip connections add negligible compute. An element-wise addition of two tensors is trivially fast compared to the convolutions it connects. The bottleneck design is the real efficiency lever: it moves the expensive 3x3 convolution to a lower-dimensional space. Memory cost during training is dominated by storing activations for the backward pass, not by the skip connections themselves. Gradient checkpointing can trade recomputation for memory when training very deep variants.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ResNet won the ImageNet ILSVRC 2015 classification challenge with 3.57% top-5 error, the first result to surpass human-level performance on that benchmark. It simultaneously won the detection and localization tasks on ImageNet and the detection and segmentation tasks on COCO.',
        'The skip connection became the default wiring pattern for deep networks. U-Net (Ronneberger et al. 2015) uses skip connections between encoder and decoder layers for medical image segmentation, passing high-resolution features directly to the upsampling path. DenseNet (Huang et al. 2017) extends the idea: instead of adding, it concatenates, so each layer receives all previous feature maps. Every transformer block uses residual connections around both the attention and feed-forward sublayers; without them, 96-layer language models could not train.',
        'The residual stream view (Elhage et al. 2021) reframes transformers: the skip connections form a shared communication bus. Each attention and feed-forward layer reads from and writes to this stream. The stream is the representation; layers are incremental updates. This framing is the basis of most mechanistic interpretability work on language models.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Returns diminish past a few hundred layers even with residual connections. He et al. showed 1001-layer pre-activation ResNets train on CIFAR-10, but accuracy gains over 152 layers are marginal. Huang et al. 2016 ("Deep Networks with Stochastic Depth") demonstrated that randomly dropping entire residual blocks during training often improves accuracy, implying many blocks contribute little. Depth alone is not the path to better features.',
        'Residual connections do not guarantee feature reuse. The identity path makes it easy for layers to learn nothing (F = 0), which stabilizes training but also means some layers may coast. DenseNet was partly motivated by this observation: concatenation forces each layer to produce new features rather than relying on the bypass.',
        'Skip connections still require batch normalization or layer normalization to stabilize training at scale. The residual block is not self-sufficient. Without normalization, activation magnitudes can still drift across hundreds of layers, and gradient clipping is still needed in practice for large-scale training to guard against occasional explosions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A two-layer residual block processing a single spatial position with 64 channels. Input x is a vector of 64 values. First layer: multiply by a 64x64 weight matrix W1, batch-normalize, apply ReLU. Call this intermediate a = ReLU(BN(W1 * x)). Second layer: multiply by W2, batch-normalize. Call this b = BN(W2 * a). The output before activation is y = b + x, the element-wise sum of the learned transformation and the raw input. Apply ReLU: output = ReLU(y).',
        'If both W1 and W2 are initialized near zero, then a is near zero, b is near zero, and y is approximately x. The block starts as an identity. As training proceeds, W1 and W2 adjust so F(x) = b captures whatever correction the network needs at this depth. The gradient of the loss with respect to x passes through two paths: one through dF/dx (the chain through W2, ReLU, W1) and one through the identity (gradient = 1). Even if dF/dx is small early in training, the identity path delivers a usable signal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'He, Zhang, Ren, Sun, "Deep Residual Learning for Image Recognition," CVPR 2016 (the original ResNet paper, submitted 2015). He, Zhang, Ren, Sun, "Identity Mappings in Deep Residual Networks," ECCV 2016 (pre-activation ResNet). Huang, Liu, van der Maaten, Weinberger, "Densely Connected Convolutional Networks," CVPR 2017 (DenseNet). Veit, Wilber, Belongie, "Residual Networks Behave Like Ensembles of Relatively Shallow Networks," NeurIPS 2016. Li, Xu, Taylor, Studer, Goldstein, "Visualizing the Loss Landscape of Neural Nets," NeurIPS 2018. Elhage et al., "A Mathematical Framework for Transformer Circuits," Anthropic 2021.',
        'Prerequisites: Backpropagation (the chain rule that skip connections rescue), Convolution (the layers inside residual blocks), Batch Normalization (required companion for stable training). Extensions: Transformer Block (residual connections around attention and feed-forward), DenseNet (concatenation instead of addition), U-Net (encoder-decoder skip connections for segmentation). Contrasting alternatives: Highway Networks (Srivastava et al. 2015, gated skip connections, slightly predates ResNet), Stochastic Depth (randomly dropping blocks during training).',
      ],
    },
  ],
};
