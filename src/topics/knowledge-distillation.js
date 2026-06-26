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
        'Each row is a probability distribution over the same classes. The teacher row is the large model output, the target row is what the student trains against, and the epoch rows show the student moving toward that target.',
        { type: 'callout', text: 'Knowledge distillation compresses behavior, not just answers: the student learns from the teacher probability shape over all classes.' },
        'The safe inference rule is that non-winning probabilities still teach. If dog gets 13 percent and car gets 2 percent on a cat image, the teacher is saying dog is a closer mistake than car.',
        {type: 'image', src: './assets/gifs/knowledge-distillation.gif', alt: 'Animated walkthrough of the knowledge distillation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Large neural networks can be accurate but expensive to run. A smaller student model is cheaper at inference, but training it only on hard labels can lose useful structure.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered artificial neural network diagram with colored input hidden and output layers', caption: 'Distillation keeps the student architecture small while using the teacher output distribution as a richer supervision signal. Source: https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg.' },
        'Knowledge distillation exists to transfer a teacher model behavior into a smaller model. It is model compression by imitation: the student learns the teacher output distribution, not just the dataset label.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to train the small model on the original labels. For classification, a hard label says one class is 1 and every other class is 0.',
        'That works when the small model has enough capacity and enough data. It fails when the teacher knows useful class relationships that the hard label deletes.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Hard labels erase similarity among wrong answers. A cat image labeled [1,0,0,0,0] treats dog, fox, car, and tree as equally wrong, even though dog and fox are visually closer mistakes.',
        'A large teacher may have learned those relationships from many examples. A small student has less capacity, so each training example must carry more information if the student is going to generalize similarly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use the teacher probability distribution as the target. The full distribution contains the winning class, the ranking of plausible mistakes, and a calibration signal about uncertainty.',
        'Temperature makes that signal easier to see. Dividing logits by T greater than 1 before softmax spreads probability mass across classes, so the student can learn relationships among non-winning classes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Run each training example through the teacher and record logits, which are the pre-softmax scores. Compute a softened teacher distribution using temperature T, often between 3 and 20.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/The-Transformer-model-architecture.png', alt: 'Transformer model architecture diagram with attention and feed-forward blocks', caption: 'Transformer teachers can expose dark knowledge through output logits, attention states, or hidden-state targets depending on the distillation recipe. Source: https://commons.wikimedia.org/wiki/File:The-Transformer-model-architecture.png.' },
        'Train the student with a combined loss. One term compares the student to the hard label, and another term compares the softened student distribution to the softened teacher distribution with KL divergence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A soft target gives more information per example than a hard target. It says which mistakes are nearby, which mistakes are implausible, and how confident the teacher is.',
        'The teacher also smooths noisy labels. A borderline example can be taught as 60 percent class A and 35 percent class B instead of forcing the student to treat it as completely unambiguous.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The extra training cost is teacher inference over the transfer dataset. If there are N examples, distillation needs N teacher forward passes to produce soft targets, then normal student training afterward.',
        'The payoff is inference cost. If the teacher has 1 billion parameters and the student has 100 million, serving the student can reduce memory traffic and latency by roughly an order of magnitude before hardware and architecture constants.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Distillation is used to deploy smaller language, vision, speech, and ranking models. It is useful when a large model or ensemble is good enough to teach but too expensive for the target latency or device.',
        'Transformer distillation can also match internal states, attention maps, or token-level outputs. The common access pattern is offline teacher generation followed by many cheap student inferences.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Distillation transfers teacher flaws. Biases, calibration errors, hallucinations, and blind spots can survive compression because the student is trained to imitate them.',
        'The capacity gap also matters. A tiny student may match average accuracy while losing rare behaviors, tail classes, robustness, or long-chain reasoning that the teacher handled with more parameters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose teacher logits for classes cat, dog, and car are [5, 3, 0]. At T=1, softmax gives about [0.88, 0.12, 0.01], so the teacher is almost a hard cat label.',
        'At T=3, the logits become [1.67, 1.00, 0.00]. Softmax gives about [0.57, 0.29, 0.11], making dog visibly closer to cat than car is.',
        'A hard-label student trains against [1,0,0]. A distilled student trains partly against [0.57,0.29,0.11], so it learns the correct class and the teacher similarity structure.',
        'At inference, the student normally uses T=1 again. Temperature is a training device for exposing soft targets, not a requirement that the deployed model stay uncertain.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Hinton, Vinyals, and Dean, Distilling the Knowledge in a Neural Network, 2015, https://arxiv.org/abs/1503.02531. The paper introduced temperature-scaled soft targets and the dark-knowledge framing.',
        'Study softmax and cross-entropy first, then KL divergence and calibration. After that, study model quantization, pruning, transfer learning, and speculative decoding as complementary compression or serving techniques.',
      ],
    },
  ],
};
