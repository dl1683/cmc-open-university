// Knowledge distillation: a giant teacher model trains a tiny student —
// not with right answers, but with its full probability distribution.
// The "wrongness pattern" is the knowledge.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'knowledge-distillation',
  title: 'Knowledge Distillation',
  category: 'AI & ML',
  summary: 'A big teacher model trains a small student with soft probabilities — dark knowledge included.',
  controls: [
    { id: 'labels', label: 'Train the student on', type: 'select', options: ['teacher\'s soft labels', 'hard labels only'], defaultValue: 'teacher\'s soft labels' },
  ],
  run,
};

const CLASSES = ['cat', 'dog', 'fox', 'car', 'tree'];
// The big teacher\'s output for one photo of a cat — note the STRUCTURE:
// dog and fox get real probability (they look cat-like); car and tree don\'t.
const TEACHER = [0.78, 0.13, 0.06, 0.02, 0.01];
const HARD = [1, 0, 0, 0, 0];
// An untrained student starts near-uniform.
const STUDENT_START = [0.24, 0.20, 0.19, 0.19, 0.18];

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const cols = CLASSES.map((c, j) => ({ id: `c${j}`, label: c }));

export function* run(input) {
  const soft = String(input.labels) !== 'hard labels only';
  if (!['teacher\'s soft labels', 'hard labels only'].includes(String(input.labels))) {
    throw new InputError('Pick a training signal.');
  }
  const target = soft ? TEACHER : HARD;

  // Step 1: Teacher's raw prediction — highlight the winner
  yield {
    state: matrixState({
      title: 'The teacher (7B params) sees a photo of a cat',
      rows: [{ id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [TEACHER],
      format: pct,
    }),
    highlight: { active: ['teacher:c0'] },
    explanation: 'A huge model is accurate but expensive to serve. We want a model 10× smaller — but training the small one from scratch gives mediocre results. Look at the teacher\'s prediction: 78% cat is the winner. But the SHAPE of that distribution is the real treasure. Distillation\'s insight: the teacher\'s full output distribution holds more lessons per example than the right answer alone.',
  };

  // Step 2: Focus on the dark knowledge — highlight non-winning classes
  yield {
    state: matrixState({
      title: 'Dark knowledge: what the "wrong" answers reveal',
      rows: [{ id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [TEACHER],
      format: pct,
    }),
    highlight: { active: ['teacher:c1', 'teacher:c2', 'teacher:c3', 'teacher:c4'] },
    explanation: 'Now look at the NON-winners. Dog gets 13%, fox gets 6% — but car gets 2% and tree gets 1%. The teacher is saying: "dogs and foxes LOOK like cats; cars and trees do not." This is dark knowledge — the useful information hiding in the losing probabilities. A hard label [1,0,0,0,0] erases all of it: every wrong class is equally wrong. But they are not equally wrong, and the teacher knows it.',
  };

  // Step 3: Hard labels — all dark knowledge erased
  yield {
    state: matrixState({
      title: 'What hard labels look like: one-hot',
      rows: [{ id: 'hard', label: 'hard label' }],
      columns: cols,
      values: [HARD],
      format: pct,
    }),
    highlight: { active: ['hard:c0'] },
    explanation: 'A hard label says one thing: "cat." 100% cat, 0% everything else. The fact that a dog resembles a cat more than a car does? Erased. The fact that foxes are cat-like? Gone. A small student model trained on these labels must rediscover every inter-class relationship from raw pixels alone — and it may not have enough capacity to do so.',
  };

  // Step 4: The training target (soft or hard)
  yield {
    state: matrixState({
      title: soft ? 'Training target: the teacher\'s soft distribution' : 'Training target: the hard label (one-hot)',
      rows: [{ id: 'target', label: 'target' }],
      columns: cols,
      values: [target],
      format: pct,
    }),
    highlight: soft ? { active: ['target:c0', 'target:c1', 'target:c2'] } : { active: ['target:c0'] },
    explanation: soft
      ? 'The student will train against the teacher\'s FULL distribution — every probability, not just the winner. One example now teaches: "this is a cat, dogs and foxes are nearby concepts, cars and trees are unrelated." The entire ranking is a training signal.'
      : 'The student will train against the hard label — just the winner. It will learn THAT the answer is cat, but not WHY other classes are more or less plausible. Compare this with the teacher\'s soft distribution: the difference is the dark knowledge being left on the table.',
  };

  // Step 5: Temperature scaling concept
  const T = 3;
  const logits = [5.0, 3.0, 1.5, 0.5, 0.1];
  const softmaxAt = (t) => {
    const scaled = logits.map((l) => Math.exp(l / t));
    const sum = scaled.reduce((a, b) => a + b, 0);
    return scaled.map((s) => s / sum);
  };
  const atT1 = softmaxAt(1);
  const atT3 = softmaxAt(T);
  yield {
    state: matrixState({
      title: 'Temperature scaling: T=1 vs T=3',
      rows: [{ id: 't1', label: 'T = 1' }, { id: 't3', label: `T = ${T}` }],
      columns: cols,
      values: [atT1, atT3],
      format: pct,
    }),
    highlight: { compare: ['t1', 't3'] },
    explanation: `Before computing soft targets, both teacher and student logits are divided by temperature T. At T=1 (standard softmax) the distribution is sharply peaked: ${pct(atT1[0])} cat, tiny crumbs elsewhere. At T=${T} the distribution SPREADS: ${pct(atT3[0])} cat, ${pct(atT3[1])} dog, ${pct(atT3[2])} fox. The dark knowledge — the relative ranking among wrong classes — becomes a loud, clear training signal. Typical T: 3–20.`,
    invariant: 'Both rows still sum to 100% — temperature changes the shape, not the validity, of the distribution.',
  };

  // Step 6: Student starts near-uniform
  let student = [...STUDENT_START];
  yield {
    state: matrixState({
      title: 'The student (tiny model) before training',
      rows: [{ id: 'e0', label: 'epoch 0' }],
      columns: cols,
      values: [STUDENT_START],
      format: pct,
    }),
    highlight: {},
    explanation: `An untrained student starts near-uniform: ${CLASSES.map((c, j) => `${c} ${pct(STUDENT_START[j])}`).join(', ')}. It has no opinion — every class is roughly equally likely. The question is whether it can absorb the teacher\'s worldview, or whether it must stumble toward accuracy alone.`,
    invariant: 'The student\'s probabilities sum to 100% — it is a valid softmax output even before learning.',
  };

  // Steps 7-9: Three epochs of learning with progressive detail
  const rows = [{ id: 'e0', label: 'epoch 0' }];
  const values = [STUDENT_START];
  const epochDetails = [
    {
      soft: 'The student takes its first big step toward the teacher\'s shape. Cat jumps from ~24% toward the target. But notice: dog and fox are ALSO moving — the student is learning the ranking, not just the winner. This is one training step doing the work of many hard-label examples.',
      hard: 'The student lurches toward the one-hot spike. Cat probability jumps sharply. Dog, fox, car, tree all shrink toward zero — the student is learning to be maximally confident about one class and dismissive of everything else.',
    },
    {
      soft: 'Closer now. The student\'s distribution is starting to resemble the teacher\'s. The KL divergence — the distance between the two distributions — is shrinking. Cat dominant, dog clearly second, fox third. The student is absorbing the teacher\'s sense of inter-class similarity.',
      hard: 'The spike sharpens. Cat is climbing toward 100% and everything else is collapsing. The student is becoming a confident classifier, but it has no sense of which wrong answers are more plausible than others. On an ambiguous image, it will be confidently wrong rather than usefully uncertain.',
    },
    {
      soft: 'Convergence. The student\'s distribution is very close to the teacher\'s — the teacher\'s worldview has been compressed into a model a fraction of the size. The dark knowledge transferred: cat > dog > fox > car > tree, with proportions that reflect real visual similarity.',
      hard: 'The student is now a sharp one-hot approximation. High accuracy on clear-cut cases, but it never learned the structure of near-misses. On a borderline cat/dog image, this student has no calibrated doubt to fall back on.',
    },
  ];

  for (let epoch = 1; epoch <= 3; epoch += 1) {
    student = student.map((s, j) => s + 0.55 * (target[j] - s));
    const total = student.reduce((a, b) => a + b, 0);
    student = student.map((s) => s / total);
    rows.push({ id: `e${epoch}`, label: `epoch ${epoch}` });
    values.push([...student]);

    const detail = epochDetails[epoch - 1];
    const dist = target.reduce((sum, t, j) => sum + Math.abs(t - student[j]), 0);

    yield {
      state: matrixState({
        title: `Student learning — epoch ${epoch}`,
        rows: rows.map((r) => ({ ...r })),
        columns: cols,
        values: values.map((v) => [...v]),
        format: pct,
      }),
      highlight: { active: [`e${epoch}`] },
      explanation: `Epoch ${epoch} (L1 distance to target: ${dist.toFixed(3)}): ${soft ? detail.soft : detail.hard}`,
      invariant: 'Every row sums to 100% — the student remains a valid probability distribution at every step.',
    };
  }

  // Step 10: Side-by-side comparison
  yield {
    state: matrixState({
      title: soft ? 'Distilled student vs teacher' : 'Hard-label student vs teacher',
      rows: [{ id: 'student', label: 'student' }, { id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [[...student], TEACHER],
      format: pct,
    }),
    highlight: { compare: ['student', 'teacher'] },
    explanation: soft
      ? `Side by side: the student has absorbed the teacher\'s ranking and approximate magnitudes. Cat ${pct(student[0])} vs ${pct(TEACHER[0])}, dog ${pct(student[1])} vs ${pct(TEACHER[1])}, fox ${pct(student[2])} vs ${pct(TEACHER[2])}. The teacher\'s dark knowledge — which wrong answers are reasonable — survived compression. This is not hypothetical: DistilBERT kept ~97% of BERT\'s quality at 40% smaller and 60% faster.`
      : `Side by side: the student is a spike where the teacher is a curve. Cat is close (${pct(student[0])} vs ${pct(TEACHER[0])}), but the wrong-class structure is gone. The teacher says dog ${pct(TEACHER[1])}, fox ${pct(TEACHER[2])} — the student says near-zero for both. The dark knowledge was never transmitted.`,
  };

  // Step 11: Final insight — what the student learned or missed
  const dogDiff = Math.abs(student[1] - TEACHER[1]);
  const foxDiff = Math.abs(student[2] - TEACHER[2]);
  yield {
    state: matrixState({
      title: soft ? 'What the student inherited' : 'What the student missed',
      rows: [
        { id: 'student', label: 'student' },
        { id: 'teacher', label: 'teacher' },
        { id: 'hard', label: 'hard label' },
      ],
      columns: cols,
      values: [[...student], TEACHER, HARD],
      format: pct,
    }),
    highlight: soft ? { found: ['student:c1', 'student:c2'] } : { visited: ['student:c1', 'student:c2'] },
    explanation: soft
      ? `The distilled student inherited the teacher\'s SHAPE, not just its answer. Dog gap: ${pct(dogDiff)}, fox gap: ${pct(foxDiff)} — close enough that the student will generalize similarly on ambiguous inputs. In practice, the combined loss L = (1−α)·CE_hard + α·T²·KL_soft blends both signals. Stack Quantization on top and the compression multiplies. Today\'s strongest small LLMs are routinely distilled from frontier-model outputs — distillation at dataset scale.`
      : `The hard-label student missed everything except the winner. Dog gap from teacher: ${pct(dogDiff)}, fox gap: ${pct(foxDiff)}. All that dark knowledge — which wrong answers are plausible, how classes relate to each other — was never in the training signal. The student will generalize worse on ambiguous inputs and have no calibrated uncertainty. Flip the control to "teacher\'s soft labels" and watch what changes.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each row is a probability distribution over five classes: cat, dog, fox, car, tree. The teacher row shows a large model\'s softmax output for one cat image. The numbers add to 100%.',
        { type: 'callout', text: 'Knowledge distillation compresses behavior, not just answers: the student learns from the teacher probability shape over all classes.' },
        'The target row shows what the student trains against. Toggle the control to switch between soft labels (the teacher\'s full distribution) and hard labels (one-hot: 100% cat, 0% everything else). The difference between those two rows is the entire point of distillation.',
        'Epoch rows track the student\'s distribution as training progresses. With soft labels, watch the student preserve the teacher\'s ranking among wrong classes: dog > fox > car > tree. With hard labels, the student collapses toward a single spike. The shape difference in the final comparison row is the dark knowledge the hard-label student never received.',
      
        {type: 'image', src: './assets/gifs/knowledge-distillation.gif', alt: 'Animated walkthrough of the knowledge distillation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large models are accurate but expensive to serve. A 7-billion-parameter teacher may need datacenter GPUs, cost dollars per thousand inferences, and add hundreds of milliseconds of latency. Mobile apps, browser tools, embedded devices, and high-throughput production endpoints cannot afford that.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered artificial neural network diagram with colored input hidden and output layers', caption: 'Distillation keeps the student architecture small while using the teacher output distribution as a richer supervision signal. Source: https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.' },
        'The goal is to get a model 2-10x smaller that preserves most of the teacher\'s accuracy. Hinton, Vinyals, and Dean (2015) proposed knowledge distillation: instead of training the small model on the original labeled dataset alone, train it to imitate the teacher\'s full output distribution. The teacher\'s probability assignments over all classes carry structure that the ground-truth label discards.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Train a small model directly on the labeled dataset. The labels say "cat" or "dog" -- hard targets, one class gets probability 1, everything else gets 0. Standard cross-entropy training.',
        'This works when the small model has enough capacity and the dataset is large enough. For well-separated classes with abundant data, a compact architecture can learn the decision boundaries on its own.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hard labels erase inter-class relationships. The label [1, 0, 0, 0, 0] for a cat image says nothing about the fact that a cat looks more like a dog than like a car. A digit "8" looks somewhat like a "3" and a "6", but the hard label [0,0,0,0,0,0,0,0,1,0] treats every wrong class as equally wrong.',
        'A large model can rediscover those relationships from raw pixels because it has the capacity to build rich internal representations. A small model has fewer parameters, shallower layers, and narrower hidden dimensions. It needs more guidance per training example to learn the same structure -- guidance that hard labels do not provide.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The teacher\'s softmax output is not just a prediction; it is a map of the neighborhood. When the teacher says 78% cat, 13% dog, 6% fox, 2% car, 1% tree, it is encoding that dogs and foxes share visual features with cats while cars and trees do not. Hinton called this dark knowledge: the useful information hiding in the non-winning probabilities.',
        'To make the dark knowledge more visible, both teacher and student logits are divided by a temperature T > 1 before the softmax. At T = 1 the distribution is peaked and the small probabilities are nearly invisible. At T = 3 or higher, the distribution spreads out and the relative ranking among wrong classes becomes a clear training signal.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Train or select a teacher model. Run all training examples through the teacher and record the logits (pre-softmax values). For each example, compute two softmax outputs from those logits: one at T = 1 (the standard prediction) and one at a raised temperature T, typically 3 to 20.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: 'Transformer model architecture diagram with attention and feed-forward blocks', caption: 'Transformer teachers can expose dark knowledge through output logits, attention states, or hidden-state targets depending on the distillation recipe. Source: https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.' },
        'The student trains with a combined loss. The first term is the standard cross-entropy between the student\'s T = 1 output and the hard label. The second term is the KL divergence between the student\'s softened output (at temperature T) and the teacher\'s softened output (at the same T). The total loss is: L = (1 - alpha) * CE_hard + alpha * T^2 * KL_soft. The T^2 factor compensates for the reduced gradient magnitude that comes from spreading probability mass.',
        'Typical hyperparameters: T between 3 and 20, alpha between 0.1 and 0.9. Higher T exposes more dark knowledge but makes the distribution flatter, so the student needs enough capacity to exploit the signal. Alpha controls how much the student listens to the teacher versus the ground truth.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each soft label carries more information per training example than a hard label. A hard label provides one bit of class identity: the winner. A soft distribution provides a ranking, a measure of similarity between classes, and an estimate of the teacher\'s uncertainty. The student extracts more learning signal from the same dataset without needing more examples.',
        'The teacher also acts as a regularizer. Its soft outputs smooth over noisy or ambiguous labels in the original dataset. When the ground truth is "cat" but the image is borderline, the teacher might say 60% cat, 30% dog -- a more honest target than 100% cat. The student trained on that honest target generalizes better on ambiguous inputs.',
        'There is a limit. Distillation is compression, not magic. A very small student cannot absorb everything a very large teacher knows. The capacity gap sets a floor on how much accuracy is lost.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The one-time cost is running the teacher on every training example to generate soft labels. For a dataset of N examples, this is N forward passes through the large model. Once stored, the soft labels are reused across all student training runs.',
        'Student training itself is standard gradient descent -- same cost as training any model of that size, just with a richer loss function. No architectural changes to the student are required.',
        'The payoff is at inference. The student is typically 2-10x smaller than the teacher. DistilBERT (Sanh et al. 2019) has 66 million parameters versus BERT\'s 110 million: 40% smaller, 60% faster, and retains 97% of BERT\'s accuracy on GLUE benchmarks. Stack quantization on top of a distilled student and the compression multiplies.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DistilBERT (2019): 60% of BERT\'s size, 97% of its accuracy, fast enough for on-device NLP. TinyBERT (Jiao et al. 2019) extends distillation to transformer internals -- attention matrices and hidden states -- for even smaller students. MiniLM (Wang et al. 2020) distills self-attention relations specifically.',
        'MobileNet and EfficientNet families use distillation to train compact vision models for phones and edge devices. Google uses distillation in search ranking to deploy ensemble-quality relevance scoring at single-model cost.',
        'In LLM pipelines, distillation takes the form of training smaller models on outputs generated by a frontier model -- the teacher produces reasoning traces, the student learns from them. DeepSeek-R1 distills a strong reasoning teacher into smaller Qwen and Llama models.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The teacher must be good. Distilling a biased, miscalibrated, or hallucinating teacher transfers those flaws to the student. Garbage in, compressed garbage out.',
        'The capacity gap matters. A student with 50x fewer parameters than the teacher cannot absorb the full distribution of teacher behavior. It may retain average benchmark accuracy while losing tail behavior, rare-class performance, or calibration under distribution shift.',
        'Task-specific distillation does not transfer well. A student distilled for sentiment classification does not inherit the teacher\'s ability on question answering. Each deployment task typically needs its own distillation run.',
        'Quiet failure is the biggest risk. The student looks good on common cases -- the same ones that dominate benchmarks -- while silently dropping the rare but important behaviors that justified using the teacher in the first place. Evaluate on the deployment workload, not just the headline metric.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the teacher produces logits [5.0, 3.0, 1.0] for a three-class problem (classes A, B, C) where A is correct.',
        'At T = 1: softmax([5, 3, 1]) = [0.84, 0.11, 0.04]. Almost all mass on A. The ranking B > C is visible but faint -- only 7 percentage points apart. This is close to a hard label.',
        'At T = 3: softmax([5/3, 3/3, 1/3]) = softmax([1.67, 1.0, 0.33]) = [0.45, 0.30, 0.25]. Now the dark knowledge is exposed: B gets 30%, C gets 25%. The student can clearly see that B is more similar to A than C is.',
        'The student trains against [0.45, 0.30, 0.25] (the KL divergence term) and against [1, 0, 0] (the cross-entropy term). The combined loss teaches the student both the correct answer and the inter-class structure. At inference, the student runs at T = 1 -- normal softmax, no temperature scaling needed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Hinton, Vinyals, and Dean, Distilling the Knowledge in a Neural Network (2015): https://arxiv.org/abs/1503.02531 -- the founding paper that named dark knowledge and introduced temperature-scaled soft targets. Sanh et al., DistilBERT (2019): https://arxiv.org/abs/1910.01108 -- the clearest NLP case study. Jiao et al., TinyBERT (2019): https://arxiv.org/abs/1909.10351 -- extends distillation to attention matrices and hidden layers.',
        'Prerequisites: Softmax and Temperature (the T parameter that controls soft target entropy), Cross-Entropy Loss (the hard-label objective), Gradient Descent (the student update rule). Extensions: Transfer Learning (related idea of reusing learned representations), Model Quantization (reduce numeric precision for further compression), Structured Pruning (remove weights for complementary compression), Speculative Decoding (use a small model to draft tokens for a larger one).',
      ],
    },
  ],
};
