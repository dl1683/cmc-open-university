// DiffDock turns molecular docking into diffusion over ligand pose variables:
// translation, rotation, and torsion are sampled and denoised against a protein
// pocket instead of regressed in one shot.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'diffdock-ligand-pose-diffusion-case-study',
  title: 'DiffDock Ligand Pose Diffusion Case Study',
  category: 'AI & ML',
  summary: 'Molecular docking as pose diffusion: ligand graphs, pocket context, translation-rotation-torsion variables, confidence heads, and candidate ranking.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pose manifold', 'ranked samples'], defaultValue: 'pose manifold' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function dockingGraph(title, offset = 1.0) {
  const shift = (base, delta) => base + delta * offset;
  return graphState({
    nodes: [
      { id: 'p1', label: 'pocket', x: 1.0, y: 2.5, note: 'protein' },
      { id: 'p2', label: 'site', x: 2.4, y: 1.7, note: 'residue' },
      { id: 'p3', label: 'site', x: 2.6, y: 4.3, note: 'residue' },
      { id: 'ligA', label: 'C', x: shift(6.6, -1.8), y: shift(2.4, -0.7), note: 'ligand' },
      { id: 'ligB', label: 'N', x: shift(7.3, 1.1), y: shift(3.1, 0.8), note: 'ligand' },
      { id: 'ligC', label: 'O', x: shift(6.7, -1.0), y: shift(4.2, 1.2), note: 'ligand' },
      { id: 'score', label: 'score', x: 8.8, y: 3.3, note: 'conf' },
      { id: 'pose', label: 'pose', x: 5.0, y: 3.3, note: 'T R tau' },
    ],
    edges: [
      { id: 'e-p1-p2', from: 'p1', to: 'p2', weight: 'edge' },
      { id: 'e-p1-p3', from: 'p1', to: 'p3', weight: 'edge' },
      { id: 'e-p2-p3', from: 'p2', to: 'p3', weight: 'pocket' },
      { id: 'e-pose-a', from: 'pose', to: 'ligA' },
      { id: 'e-a-b', from: 'ligA', to: 'ligB', weight: 'bond' },
      { id: 'e-b-c', from: 'ligB', to: 'ligC', weight: 'torsion' },
      { id: 'e-p2-ligA', from: 'p2', to: 'ligA', weight: 'contact' },
      { id: 'e-p3-ligC', from: 'p3', to: 'ligC', weight: 'contact' },
      { id: 'e-lig-score', from: 'ligB', to: 'score' },
    ],
  }, { title });
}

