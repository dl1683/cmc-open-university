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
// The big teacher's output for one photo of a cat — note the STRUCTURE:
// dog and fox get real probability (they look cat-like); car and tree don't.
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

  yield {
    state: matrixState({
      title: 'The teacher (7B params) sees a photo of a cat',
      rows: [{ id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [TEACHER],
      format: pct,
    }),
    highlight: { active: ['teacher:c0'] },
    explanation: 'A huge model is accurate but expensive to serve. We want a model 10× smaller — but training the small one from scratch on the same data gives mediocre results. Distillation\'s insight: the teacher\'s FULL output distribution holds more lessons per example than the right answer alone. Look at this prediction: 78% cat, but 13% dog, 6% fox… and ~0 for car. The teacher is revealing which mistakes are REASONABLE — what the field calls dark knowledge.',
  };

  yield {
    state: matrixState({
      title: soft ? 'Training target: the teacher\'s soft distribution' : 'Training target: the hard label (one-hot)',
      rows: [{ id: 'target', label: 'target' }],
      columns: cols,
      values: [target],
      format: pct,
    }),
    highlight: soft ? {} : { active: ['target:c0'] },
    explanation: soft
      ? 'The student\'s training target is the whole row — every probability, not just the winner. One example now teaches: "this is a cat, dogs and foxes are nearby concepts, cars and trees are unrelated." (In practice both models\' logits are softened with a temperature around T=2–4 first — see Softmax & Temperature — which amplifies exactly those small, information-rich probabilities.)'
      : 'The hard label says one thing: "cat, and nothing else matters." 100% cat, 0% everything — the fact that a dog resembles a cat more than a car does has been erased. The student will have to rediscover all of that structure on its own, example by example.',
  };

  let student = [...STUDENT_START];
  const rows = [{ id: 'e0', label: 'epoch 0' }];
  const values = [STUDENT_START];
  for (let epoch = 1; epoch <= 3; epoch += 1) {
    student = student.map((s, j) => s + 0.55 * (target[j] - s));
    const total = student.reduce((a, b) => a + b, 0);
    student = student.map((s) => s / total);
    rows.push({ id: `e${epoch}`, label: `epoch ${epoch}` });
    values.push([...student]);
    yield {
      state: matrixState({
        title: 'The student (tiny model) learning',
        rows: rows.map((r) => ({ ...r })),
        columns: cols,
        values: values.map((v) => [...v]),
        format: pct,
      }),
      highlight: { active: [`e${epoch}`] },
      explanation: `Epoch ${epoch}: the student's distribution moves toward the target. ${soft
        ? `It is absorbing the SHAPE: cat dominant, dog second, fox third — the teacher's worldview compressing into a smaller brain.`
        : `It is collapsing toward the one-hot spike — increasingly confident about "cat," learning nothing about what nearly-cat looks like.`}`,
      invariant: 'The student row always sums to 100% — it is still a softmax output.',
    };
  }

  yield {
    state: matrixState({
      title: soft ? 'Distilled student vs teacher' : 'Hard-label student vs teacher',
      rows: [{ id: 'student', label: 'student' }, { id: 'teacher', label: 'teacher' }],
      columns: cols,
      values: [[...student], TEACHER],
      format: pct,
    }),
    highlight: {},
    explanation: soft
      ? 'After full training the student mimics the teacher\'s judgments — including its calibrated doubts — at a fraction of the size. This is not hypothetical: DistilBERT kept ~97% of BERT\'s quality at 40% smaller and 60% faster, and today\'s strongest small LLMs are routinely trained on frontier-model outputs (distillation at dataset scale). Stack Quantization on top of a distilled student and the compression multiplies.'
      : 'The hard-label student became confidently narrow: high accuracy on easy cases, but it never inherited the teacher\'s sense of which alternatives are plausible — so it generalizes worse on ambiguous inputs. Flip the control to soft labels and compare the final rows: the difference IS the dark knowledge.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Knowledge distillation trains a smaller student model to imitate a stronger teacher model. Hinton, Vinyals, and Dean popularized the recipe in the 2015 paper "Distilling the Knowledge in a Neural Network": the teacher's full probability distribution contains more information than a one-hot label. A label says "cat." A teacher might say 0.78 cat, 0.13 dog, 0.06 fox, and near zero for truck. Those near-misses are useful structure.`,
        `The goal is compression without merely deleting weights. The student has fewer layers, narrower hidden states, or a simpler architecture, but it learns the teacher's behavior. This can make inference cheaper, reduce latency, and fit models onto phones, browsers, or high-throughput servers. Unlike Quantization, which changes number precision, distillation changes the model being trained.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `First train or choose a teacher. Then run training examples through the teacher and capture logits or probabilities. Softmax & Temperature is the key trick: a temperature T greater than 1 softens the distribution so non-winning classes carry visible signal. The student is trained with a mixture of losses: match the teacher's softened outputs and, often, match the original hard labels. Gradient Descent updates only the student.`,
        `Distillation can happen at several levels. Logit distillation matches final predictions. Feature distillation matches hidden representations. Sequence-level distillation for language models trains on teacher-generated answers. TinyBERT and MiniLM distill transformer internals; DistilBERT removes layers and trains on language-modeling plus distillation objectives. The common theme is that the teacher provides a richer target than the dataset alone.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The student is cheaper at inference, but training has an extra bill: teacher generation. If the teacher is large, producing logits or synthetic answers can dominate the cost. DistilBERT is the clean reference point: compared with BERT-base's 110M parameters, it uses about 66M parameters, is roughly 40% smaller and 60% faster, and reports about 97% of BERT's GLUE performance. Those numbers are impressive, but not universal; compression ratio depends on task difficulty, student capacity, data volume, and how closely the student architecture matches the teacher.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Distillation is common when a frontier or ensemble model is too expensive to serve directly. Search ranking stacks distill large rankers into fast production models. Vision systems distill ensembles into single CNNs or transformers. Speech and on-device NLP models use distilled students to meet battery and latency budgets. Modern LLM pipelines often use strong models to generate instruction data, critiques, or reasoning traces for smaller open models, though the exact recipe is usually proprietary and must be evaluated rather than assumed.`,
        `It also pairs well with LoRA Fine-Tuning: a teacher can produce higher-quality task data, then a smaller or adapted student learns from it. Quantization can be applied afterward for another memory cut.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Distillation does not create knowledge from nothing. A biased or hallucinating teacher trains a biased or hallucinating student. A weak student may mimic easy cases while losing rare skills, calibration, or safety behavior. Temperature is another sharp edge: T = 1 can hide useful dark knowledge; too high makes targets nearly uniform. Many implementations multiply the soft-target loss by T squared so gradient magnitudes stay comparable as temperature changes.`,
        `Do not judge a distilled model only by average accuracy. Check tail cases, calibration, latency, memory, and robustness. Dropout and Regularization: L1 & L2 may still be needed because the student can overfit the teacher's artifacts, especially on small synthetic datasets.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Softmax & Temperature for softened targets, Neural Network Forward Pass for logits and hidden states, and Gradient Descent for the student update. Quantization and LoRA Fine-Tuning show two complementary efficiency tools, while Dropout and Regularization: L1 & L2 explain why a smaller student still needs generalization pressure.`,
      ],
    },
  ],
};