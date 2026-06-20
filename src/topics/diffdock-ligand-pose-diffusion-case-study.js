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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Pose manifold" shows the state variables that define a ligand pose -- translation, rotation, torsion, and the molecular graph -- then walks through denoising as the ligand moves from a random arrangement into plausible pocket contacts. "Ranked samples" shows the output as a decision table: multiple candidate poses scored by confidence and chemistry checks, routed for downstream action.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current decision point: which pose variable is being adjusted, which candidate is being scored.',
            'Compare nodes show the structure being measured against -- the pose node during denoising, the alternative candidates during ranking.',
            'Found nodes are confirmed outcomes: a pocket contact that landed, a confidence score that cleared triage.',
          ],
        },
        'In the matrix views, rows are pose variables or candidates and columns are properties. Watch the contact edges during denoising: the ligand-to-residue edges light up when pose variables bring atoms into plausible binding distance.',
        {
          type: 'note',
          text: 'The animation uses a 3-atom ligand and a 3-residue pocket for readability. Real docking handles ligands with 20-80 heavy atoms, 5-15 rotatable bonds, and pockets defined by dozens of residues. The data structures are the same -- pose variables plus molecular graphs -- but the dimensionality and sampling cost scale with molecular complexity.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'We frame molecular docking as a generative modeling problem and develop DiffDock, a diffusion generative model over the non-Euclidean manifold of ligand poses.',
          attribution: 'Corso et al., "DiffDock: Diffusion Steps, Twists, and Turns for Molecular Docking" (ICLR 2023), Abstract',
        },
        'Molecular docking asks where a small molecule (the ligand) sits inside a protein binding pocket. The answer is a 3D pose: a position, an orientation, and a set of torsion angles around rotatable bonds. That pose determines whether the molecule can bind, inhibit, activate, or fail. The output is a geometric hypothesis that chemists inspect, simulate around, or send to an assay.',
        'A ligand pose couples several degrees of freedom. Position is three Cartesian coordinates. Orientation lives on the rotation group SO(3). Each rotatable bond adds a torsion angle on the circle. The protein pocket adds steric constraints, charge patterns, and residue geometry. A plausible pose must satisfy all of these simultaneously.',
        {type:'callout', text:'DiffDock samples ranked hypotheses on the pose manifold, not forcing a non-Euclidean, multimodal binding problem into one coordinate regression.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/97/Docking_representation_2.png', alt:'Schematic of a small molecule ligand docking into a protein target.', caption:'Molecular docking representation. Source: Wikimedia Commons, Scigenis, CC BY-SA 4.0.'},
        {
          type: 'table',
          headers: ['Degree of freedom', 'Space', 'What it controls'],
          rows: [
            ['Translation (x, y, z)', 'R^3', 'Where the ligand center sits in the pocket'],
            ['Rotation', 'SO(3)', 'How the ligand faces the binding site'],
            ['Torsion (per bond)', 'S^1 each', 'Internal shape around each rotatable bond'],
            ['Ligand graph', 'Fixed topology', 'Which atoms exist and how they connect'],
            ['Pocket context', 'Fixed structure', 'Residues, geometry, and constraints the pose must satisfy'],
          ],
        },
        'DiffDock exists because one-shot coordinate regression is too brittle for this problem. The pose manifold is non-Euclidean, binding pockets admit multiple plausible orientations, and a single predicted pose hides the uncertainty that downstream decisions need.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Two approaches dominate before DiffDock.',
        {
          type: 'diagram',
          text: 'Search-based docking (AutoDock, Glide, GOLD):\n  enumerate translations x rotations x torsions\n  --> score each pose with physics/empirical function\n  --> keep top K\n  Cost: exponential in rotatable bonds; minutes to hours per ligand\n\nRegression docking (EquiBind, TANKBind):\n  feed protein + ligand to a neural network\n  --> predict one pose directly\n  Cost: one forward pass; seconds per ligand\n  Risk: commits to a single answer, no uncertainty',
          label: 'Search is thorough but slow; regression is fast but brittle',
        },
        'Search-based docking respects that multiple poses may exist, but it scales poorly. A ligand with 10 rotatable bonds creates a 16-dimensional search space (3 translation + 3 rotation + 10 torsion). Exhaustive enumeration is infeasible; heuristic search depends on scoring function quality and can miss basins.',
        'Regression docking is fast -- one forward pass produces atom coordinates. But it forces the model to commit to a single pose, averaging over possibilities or picking one fragile answer. There is no candidate set, no confidence estimate, and no way to preserve alternative orientations for downstream review.',
        {
          type: 'note',
          text: 'EquiBind (Stark et al., ICML 2022) predicts ligand coordinates in one step. It runs in seconds but produces a single pose with no uncertainty. TANKBind predicts binding site and pose jointly. Both are fast but sacrifice the multimodal output that virtual screening needs.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is pose geometry. Translation is Euclidean, but rotation is not -- orientations live on SO(3), and torsion angles wrap around each bond. A model that treats all coordinates as independent scalars can move through invalid states, average across discontinuities, and learn the wrong geometry.',
        {
          type: 'diagram',
          text: 'Pose space is a product manifold:\n\n  P = R^3  x  SO(3)  x  (S^1)^m\n      ^^^      ^^^^^      ^^^^^^^\n   position  orientation  m torsion angles\n\nFlat regression treats P as R^(6+m).\nThis breaks because:\n  - Averaging two rotations in R^3 gives a non-rotation\n  - Averaging torsion 350 deg and 10 deg gives 180 deg (wrong)\n  - Gradients through Euler angles hit gimbal lock\n\nThe sampler must respect the manifold structure.',
          label: 'Why flat coordinate regression fails on pose space',
        },
        'The second wall is multimodality. A pocket may support two or three plausible orientations -- a ligand flipped 180 degrees can sometimes still form valid contacts with different residues. Regression averages these modes into a pose that matches none of them.',
        {
          type: 'table',
          headers: ['Wall', 'What breaks', 'Consequence'],
          rows: [
            ['Non-Euclidean geometry', 'Flat regression averages invalid intermediate states', 'Predicted poses violate rotation/torsion constraints'],
            ['Multimodality', 'Single-pose output hides alternative binding modes', 'Pipeline loses candidates that may be better after chemistry review'],
            ['Chemistry beyond the model', 'Water, ions, protonation, flexibility, cofactors', 'Geometrically plausible pose fails experimentally'],
          ],
        },
        'The third wall is chemistry the model cannot see. A pose can look geometrically perfect and still fail because explicit water molecules bridge the binding interface, a metal ion coordinates the ligand, or the protein changes conformation on binding. A useful docking tool must produce ranked hypotheses, not false guarantees.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace regression with diffusion over the pose manifold. Instead of predicting coordinates in one step, start from noise in the product space R^3 x SO(3) x (S^1)^m and learn to denoise toward plausible binding poses.',
        {
          type: 'diagram',
          text: 'Diffusion on the pose manifold:\n\n  t=T (noise)                       t=0 (pose)\n  random position              -->  centered in pocket\n  random orientation            -->  donor faces acceptor\n  random torsion angles         -->  bonds adopt plausible dihedrals\n\n  Each denoising step is a small move on the product manifold,\n  conditioned on the ligand graph and protein pocket.\n  The move respects the geometry of each component space.',
          label: 'Denoising refines all pose variables jointly toward the pocket',
        },
        'Each denoising step operates on the correct manifold for each variable. Translational updates move in R^3. Rotational updates compose rotations in SO(3). Torsional updates shift angles on the circle. The ligand graph stays fixed -- atoms and bonds define what can move together.',
        {
          type: 'code',
          language: 'text',
          text: '# DiffDock pose update (pseudocode)\nfor step in reverse(T, T-1, ..., 1, 0):\n    # Score model predicts update direction on the manifold\n    score_tr, score_rot, score_tor = model(ligand_graph, pocket, noisy_pose, step)\n\n    # Each update respects the geometry of its space\n    translation += score_tr * step_size              # R^3 addition\n    rotation     = rotation @ exp_map(score_rot)     # SO(3) composition\n    torsions    += score_tor * step_size  (mod 2*pi) # S^1 wrapping\n\n    # Add noise scaled to current diffusion level\n    translation += noise_tr(sigma[step])\n    rotation     = rotation @ random_rotation(sigma[step])\n    torsions    += noise_tor(sigma[step])  (mod 2*pi)',
        },
        'The second insight: output a ranked candidate set, not a single pose. Run the sampler K times with different seeds. Each run lands in a potentially different basin of pose space. A confidence model scores each candidate. The output becomes a ledger of poses with scores, contacts, and routing decisions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has four stages: graph construction, forward diffusion (training), reverse diffusion (inference), and confidence ranking.',
        {
          type: 'table',
          headers: ['Stage', 'Input', 'Output', 'Key operation'],
          rows: [
            ['1. Graph construction', 'Ligand SMILES + protein PDB', 'Ligand graph + pocket graph', 'RDKit featurization, pocket extraction within cutoff radius'],
            ['2. Forward diffusion', 'Known pose (training data)', 'Noisy pose at each timestep t', 'Add noise on R^3, SO(3), and (S^1)^m'],
            ['3. Reverse diffusion', 'Random noisy pose + graphs', 'Denoised candidate pose', 'Score model predicts manifold-aware updates'],
            ['4. Confidence ranking', 'K candidate poses', 'Ranked pose ledger', 'Confidence head scores each pose; chemistry checks filter'],
          ],
        },
        'The score model is an equivariant graph neural network. It takes the ligand graph, pocket graph, and current noisy pose as input. Equivariance means that rotating the entire system rotates the predicted score accordingly -- the architecture enforces rotational consistency instead of learning it from data.',
        {
          type: 'diagram',
          text: 'Score model architecture:\n\n  ligand graph ----+\n                   |--> cross-attention / message passing --> score_tr  (R^3)\n  pocket graph ----+    over geometric features              score_rot (so(3))\n                   |                                         score_tor (R^m)\n  noisy pose ------+\n  timestep t ------+\n\n  Equivariant layers ensure:\n    rotate(input) --> rotate(score)\n    translate(input) --> same score (translation equivariance)',
          label: 'The score model predicts update directions on the pose manifold',
        },
        'At inference, the sampler starts from a random pose near the pocket and runs S denoising steps. Each step queries the score model, computes updates for translation, rotation, and torsion, applies them on their respective manifolds, and adds noise scaled to the current diffusion level. After S steps, the result is one candidate pose.',
        'Running this K times with different random seeds produces K candidates. The confidence head -- a separate MLP trained to predict whether a pose is within 2 Angstrom RMSD of the crystal pose -- scores each candidate.',
        {
          type: 'code',
          language: 'javascript',
          text: '// DiffDock inference pipeline (pseudocode)\nfunction dockWithPoseDiffusion(ligandGraph, pocketGraph, config) {\n  const candidates = [];\n\n  for (let seed = 0; seed < config.K; seed++) {\n    let pose = randomPoseNearPocket(seed, pocketGraph);\n\n    for (let step = config.S - 1; step >= 0; step--) {\n      const score = scoreModel(ligandGraph, pocketGraph, pose, step);\n      pose = manifoldUpdate(pose, score, noiseSchedule[step]);\n    }\n\n    const coords = materializeCoordinates(ligandGraph, pose);\n    const contacts = evaluateContacts(coords, pocketGraph);\n    const clashes = countClashes(coords, pocketGraph);\n    const conf = confidenceHead(ligandGraph, pocketGraph, pose);\n\n    candidates.push({ seed, pose, coords, conf, contacts, clashes });\n  }\n\n  return candidates.sort((a, b) => b.conf - a.conf);\n}',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on three properties: manifold-aware sampling, multimodal coverage, and structural conservation.',
        {
          type: 'table',
          headers: ['Property', 'How DiffDock preserves it', 'What breaks without it'],
          rows: [
            ['Manifold geometry', 'Updates compose rotations in SO(3), wrap torsions on S^1', 'Flat regression produces non-rotations and averages across angle discontinuities'],
            ['Multimodality', 'K independent denoising runs can land in different pose basins', 'Single regression collapses modes into one average pose'],
            ['Graph conservation', 'Ligand topology is fixed; only pose variables change', 'Atom-level regression can break bonds or invent atoms'],
            ['Pocket conditioning', 'Score model sees pocket residues at every denoising step', 'Unconditional sampling ignores steric and chemical constraints'],
          ],
        },
        'Diffusion decomposes one hard prediction into many small corrections. Each denoising step only needs to improve the pose slightly given the current state and the pocket context. The model never needs to jump from random noise to a perfect pose in one shot.',
        {
          type: 'quote',
          text: 'DiffDock obtains a 38% top-1 success rate (RMSD < 2A) on PDBBind, compared to 23% for the previous state-of-the-art.',
          attribution: 'Corso et al., ICLR 2023, Table 1',
        },
        'The confidence head does not prove binding. It estimates which sampled poses are geometrically close to what the training distribution considers correct. A high-confidence pose is a stronger hypothesis for downstream work -- not a substitute for free-energy calculations or experimental assays.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A virtual-screening team has one kinase pocket and 10,000 candidate ligands. For each ligand, the pipeline must produce ranked binding hypotheses fast enough to triage the library in hours, not weeks.',
        {
          type: 'diagram',
          text: 'Pipeline for one ligand:\n\n  Input:  ligand SMILES + kinase PDB structure\n  Step 1: Build ligand graph (atoms, bonds, 7 rotatable bonds)\n  Step 2: Extract pocket (residues within 10A of known binding site)\n  Step 3: Sample K=20 poses, S=20 denoising steps each\n  Step 4: Score with confidence head\n  Step 5: Filter: reject poses with > 2 steric clashes\n  Step 6: Rank remaining by confidence\n  Step 7: Keep top 3 for chemist review\n\n  Wall time per ligand: ~10 seconds (GPU)\n  Wall time for 10,000 ligands: ~28 hours (1 GPU)\n  Compare: AutoDock Vina ~5 min/ligand = 35 days for same library',
          label: 'DiffDock enables library-scale screening in hours instead of weeks',
        },
        {
          type: 'table',
          headers: ['Candidate', 'Confidence', 'RMSD proxy', 'Clashes', 'H-bond contacts', 'Route'],
          rows: [
            ['Pose 1', '0.84', '1.2 A', '0', 'Lys72, Asp184', 'Inspect -- top candidate'],
            ['Pose 2', '0.71', '2.8 A', '1', 'Glu91', 'Hold -- different orientation, minor clash'],
            ['Pose 3', '0.68', '3.1 A', '0', 'Lys72, Thr183', 'Inspect -- distinct torsion pattern'],
            ['Pose 4', '0.42', '5.4 A', '3', 'None', 'Reject -- poor contacts, multiple clashes'],
          ],
        },
        'Poses 1 and 3 both contact Lys72 but use different torsion patterns. A medicinal chemist might prefer Pose 3 if its torsion places a functional group in a synthetically accessible orientation. Collapsing to the top-confidence pose loses this alternative.',
        'The candidate ledger stores molecule ID, pocket definition, random seed, all pose variables, confidence, clash count, contact list, diversity cluster, and routing decision. This ledger is the real output -- not a single coordinate file.',
        {
          type: 'note',
          text: 'In practice, teams add post-processing: re-scoring with physics-based methods (MM-GBSA), clustering poses by RMSD to ensure diversity, filtering by pharmacophore constraints, and flagging poses where the confidence head disagrees with contact quality. DiffDock is a hypothesis generator; the pipeline is a decision system.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost dimension', 'What drives it', 'Typical scale'],
          rows: [
            ['Inference time', 'K samples x S steps x model forward pass', '~10s per ligand (K=20, S=20, single GPU)'],
            ['GPU memory', 'Ligand graph + pocket graph + intermediate features', '~2-4 GB per ligand; batch to fill GPU'],
            ['Storage', 'K poses x (coordinates + scores + contacts) per ligand', '~50 KB per ligand; 500 MB for 10K-ligand screen'],
            ['Confidence calibration', 'Training the confidence head on pose quality labels', 'Requires crystal-structure ground truth for training set'],
            ['Scoring gap', 'Confidence != binding affinity', 'Top pose by confidence may not be top pose by free energy'],
          ],
        },
        'Doubling samples K doubles inference time linearly but improves coverage of pose space. Doubling denoising steps S also doubles time but gives finer refinement. The practical tradeoff is K=20-40 samples with S=20 steps -- enough diversity for triage, cheap enough for library-scale screening.',
        'DiffDock is roughly 100-500x faster than traditional docking tools (AutoDock Vina, Glide) per ligand. The speedup comes from replacing combinatorial search with learned denoising. The cost is that learned confidence is not a physics-based binding prediction -- it estimates geometric quality, not thermodynamic favorability.',
        {
          type: 'note',
          text: 'DiffDock-L (Corso et al., 2024) uses a larger model, better training data, and a revised confidence head. Top-1 success rate on PDBBind rises from 38% to over 50%. The architecture is the same; gains come from scale and data quality.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Application', 'Why DiffDock fits', 'What else the pipeline needs'],
          rows: [
            ['Virtual screening', 'Fast pose generation for large compound libraries', 'Chemistry filters, diversity clustering, assay planning'],
            ['Hit triage', 'Ranked candidates with confidence and contacts', 'Medicinal chemistry review, selectivity checks'],
            ['Pose hypothesis for MD', 'Starting structures for molecular dynamics simulations', 'Force-field parameterization, equilibration, free-energy calculation'],
            ['Fragment-based design', 'Placing small fragments in a pocket to guide synthesis', 'Fragment merging, synthetic accessibility scoring'],
            ['Protein-ligand co-design', 'Evaluating designed molecules against target pockets', 'Generative chemistry models, ADMET prediction, retrosynthesis'],
          ],
        },
        'DiffDock wins when the bottleneck is pose throughput. Screening 100,000 molecules against 5 targets means 500,000 docking runs. At 10 seconds per run on one GPU, that is 58 days -- feasible with a small cluster. With AutoDock Vina at 5 minutes per run, the same screen takes 5.7 years on one CPU.',
        'It also wins when preserving alternative poses matters. Drug discovery pipelines lose value when they collapse to a single top-scoring pose too early. The ranked candidate ledger lets chemists inspect, cluster, and route alternatives before committing to expensive follow-up.',
        {
          type: 'note',
          text: 'DiffDock does not replace physics-based methods. It generates hypotheses fast. The best pipelines use DiffDock for initial sampling, filter by chemistry rules, re-score top candidates with MM-GBSA or FEP, and validate experimentally. Each layer reduces the candidate set at increasing cost and increasing reliability.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Wrong pocket geometry: if the input protein structure does not represent the binding-competent conformation (wrong rotamer, missing loop, AlphaFold artifact), the sampler docks into the wrong shape. Garbage in, confident garbage out.',
            'Out-of-distribution chemistry: metal coordination, covalent binding, unusual protonation states, and cofactor-dependent binding are underrepresented in training data. The model may produce geometrically plausible poses that violate the actual binding mechanism.',
            'Confidence-affinity gap: the confidence head predicts geometric quality (RMSD to crystal pose), not binding affinity. Screening teams that equate confidence with potency make bad triage decisions.',
            'Protein flexibility: DiffDock treats the pocket as rigid. Induced-fit binding, where the protein changes shape on ligand contact, is invisible to the model.',
            'Explicit solvent and ions: bridging water molecules and coordinating ions can be essential for binding. A pose that displaces a conserved water or ignores a catalytic metal may look correct but fail experimentally.',
            'Diversity collapse: if all K samples land in the same basin, the ranked list shows K variants of one pose. Teams should cluster candidates by RMSD and flag runs where all poses converge.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Detectable?', 'Mitigation'],
          rows: [
            ['Wrong pocket conformation', 'Sometimes (compare to experimental structures)', 'Ensemble docking with multiple pocket conformations'],
            ['Out-of-distribution ligand', 'Hard (model gives confident wrong answers)', 'Flag unusual functional groups; re-score with physics methods'],
            ['Confidence != affinity', 'Yes (compare to FEP ranking)', 'Re-score top candidates with MM-GBSA or relative FEP'],
            ['Diversity collapse', 'Yes (cluster poses by RMSD)', 'Increase K, vary random seeds, use diverse initialization'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Corso et al., "DiffDock" (ICLR 2023), arxiv:2210.01776', 'Original paper: diffusion on the pose manifold, score model architecture, PDBBind benchmarks'],
            ['ICLR 2023 OpenReview, id=kKF8_K-mBbS', 'Peer review discussion, reviewer concerns about generalization and confidence calibration'],
            ['github.com/gcorso/DiffDock', 'Reference implementation: model code, data processing, inference scripts'],
            ['Corso et al., "DiffDock-L" (2024)', 'Scaled-up version with improved accuracy and revised confidence training'],
            ['Stark et al., "EquiBind" (ICML 2022)', 'Direct regression baseline that DiffDock improves upon'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Diffusion Models for the denoising framework and score-based generative modeling that DiffDock adapts to non-Euclidean spaces.',
            'Prerequisite: study Graph Neural Networks for the equivariant message-passing architecture that processes ligand and pocket graphs.',
            'Extension: study Quality Diversity MAP-Elites for structured diversity preservation in candidate sets -- the same problem DiffDock faces when K samples collapse.',
            'Deeper physics: study molecular dynamics and binding free-energy methods (FEP, MM-GBSA) for the slower but more physically grounded validation that follows DiffDock in real pipelines.',
            'Broader pattern: study Surrogate-Assisted Evolution for the general strategy of using fast learned models to screen candidates before expensive evaluation.',
          ],
        },
      ],
    },
  ],
};