function* poseManifold() {
  yield {
    state: labelMatrix(
      'Pose state',
      [
        { id: 'trans', label: 'T' },
        { id: 'rot', label: 'R' },
        { id: 'tor', label: 'tau' },
        { id: 'graph', label: 'graph' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['xyz', 'where'],
        ['rot', 'face'],
        ['angles', 'shape'],
        ['atoms', 'chem'],
      ],
    ),
    highlight: { active: ['trans:stores', 'rot:stores', 'tor:stores'], found: ['graph:why'] },
    explanation: 'Docking is not just predicting one vector. A ligand pose has translation, rotation, and torsion degrees of freedom, plus the ligand graph and pocket context that make those variables chemically meaningful.',
    invariant: 'The sampler must move on the pose manifold, not treat every coordinate as an independent table cell.',
  };

  yield {
    state: dockingGraph('Random ligand pose near a protein pocket', 1.0),
    highlight: { active: ['p1', 'p2', 'p3', 'ligA', 'ligB', 'ligC'], compare: ['pose'] },
    explanation: 'DiffDock starts from noisy pose variables around a pocket. The protein pocket and ligand graph provide the conditioning context; the sample itself is a proposed 3D arrangement of the ligand.',
  };

  yield {
    state: dockingGraph('Denoising aligns contacts and torsions', 0.25),
    highlight: { active: ['e-p2-ligA', 'e-p3-ligC', 'e-a-b', 'e-b-c', 'pose'], found: ['score'] },
    explanation: 'Denoising adjusts translation, rotation, and torsion so ligand atoms land in a plausible pocket pose. The graph keeps the molecule connected while the pose variables move through space.',
  };

  yield {
    state: labelMatrix(
      'Search frame',
      [
        { id: 'old', label: 'old' },
        { id: 'reg', label: 'reg' },
        { id: 'diff', label: 'diff' },
        { id: 'rank', label: 'rank' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'failure', label: 'risk' },
      ],
      [
        ['enum', 'slow'],
        ['1 pose', 'fragile'],
        ['K pose', 'cost'],
        ['conf', 'misrank'],
      ],
    ),
    highlight: { active: ['diff:move', 'rank:move'], compare: ['old:failure', 'reg:failure'] },
    explanation: 'The data-structure lesson is that generative sampling can replace brittle single-pose regression. But the output still needs ranking, uncertainty, and downstream chemistry checks.',
  };
}

function* rankedSamples() {
  yield {
    state: plotState({
      axes: { x: { label: 'candidate', min: 1, max: 6 }, y: { label: 'score', min: 0, max: 100 } },
      series: [
        { id: 'conf', label: 'conf', points: [{ x: 1, y: 62 }, { x: 2, y: 84 }, { x: 3, y: 77 }, { x: 4, y: 49 }, { x: 5, y: 70 }, { x: 6, y: 57 }] },
        { id: 'contact', label: 'contact', points: [{ x: 1, y: 58 }, { x: 2, y: 88 }, { x: 3, y: 69 }, { x: 4, y: 40 }, { x: 5, y: 76 }, { x: 6, y: 54 }] },
      ],
      markers: [
        { id: 'pick', x: 2, y: 84, label: 'pick' },
      ],
    }),
    highlight: { active: ['conf', 'contact', 'pick'] },
    explanation: 'A docking run is a candidate set, not a single answer. The confidence head and contact checks decide which sampled pose deserves expensive follow-up.',
  };

  yield {
    state: labelMatrix(
      'Candidate ledger',
      [
        { id: 'c1', label: 'pose1' },
        { id: 'c2', label: 'pose2' },
        { id: 'c3', label: 'pose3' },
        { id: 'c4', label: 'pose4' },
      ],
      [
        { id: 'conf', label: 'conf' },
        { id: 'rmsd', label: 'proxy' },
        { id: 'route', label: 'route' },
      ],
      [
        ['mid', 'ok', 'hold'],
        ['high', 'good', 'check'],
        ['high', 'clash', 'reject'],
        ['low', 'unknown', 'again'],
      ],
    ),
    highlight: { active: ['c2:route'], compare: ['c3:rmsd', 'c4:route'] },
    explanation: 'The ranked sample table stores more than model confidence. It should keep clashes, pocket contacts, pose diversity, seed, and whether a chemist should inspect, reject, or resample.',
  };

  yield {
    state: dockingGraph('Selected pose becomes a review object', 0.1),
    highlight: { active: ['ligA', 'ligB', 'ligC', 'p2', 'p3', 'e-p2-ligA', 'e-p3-ligC', 'score'], found: ['pose'] },
    explanation: 'The selected pose is handed to downstream review with its graph, pocket contacts, torsions, score, and sample provenance. That provenance matters when later experiments disagree.',
  };

  yield {
    state: labelMatrix(
      'Virtual screen',
      [
        { id: 'lib', label: 'lib' },
        { id: 'sample', label: 'samp' },
        { id: 'gate', label: 'gate' },
        { id: 'exp', label: 'assay' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'decision', label: 'move' },
      ],
      [
        ['ligands', 'batch'],
        ['poses', 'top K'],
        ['conf', 'triage'],
        ['lab', 'verify'],
      ],
    ),
    highlight: { active: ['lib:decision', 'sample:decision', 'gate:decision', 'exp:decision'] },
    explanation: 'A virtual-screening team samples multiple poses for each molecule, ranks them by confidence and chemistry rules, keeps diverse candidates, and sends a small set to experimental testing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pose manifold') yield* poseManifold();
  else if (view === 'ranked samples') yield* rankedSamples();
  else throw new InputError('Pick a DiffDock view.');
}

export const article = {
  references: [
    { title: 'DiffDock: Diffusion Steps, Twists, and Turns for Molecular Docking', url: 'https://arxiv.org/abs/2210.01776' },
    { title: 'ICLR 2023 DiffDock entry', url: 'https://openreview.net/forum?id=kKF8_K-mBbS' },
    { title: 'DiffDock code and examples', url: 'https://github.com/gcorso/DiffDock' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Molecular docking asks how a small molecule ligand might sit inside a protein binding pocket. That pose matters because physical contact geometry affects whether a compound can bind, inhibit, activate, or fail. The output is not just a label; it is a three-dimensional hypothesis that chemists may inspect, simulate, synthesize around, or test in an assay.',
        'The hard part is that a ligand pose has several coupled degrees of freedom. The ligand has a position in space, an orientation, and torsion angles around rotatable bonds. The protein pocket has atoms, residues, geometry, charge patterns, steric constraints, and sometimes flexible conformations. A plausible pose must satisfy geometry and chemistry at the same time.',
        'DiffDock exists because treating docking as one-shot coordinate regression is too brittle. The ICLR 2023 paper frames docking as generative modeling over the non-Euclidean manifold of ligand poses. It maps the pose to translational, rotational, and torsional degrees of freedom and uses diffusion to sample candidate poses conditioned on the ligand and protein pocket: https://arxiv.org/abs/2210.01776.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classic computational approach is search. Enumerate possible translations, rotations, and torsions; score each pose with a physics-inspired or learned scoring function; keep the best candidates. This is reasonable because docking is naturally a search problem. The protein pocket is a constrained space, and the ligand can be tried in many arrangements.',
        'A modern machine-learning shortcut is direct prediction. Feed the protein and ligand to a model and ask for one pose. This is attractive because it can be fast at inference time and avoids hand-engineered search loops. If the model sees enough examples, perhaps it can learn the shape of good poses directly.',
        'Both approaches capture something real. Search respects that multiple poses may be possible, but it can be expensive and scoring can be noisy. Regression is fast, but it can average over possibilities or commit to one fragile answer. Docking needs speed, but it also needs a candidate set, uncertainty, and a representation that respects pose geometry.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the shape of pose space. Translation is Euclidean: move the ligand center in x, y, and z. Rotation is not just three independent numbers; orientations live on a rotation manifold. Torsion angles wrap around bonds. If a model treats all coordinates like ordinary independent scalars, it can move through invalid or unnatural states and learn the wrong geometry.',
        'The second wall is multimodality. A protein pocket may admit several plausible orientations or torsion patterns. A single predicted pose hides that uncertainty. In virtual screening, the top pose is a decision candidate, not experimental truth. The system needs to preserve alternatives until downstream filters, chemists, simulations, or assays can resolve them.',
        'The third wall is chemistry outside the model. A pose can look geometrically plausible and still fail because water molecules, ions, protonation states, induced fit, protein flexibility, assay conditions, or training-distribution gaps matter. A useful docking model must produce ranked hypotheses with provenance, not a false guarantee.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DiffDock turns docking into denoising over pose variables. Instead of regressing atom coordinates in one step, it starts from noisy ligand pose variables and repeatedly moves them toward more plausible states under protein-pocket and ligand-graph conditioning. Translation decides where the ligand is. Rotation decides how it faces. Torsion decides the internal shape around rotatable bonds.',
        'The ligand graph remains the chemical scaffold. Atoms and bonds define what can move together and which bonds can rotate. The protein pocket supplies context for contacts, sterics, and local geometry. The diffusion process searches pose space by learning how to reverse noise, not by enumerating every pose with a hand-coded scoring function.',
        'The second insight is that the output should be a ranked sample set. DiffDock can generate multiple candidate poses and use a confidence model to rank them. That changes the data structure of docking output from "the answer" to a ledger of candidate poses, scores, contacts, seeds, torsions, and follow-up decisions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A docking run starts by building structured inputs. The ligand becomes an atom-bond graph with rotatable bonds identified. The protein is represented through pocket context, usually focused around the binding site rather than the entire macromolecule. The model must reason over relative geometry, so equivariant geometric learning is a natural fit.',
        'The pose state is split into translation, rotation, and torsion. Translation moves the ligand center. Rotation changes the ligand orientation as a rigid body. Torsion angles rotate parts of the ligand around selected bonds while preserving the molecular graph. This factorization lets the sampler move on the pose manifold instead of treating every atom coordinate as unrelated.',
        'During noising, a known pose can be perturbed through these degrees of freedom. During denoising, the model learns a score or update direction that moves noisy states back toward plausible binding poses. At inference time, the sampler begins from random or noisy pose variables near the pocket and iteratively denoises them.',
        'The result is not a single deterministic pose. A run can sample several candidates by using different random seeds or sampling paths. Each candidate records translation, rotation, torsions, atom coordinates implied by those variables, model confidence, and often additional chemistry checks such as clashes or pocket contacts.',
        'A confidence head ranks candidates. This matters because denoising can produce multiple plausible poses, and the downstream workflow cannot inspect every sample from every molecule in a large screen. Ranking turns a generative sampler into a triage system: keep the best candidates, preserve useful diversity, reject obvious clashes, and route uncertain cases to more expensive review.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works as a modeling strategy because it matches the structure of the problem. Docking is not a flat table prediction. The valid moves are constrained by rigid-body motion, bond rotations, and the ligand graph. By modeling translation, rotation, and torsion directly, the sampler follows the variables that chemists and docking engines already care about.',
        'Diffusion helps because it can represent a distribution over answers. Denoising from noise to pose gives the model many small correction steps instead of one brittle jump. Multiple samples can land in different basins of plausible pose space, which is useful when the pocket supports more than one orientation or when the model is uncertain.',
        'The ligand graph provides a conservation rule. Torsion changes internal angles, but it does not invent new atoms or break ordinary bonds. The pocket context provides a conditioning rule. A pose is judged relative to the protein site, not as a molecule floating in empty space.',
        'The confidence model does not prove binding. It gives a learned estimate of which sampled poses are more likely to be useful. The right mental model is ranked hypothesis generation. A high-confidence pose is a stronger candidate for downstream work, not a replacement for experimental validation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a virtual-screening team with one protein pocket and a library of candidate ligands. For each ligand, the pipeline builds the ligand graph, identifies rotatable bonds, extracts or supplies pocket context, and runs the sampler to produce several candidate poses.',
        'Candidate 1 may place the ligand near the pocket but orient a hydrogen-bond donor away from the relevant residue. Candidate 2 may align the donor and acceptor pattern better but introduce a steric clash. Candidate 3 may have lower confidence but preserve a distinct torsion pattern that a chemist wants to inspect. The useful output is the table that keeps these differences visible.',
        'The candidate ledger should store molecule ID, protein target, pocket definition, random seed, translation, rotation, torsions, generated coordinates, confidence, clash checks, contact summaries, diversity cluster, and route. The route might be inspect, reject, resample, run a slower docking or simulation method, or send to assay planning.',
        'If the team collapses everything to the top confidence pose, it may lose a chemically interesting alternative. If it keeps every pose, it overloads review. The practical algorithm is sampling plus ranking plus diversity control. DiffDock supplies the generative pose proposals and confidence estimates; the pipeline still needs chemistry gates and decision policy.',
      ],
    },
    {
      heading: 'Animation focus',
      paragraphs: [
        'The pose-manifold view separates the state variables. Translation answers where the ligand center is. Rotation answers how the ligand faces the pocket. Torsion answers which internal shape the ligand has. The ligand graph and pocket context explain why those variables cannot be treated as unrelated numbers.',
        'The denoising frames show the ligand moving from a noisy arrangement toward better pocket contacts. The important detail is that the graph remains chemically meaningful while pose variables change. The model is not dragging independent atoms through space; it is adjusting a structured ligand pose.',
        'The ranked-samples view shows the output as a decision table. Confidence, contact checks, route, and candidate diversity are part of the algorithmic product. A docking model that returns only one coordinate set hides the uncertainty that virtual screening teams need to manage.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The main runtime cost is sampling. If the pipeline generates K poses for each ligand and uses S denoising steps per pose, inference cost grows with K times S times model cost. Reducing samples or steps improves throughput but may reduce diversity or accuracy. Large screens need batching, GPU utilization, and clear triage thresholds.',
        'The memory cost includes protein and ligand graphs, intermediate geometric features, pose variables, and candidate ledgers. For a single ligand this may be modest. For a virtual screen over thousands or millions of molecules, storing every candidate with full provenance becomes a real data-management problem.',
        'The accuracy tradeoff is between speed and physical detail. DiffDock can be much faster than exhaustive traditional search, but learned confidence is not a binding free-energy calculation. A pose may need slower follow-up methods, expert review, or experimental validation before it becomes a drug-discovery decision.',
        'There is also a representation tradeoff. A fixed or supplied protein pocket simplifies the problem. Real proteins move. Binding can depend on induced fit, allosteric states, water networks, cofactors, metals, protonation, tautomers, and experimental conditions. Those factors can dominate the final outcome even when the sampled pose looks good.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'DiffDock is strongest when a team needs fast candidate pose generation for many protein-ligand pairs. Virtual screening, hit triage, pose hypothesis generation, and early-stage medicinal chemistry can benefit from a model that produces ranked pose candidates quickly.',
        'It also wins when single-pose regression is too brittle. Sampling preserves alternatives, and confidence ranking gives the pipeline a way to choose which alternatives deserve attention. This is especially useful when the model is used as a front-end filter before slower computation or human review.',
        'The method is a good educational example because it connects graph neural networks, diffusion models, non-Euclidean state spaces, candidate ranking, and scientific decision ledgers. It shows that the data structure around a model output can be as important as the model score itself.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DiffDock can fail when the pocket conformation is wrong. If the supplied protein structure does not represent the binding-ready state, the sampler may place the ligand well in the wrong pocket geometry. Computationally predicted protein structures can be useful, but uncertainty in the pocket can propagate directly into docking errors.',
        'It can fail when chemistry is outside the training distribution. Unusual ligands, metal coordination, covalent binding, rare protonation states, explicit solvent effects, and cofactors may not be handled by a learned pose model unless the training and preprocessing pipeline support them.',
        'It can fail through misranking. A generated pose may be plausible, but the confidence head may prefer a visually clean pose that is not experimentally relevant. Conversely, a lower-confidence diverse pose may be worth preserving. The candidate ledger should support review instead of hiding everything behind one scalar.',
        'It can fail operationally when a screening pipeline treats model output as ground truth. Docking is a hypothesis generator. The right downstream question is not "did the model say yes?" but "which candidates are strong enough, diverse enough, and cheap enough to justify the next validation step?"',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Diffusion Models for the denoising objective, Graph Neural Networks for ligand and pocket representation, Quality Diversity MAP-Elites for preserving useful candidate diversity, Surrogate-Assisted Evolution for learned screening loops, and Molecular Dynamics or binding free-energy methods for slower physical validation.',
        'Primary sources are the DiffDock arXiv paper at https://arxiv.org/abs/2210.01776, the ICLR 2023 OpenReview entry at https://openreview.net/forum?id=kKF8_K-mBbS, and the implementation repository at https://github.com/gcorso/DiffDock. Read them with the article question in mind: how does the system represent pose, how does it sample alternatives, and how does it rank uncertainty for downstream decisions?',
      ],
    },
  ],
};
