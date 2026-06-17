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
      heading: 'Why this exists',
      paragraphs: [
        'Large models are expensive to serve. They may have the accuracy, calibration, or reasoning behavior a team wants, but their latency, memory use, and cost can make them unsuitable for mobile devices, browsers, embedded systems, or high-throughput production endpoints.',
        'Knowledge distillation exists to transfer some of a large teacher model into a smaller student model. The student is not just trained on the original answer key. It is trained to imitate the teacher behavior that made the larger model useful.',
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        'The obvious compression tools are pruning, quantization, and smaller architectures. Those can help a lot, but they mostly ask how to make the same model cheaper or how to train a small model from the same dataset.',
        'The wall is that the dataset often contains only hard labels or final answers. A hard label says "cat" and says nothing about why dog is a more reasonable mistake than tree. A smaller model trained only on hard labels has to rediscover that structure from examples it may not have enough capacity or data to absorb.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The teacher probability distribution contains information that the one-hot label discards. If the correct class is cat, a strong teacher may assign some probability to dog and fox, and almost none to car or tree. That pattern tells the student which alternatives are semantically close.',
        'Hinton, Vinyals, and Dean called this dark knowledge: the useful structure in the non-winning probabilities. Distillation turns that structure into a training target for the student.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The first row is the teacher distribution for one cat image. Do not read only the largest cell. The smaller dog and fox probabilities are the lesson: they show which wrong answers the teacher considers plausible.',
        'Use the control to compare soft labels with hard labels. In the soft-label path, the student learns a shaped distribution: cat high, dog next, fox next, unrelated classes near zero. In the hard-label path, the student is pushed toward a spike. It learns the answer but loses the teacher ranking among mistakes.',
        'The epoch rows are not meant to be a full optimizer. They show the direction of training. With soft targets the student moves toward the teacher worldview; with hard labels it moves toward certainty without the teacher nuance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First choose or train a teacher. Then run training examples through the teacher and capture logits, probabilities, generated answers, hidden states, attention relations, or other signals depending on the distillation recipe. The student is trained with gradient descent to match those teacher signals.',
        'For classification, the classic loss matches softened teacher probabilities. Softmax temperature matters: a temperature greater than 1 spreads probability mass so non-winning classes carry visible signal. Many implementations combine the distillation loss with the original hard-label loss so the student learns both the teacher distribution and the ground-truth class.',
        'Distillation is not limited to final logits. Feature distillation matches hidden representations. TinyBERT and MiniLM distill transformer internals. Sequence-level distillation trains a language model on teacher-generated outputs. Reasoning distillation can train smaller models on traces or final answers produced by a stronger teacher, but those traces still need filtering and evaluation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A hard label has one bit of semantic shape: the winner. A teacher distribution has a neighborhood. It can say that a tabby cat is closer to dog and fox than to car, or that two possible translations are both plausible while a third is ungrammatical. The student sees more information per example.',
        'The student also benefits from the teacher smoothing away some dataset noise. If the original label is brittle or underspecified, the teacher distribution can be a better target than a rigid one-hot answer. That is not magic. It works only when the teacher is actually better calibrated or more knowledgeable for the task.',
        'Capacity still matters. A tiny student cannot inherit every skill from a huge teacher. Distillation is a compression method, not a proof that the smaller model can represent the whole teacher.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'In the animation, the teacher sees a cat and predicts 78 percent cat, 13 percent dog, 6 percent fox, 2 percent car, and 1 percent tree. The hard label is simply 100 percent cat. Both targets agree on the winner, but they teach different lessons.',
        'A student trained on the hard label is rewarded for moving all probability mass to cat. A student trained on the teacher distribution is rewarded for learning the ranking cat > dog > fox > car > tree. That ranking can improve generalization on ambiguous images because the student has learned a local map of the class space, not just the answer for one example.',
        'The same pattern appears in language models. A teacher answer, critique, preference ranking, or reasoning trace can expose structure that the original dataset did not contain. The student may become cheaper to serve while preserving enough of the teacher behavior to be useful.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The student is cheaper at inference, but distillation adds training cost. Generating teacher logits, hidden states, synthetic answers, or reasoning traces can be expensive, especially when the teacher is a frontier-scale model or an ensemble.',
        'Storage can also matter. Full probability distributions over large vocabularies are expensive to save, so systems may store logits for selected tokens, generate data on the fly, or distill from sampled outputs instead of full distributions.',
        'The biggest tradeoff is fidelity versus efficiency. A smaller student may preserve average benchmark score while losing calibration, tail behavior, rare skills, refusal boundaries, or robustness under distribution shift. Compression should be measured on the deployment workload, not only on a headline benchmark.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Distillation wins when the teacher is strong, the student has enough capacity, the training data covers the deployment distribution, and the target behavior is smooth enough to imitate. It is common in search ranking, vision ensembles, speech models, on-device NLP, and LLM instruction pipelines.',
        'It fails when the teacher is wrong, biased, hallucinated, miscalibrated, or strong only on examples unlike the deployment workload. It can also fail quietly: the student may look good on easy cases while losing the rare behavior that justified the teacher in the first place.',
        'It pairs well with other efficiency tools. Quantization changes numeric precision. Structured Pruning and N:M Sparsity change weight layout. LoRA Fine-Tuning adapts a model cheaply. Speculative Decoding uses a small model to draft tokens for a larger one. Distillation is different: it trains a cheaper model to imitate a more expensive source of behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The canonical source is Hinton, Vinyals, and Dean, Distilling the Knowledge in a Neural Network: https://arxiv.org/abs/1503.02531. DistilBERT is the clean NLP reference for shrinking BERT while preserving most benchmark quality: https://arxiv.org/abs/1910.01108. TinyBERT extends distillation across transformer layers and attention structures: https://arxiv.org/abs/1909.10351.',
        'MiniLM focuses on distilling self-attention relation knowledge for smaller language models: https://arxiv.org/abs/2002.10957. DeepSeek-R1 makes a modern reasoning-model version visible by distilling samples from a stronger reasoning teacher into smaller Qwen and Llama based models: https://github.com/deepseek-ai/DeepSeek-R1.',
        'Study Softmax & Temperature for softened targets, Neural Network Forward Pass for logits and hidden states, and Gradient Descent for the student update. Then compare Quantization, Structured Pruning and N:M Sparsity, LoRA Fine-Tuning, Speculative Decoding, and Early-Exit Transformer Layer Skipping as complementary efficiency tools.',
      ],
    },
  ],
};
