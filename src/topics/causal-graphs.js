// Causal graphs: the treatment that wins in EVERY subgroup and loses
// overall - computed live from real clinical numbers - and the three-arrow
// grammar (chain, fork, collider) that explains when data tells the truth.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'causal-graphs',
  title: "Causal Graphs, Confounding & Simpson's Paradox",
  category: 'Concepts',
  summary: 'Treatment A beats B in both subgroups and loses in the total - live arithmetic - plus the DAG grammar that says what to adjust for and what never to touch.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ["Simpson's paradox, live", 'reading the DAG'], defaultValue: "Simpson's paradox, live" },
  ],
  run,
};

// The classic kidney-stone study (Charig et al. 1986), the four real cells.
// A = open surgery, B = percutaneous; strata = stone size.
const DATA = {
  A: { small: { ok: 81, n: 87 }, large: { ok: 192, n: 263 } },
  B: { small: { ok: 234, n: 270 }, large: { ok: 55, n: 80 } },
};
const rate = (c) => c.ok / c.n;
const pct = (x) => `${(100 * x).toFixed(0)}%`;
const total = (t) => ({ ok: t.small.ok + t.large.ok, n: t.small.n + t.large.n });
const N_ALL = total(DATA.A).n + total(DATA.B).n;
const PREV_SMALL = (DATA.A.small.n + DATA.B.small.n) / N_ALL;
// Backdoor adjustment: weight each stratum's rate by the OVERALL prevalence
// of that stratum, not by who happened to receive the treatment.
const adjusted = (t) => PREV_SMALL * rate(t.small) + (1 - PREV_SMALL) * rate(t.large);

// Collider bias, computed on a deterministic grid: talent and looks are
// independent by construction; selecting on their SUM manufactures a
// negative correlation among the selected. (Berkson's paradox.)
function colliderCorr() {
  const pts = [];
  for (let t = 0; t < 20; t++) for (let l = 0; l < 20; l++) if (t + l >= 19) pts.push([t, l]);
  const n = pts.length;
  const mt = pts.reduce((s, p) => s + p[0], 0) / n;
  const ml = pts.reduce((s, p) => s + p[1], 0) / n;
  let cov = 0;
  let vt = 0;
  let vl = 0;
  for (const [t, l] of pts) {
    cov += (t - mt) * (l - ml);
    vt += (t - mt) ** 2;
    vl += (l - ml) ** 2;
  }
  return cov / Math.sqrt(vt * vl);
}
const COLLIDER_R = colliderCorr();

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}

function* simpson() {
  yield {
    state: table('A real study, all four cells (kidney-stone treatments, 1986)', [
      ['small', 'small stones'],
      ['large', 'large stones'],
      ['totalRow', 'ALL patients'],
    ], [['a', 'treatment A (open surgery)'], ['b', 'treatment B (keyhole)']], [
      [`${DATA.A.small.ok}/${DATA.A.small.n} = ${pct(rate(DATA.A.small))} - A wins`, `${DATA.B.small.ok}/${DATA.B.small.n} = ${pct(rate(DATA.B.small))}`],
      [`${DATA.A.large.ok}/${DATA.A.large.n} = ${pct(rate(DATA.A.large))} - A wins`, `${DATA.B.large.ok}/${DATA.B.large.n} = ${pct(rate(DATA.B.large))}`],
      [`${total(DATA.A).ok}/${total(DATA.A).n} = ${pct(rate(total(DATA.A)))}`, `${total(DATA.B).ok}/${total(DATA.B).n} = ${pct(rate(total(DATA.B)))} - B "wins"?!`],
    ]),
    highlight: { found: ['small:a', 'large:a'], removed: ['totalRow:a'] },
    explanation: `Every number above is from a real published study, and the arithmetic is done live from the four cells. Read it twice. Treatment A beats B on small stones (${pct(rate(DATA.A.small))} vs ${pct(rate(DATA.B.small))}). A beats B on large stones (${pct(rate(DATA.A.large))} vs ${pct(rate(DATA.B.large))}). Every patient has small or large stones - there is no third kind. Yet sum the columns and B "wins" overall, ${pct(rate(total(DATA.B)))} to ${pct(rate(total(DATA.A)))}. Nothing is miscounted; you can verify each fraction by hand. This is Simpson's paradox: a conclusion that holds in every subgroup and reverses in the aggregate. The data is fine. The QUESTION the aggregate answers is not the question you asked.`,
    invariant: 'Aggregation can reverse every stratum: the totals answer "who got luckier patients," not "which treatment works."',
  };

  yield {
    state: table('The culprit: a third variable with arrows into BOTH columns', [
      ['arrow1', 'severity -> treatment'],
      ['arrow2', 'severity -> outcome'],
      ['dag', 'the graph'],
      ['mix', 'what aggregation did'],
    ], [['story', '']], [
      [`doctors triaged: hard (large-stone) cases got the serious operation A - ${DATA.A.large.n} of A's ${total(DATA.A).n} patients were large-stone, versus only ${DATA.B.large.n} of B's ${total(DATA.B).n}`],
      ['large stones heal less often under EITHER treatment - compare the rows: every large-stone rate is ~20 points below its small-stone rate'],
      ['treatment <- severity -> outcome: a FORK. Severity is a common cause of both who-got-what and how-it-went - the definition of a CONFOUNDER'],
      ['the aggregate compared "mostly-hard cases treated with A" against "mostly-easy cases treated with B" - a tilted playing field presented as a fair race'],
    ]),
    highlight: { active: ['dag:story'] },
    explanation: 'The reversal has a cause you can draw. Severity points at treatment (doctors steered tough cases to surgery - sensible medicine, terrible statistics) and severity points at outcome (tough cases end worse regardless). Two arrows out of one node: a fork, and the fork\'s tail variables become correlated for reasons that are not causation. The aggregate table silently compares A\'s caseload (75% large stones) against B\'s (23% large stones) - B looks better mostly because B got the easy patients. No amount of additional data fixes this; collecting more tilted samples yields a more confident tilted answer. The fix is to ask the question the right way, which the next step computes.',
    invariant: 'A confounder is a common cause: treatment <- Z -> outcome. The fork correlates its tails without any causal link between them.',
  };

  yield {
    state: table('The backdoor adjustment: reweight strata to the WHOLE population', [
      ['prev', 'stratum prevalence (everyone)'],
      ['adjA', 'adjusted A'],
      ['adjB', 'adjusted B'],
      ['verdict', 'the verdict, un-reversed'],
    ], [['calc', '']], [
      [`small ${pct(PREV_SMALL)} * large ${pct(1 - PREV_SMALL)} - how stones are actually distributed, ignoring who treated them`],
      [`${pct(PREV_SMALL)}*${pct(rate(DATA.A.small))} + ${pct(1 - PREV_SMALL)}*${pct(rate(DATA.A.large))} = ${pct(adjusted(DATA.A))}`],
      [`${pct(PREV_SMALL)}*${pct(rate(DATA.B.small))} + ${pct(1 - PREV_SMALL)}*${pct(rate(DATA.B.large))} = ${pct(adjusted(DATA.B))}`],
      [`A ${pct(adjusted(DATA.A))} vs B ${pct(adjusted(DATA.B))}: A wins, agreeing with BOTH subgroups - the aggregate's reversal was an artifact of unequal allocation`],
    ]),
    highlight: { found: ['verdict:calc'] },
    explanation: `The repair is one weighted average, computed live: ask "what success rate WOULD each treatment have if it faced the population's actual case mix?" Take each treatment's per-stratum rates - those were honest all along - and weight them by the overall prevalence of each stratum (${pct(PREV_SMALL)} small, ${pct(1 - PREV_SMALL)} large), not by the skewed mix each treatment happened to receive. Adjusted: A ${pct(adjusted(DATA.A))}, B ${pct(adjusted(DATA.B))} - the subgroup verdict and the (now fair) aggregate verdict agree. This is backdoor adjustment in its simplest form, the same correction that propensity weights perform in Doubly Robust Estimation. One warning before generalizing: adjustment fixed this BECAUSE severity is a confounder. The second view shows a variable with the same statistical look where adjusting CREATES the lie.`,
    invariant: 'Adjust = sum over strata of P(stratum) * P(success | stratum, treatment): every treatment faces the same population, by arithmetic.',
  };
}

function* dag() {
  yield {
    state: table('The whole grammar is three arrows', [
      ['chain', 'CHAIN * smoking -> tar -> cancer'],
      ['fork', 'FORK * ice cream <- summer -> drowning'],
      ['collider', 'COLLIDER * talent -> fame <- looks'],
    ], [['flows', 'association flows?'], ['condition', 'and if you condition on the middle?']], [
      ['yes - through the mediator: the effect is real and travels the chain', 'BLOCKED: comparing equal-tar smokers erases the pathway you wanted to measure (overadjustment)'],
      ['yes - spuriously: the tails correlate with no causal link (the confounder, view one\'s villain)', 'BLOCKED: stratifying on the common cause removes the fake association - adjusting here is the fix'],
      ['NO - two independent causes of a shared effect are simply independent', 'OPENED: selecting on the effect manufactures correlation between its causes - adjusting here CREATES bias'],
    ]),
    highlight: { compare: ['fork:condition', 'collider:condition'] },
    explanation: 'Every causal diagram, however huge, is built from three primitive junctions, and each reacts OPPOSITELY to conditioning. A chain transmits a real effect; condition on the middle and you block the very path you\'re measuring. A fork transmits a fake association; conditioning blocks it - that\'s why view one\'s adjustment worked. A collider transmits NOTHING - until you condition on it, which opens a path that never existed. One table, and it already explains most real-world analysis errors: adjusting for too little (forks left open), adjusting for too much (chains blocked), and adjusting for exactly the wrong thing (colliders opened). The next step manufactures that last error from scratch, with numbers.',
    invariant: 'Chain and fork: open until conditioned. Collider: closed until conditioned. Adjustment is path surgery, not hygiene.',
  };

  yield {
    state: table(`Collider bias, manufactured live (correlation = ${COLLIDER_R.toFixed(2)})`, [
      ['setup', 'the world'],
      ['select', 'the selection'],
      ['result', 'among the admitted'],
      ['examples', 'the same artifact in the wild'],
    ], [['story', '']], [
      ['talent and looks: a 20*20 grid of people, every combination equally common - independent BY CONSTRUCTION, correlation exactly 0'],
      ['a casting door admits anyone with talent + looks >= 19 (about half) - both qualities help, reasonably'],
      [`Pearson correlation among admitted: ${COLLIDER_R.toFixed(2)} - strongly NEGATIVE, computed live from the grid. The handsome admits needed less talent; the talented needed fewer looks. "Attractive actors can't act" - an artifact of the door, not the world`],
      ['"hospital patients show X causes Y" (admission is a collider) * "good-GPA low-SAT students at elite colleges" (admission again) * Berkson\'s 1946 original: diseases spuriously linked in hospital data'],
    ]),
    highlight: { removed: ['result:story'] },
    explanation: `Watch bias get created from nothing. The grid is exactly uniform: knowing someone's looks tells you literally zero about their talent - the full-population correlation is 0 by construction. Pass everyone through one innocent door (admit if the SUM clears a bar) and compute the correlation among those inside: ${COLLIDER_R.toFixed(2)}, decisively negative, live. No measurement error, no confounder, no small sample - the selection ITSELF carved the dependency, because inside the door, low talent survives only when looks compensated. Every dataset that exists because its members passed a gate (hospital admission, hiring, publication, app-store survival) carries this artifact, and "controlling for" the gate makes it worse, not better.`,
    invariant: 'Conditioning on a collider induces dependence among its causes: selection effects are not noise - they are structure, with a sign.',
  };

  yield {
    state: table('What to adjust for: the backdoor rule, in plain words', [
      ['goal', 'the goal'],
      ['yes', 'adjust for'],
      ['no', 'do NOT adjust for'],
      ['hard', 'the honest catch'],
    ], [['rule', '']], [
      ['close every path from treatment to outcome that enters the treatment through a BACK DOOR (an incoming arrow), while leaving the front path you\'re measuring untouched'],
      ['confounders - common causes of treatment and outcome (view one\'s severity): forks must be blocked'],
      ['mediators (they carry the effect you want) * colliders (blocking opens them) * anything CAUSED BY the treatment - adjusting post-treatment variables corrupts the comparison'],
      ['the rule needs the GRAPH, and the graph comes from domain knowledge, not from the data: no algorithm can read arrows off a correlation table alone'],
    ]),
    highlight: { active: ['yes:rule'], removed: ['no:rule'] },
    explanation: 'Pearl\'s backdoor criterion compresses the grammar into one instruction: block the back doors, leave the front door open. In practice - list the common causes and adjust for them; keep your hands off everything downstream of the treatment and off every gate your sample passed through. The catch in the last row deserves respect: which variable IS a confounder versus a collider is a fact about the world\'s arrows, not about the numbers - severity and the casting door can produce identical-looking tables. That\'s why causal analysis starts by DRAWING assumptions where colleagues can attack them. The data then answers the question; it never chooses the question.',
    invariant: 'Identification precedes estimation: the graph (assumptions) decides what to adjust; the data only supplies the magnitudes.',
  };

  yield {
    state: table('Why randomization is the nuclear option', [
      ['sever', 'what a coin flip does to the graph'],
      ['simpson', 'what that means for view one'],
      ['cant', 'when you can\'t flip the coin'],
      ['ladder', 'the full toolkit, weakest to strongest'],
    ], [['story', '']], [
      ['assignment by coin has NO incoming arrows: severity can no longer point at treatment - every back door is severed at once, including the confounders nobody thought of'],
      ['a randomized trial of A vs B cannot Simpson-reverse: the strata balance by design, and the aggregate answers the causal question directly'],
      ['ethics, cost, or time: you can\'t randomize smoking, recessions, or last year\'s decisions - then it\'s the graph + adjustment + Doubly Robust Estimation\'s propensity machinery, with assumptions on the table'],
      ['raw correlation < stratified adjustment < natural experiments < A/B Testing & p-values - each rung swaps assumptions for design'],
    ]),
    highlight: { found: ['sever:story'] },
    explanation: 'Now the deepest reason A/B Testing & p-values is the gold standard, in graph language: randomization doesn\'t MEASURE the confounders - it deletes their arrows. Assignment-by-coin has no causes, so nothing can be a common cause of treatment and outcome, including confounders no one imagined. That\'s strictly stronger than adjustment, which handles only the back doors you knew to draw. The observational toolkit on this page exists for everywhere the coin is unavailable - historical data, unethical-to-randomize questions, decisions already made. Used honestly (graph stated, gates respected, colliders untouched), it turns "we can\'t experiment" from a dead end into a discipline. Used carelessly, it manufactures results like the casting-door correlation: precise, confident, and pure artifact.',
    invariant: 'Randomization severs every incoming arrow to treatment - known and unknown confounders alike; adjustment handles only the ones you drew.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === "Simpson's paradox, live") yield* simpson();
  else if (view === 'reading the DAG') yield* dag();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Simpson\'s paradox, live" computes all four cells of the 1986 kidney-stone study from real numbers, shows treatment A beating B in every subgroup, then shows the aggregate reversing. Active cells are the current comparison; found markers highlight the honest verdict; removed markers flag the misleading aggregate. The backdoor adjustment step reweights strata to the overall prevalence, repairing the reversal live.',
        {type: 'callout', text: 'Causal graphs make adjustment a path operation: block confounders, leave mediators alone, and never open colliders.'},
        '"Reading the DAG" walks the three primitive junctions (chain, fork, collider), then manufactures collider bias on a deterministic grid. Compare markers contrast fork versus collider conditioning - the same operation that fixes one creates the other. The final frames state the backdoor criterion and explain why randomization is the nuclear option.',
        'At each frame, read the invariant line. It states the one fact that must hold before the next step is legal. If you can explain that invariant to someone else, you understood the frame.',
        {type: 'image', src: './assets/gifs/causal-graphs.gif', alt: 'Animated walkthrough of the causal graphs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'You cannot answer a question about intervention from data on observation alone, no matter how big the data. The question "What happens if we do X?" is fundamentally different from "What happened when we saw X?"',
          attribution: 'Judea Pearl, Causality (2000)',
        },
        'Correlation tells you two variables move together. It cannot tell you whether changing one would change the other, whether a third variable drives both, or whether the association is an artifact of how the sample was collected. Every field that needs to act on data - medicine, policy, engineering, ML fairness - needs the distinction between seeing and doing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt: 'Directed acyclic graph with arrows showing dependencies between nodes', caption: 'A DAG is the artifact that records causal assumptions before the data estimates magnitudes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph.svg.'},
        'Causal graphs formalize that distinction. A directed acyclic graph (DAG) encodes which variables cause which others. From the DAG, you can derive which statistical adjustments recover a causal effect from observational data, which adjustments destroy the answer, and which questions cannot be answered without an experiment. Pearl\'s do-calculus (2000) proved that these derivations are complete: if a causal effect can be identified from a given graph, the calculus will find the formula.',
        'The kidney-stone study in view one is the classroom example. Treatment A beats B in every subgroup and loses overall. The graph explains why - severity is a common cause (fork) that tilts the aggregate - and the backdoor adjustment repairs it. Without the graph, you cannot tell whether adjusting helps or hurts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is reasonable: compare group averages, and if they differ, add every available variable as a control. Run a regression with all covariates, trust the coefficient on treatment, and call it causal. This works often enough to feel safe - when the controls happen to be confounders and the sample was not filtered through a collider.',
        'A slightly more careful version stratifies: break the data into subgroups, compute the effect within each, and average. The kidney-stone study does exactly this, and within each stratum the answer is correct. The instinct to "control for everything" is not stupid. It just has a hidden failure mode that no amount of additional data can fix.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Adjustment is not generic cleanup. Conditioning on a confounder removes bias (the fork in view one). Conditioning on a mediator erases part of the real effect (blocking the chain smoking -> tar -> cancer hides the pathway you wanted to measure). Conditioning on a collider creates a relationship that did not exist (the casting-door experiment manufactures a negative correlation from independence).',
        'The same correlation table can come from a fork, a chain, or a collider. No statistical test distinguishes them - the distinction lives in the arrows, which come from domain knowledge. "Control for everything" opens every collider in the graph, manufacturing as many spurious associations as it removes real confounders. The wall is that you need the graph before you can estimate, and the graph is an assumption about the world, not a computation from the data.',
        'Pearl formalized this in a structural causal model (SCM): a set of equations X_i = f_i(parents_i, U_i) where each variable is determined by its direct causes plus an independent noise term. The DAG is the picture of those equations. Without it, you are navigating a maze in the dark.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The breakthrough is that causation reduces to graph surgery. Instead of reasoning about counterfactual worlds in prose, Pearl gave it a precise operation: to compute the effect of doing X, take the DAG, delete every arrow pointing into X, and compute the resulting distribution. That single move - cutting incoming edges - separates what you chose to set from everything that used to influence it. The mutilated graph represents the world after intervention.',
        'This makes "what if" questions mechanical. The do-operator P(Y | do(X = x)) is not a philosophical stance; it is a defined transformation on a graph. Once defined, you can ask: does the observational distribution P(Y | X, Z) equal the interventional distribution P(Y | do(X)) for some conditioning set Z? If yes, the causal effect is identifiable from data alone. If no, you need an experiment or a different graph structure (front-door, instrumental variable).',
        'The power is in what this rules out. Before the graph, researchers debated endlessly about which variables to "control for." The graph turns that debate into a checkable algorithm. D-separation reads paths, the backdoor criterion checks them, and the answer is yes or no - not a matter of taste. Disagreements move from "should we adjust?" to "is this arrow real?" which is a question about the world, not about statistics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A causal graph is a DAG where each node is a variable and each arrow represents direct causation. The graph encodes a structural causal model (SCM): a system of equations where each variable is a function of its parents and an independent noise term. Three primitive junctions exhaust every local pattern:',
        {
          type: 'diagram',
          text: 'CHAIN:    X --> M --> Y        (real effect flows through mediator M)\nFORK:     X <-- Z --> Y        (common cause Z creates spurious association)\nCOLLIDER: X --> C <-- Y        (two independent causes share an effect C)\n\nCONFOUNDER EXAMPLE (kidney-stone study):\n  Severity ---> Treatment choice\n     |                |\n     v                v\n  Severity ---> Outcome\n  (fork: Severity is a common cause)\n\nMEDIATOR EXAMPLE:\n  Smoking ---> Tar deposits ---> Lung cancer\n  (chain: the effect travels through tar)\n\nCOLLIDER EXAMPLE:\n  Talent ---> Admission <--- Looks\n  (collider: selecting on Admission induces\n   a negative correlation between Talent and Looks)',
          label: 'The three primitive DAG junctions, with confounders, mediators, and colliders',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph arranged so every edge points forward in an ordering', caption: 'Topological order makes the no-cycles assumption visible: causes must precede their downstream effects in the drawn model. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Topological_Ordering.svg.'},
        'Each junction reacts oppositely to conditioning. Chains and forks transmit association by default; conditioning on the middle node blocks the path. Colliders block association by default; conditioning on the collider (or any descendant of it) opens a path that was closed. This is the complete grammar of d-separation.',
        'The do-operator, written P(Y | do(X = x)), represents an intervention: physically setting X to x rather than passively observing it. In the SCM, do(X = x) means deleting every arrow into X and fixing its value. This severs every backdoor path. The backdoor criterion gives a sufficient condition: if a set Z blocks every path between X and Y that enters X through an incoming arrow (a "back door"), then P(Y | do(X = x)) = sum over z of P(Y | X = x, Z = z) * P(Z = z). The kidney-stone adjustment in view one is exactly this formula with Z = severity.',
        'The front-door criterion handles cases where no valid backdoor adjustment set exists. If a variable M lies on every directed path from X to Y, no backdoor path exists from X to M, and all backdoor paths from M to Y are blocked by X, then the causal effect is identifiable through M. The classic example: even if an unmeasured confounder U causes both smoking and cancer, you can identify the smoking -> cancer effect through tar deposits, because smoking -> tar has no backdoor, and tar -> cancer has its backdoor (through U) blocked by conditioning on smoking.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness rests on three facts. First, the DAG encodes conditional independencies via d-separation: two variables are independent given a conditioning set if and only if every path between them is blocked (chain/fork middle conditioned on, or collider middle not conditioned on). Second, the do-operator has a precise definition - delete incoming arrows to the intervention variable - so "what happens if we do X" is a well-defined mathematical object, not a vague wish. Third, Pearl proved completeness: if a causal effect is identifiable from the graph, the three rules of do-calculus will derive the identifying formula.',
        {
          type: 'code',
          language: 'python',
          text: '# D-separation check: is X independent of Y given Z in a DAG?\n# A path is blocked if it contains:\n#   - a chain or fork whose middle node is in Z, OR\n#   - a collider whose middle node (and all descendants) are NOT in Z\n\ndef d_separated(dag, x, y, z):\n    """Check if x and y are d-separated given z in a DAG.\n    dag: dict mapping node -> list of children\n    Returns True if every path between x and y is blocked by z.\n    """\n    ancestors_of_z = set()\n    for node in z:\n        _add_ancestors(dag, node, ancestors_of_z)\n    ancestors_of_z |= set(z)\n\n    # BFS over "active" paths using the Bayes-Ball algorithm\n    # A path is active (not blocked) if association can flow through it\n    visited = set()\n    queue = [(x, "up")]  # (node, direction we arrived from)\n    while queue:\n        node, direction = queue.pop(0)\n        if (node, direction) in visited:\n            continue\n        visited.add((node, direction))\n        if node == y:\n            return False  # found an active path => not d-separated\n\n        if direction == "up":  # arrived from a child\n            if node not in z:  # chain/fork: passes through if not conditioned\n                for parent in _parents(dag, node):\n                    queue.append((parent, "up"))\n                for child in dag.get(node, []):\n                    queue.append((child, "down"))\n            if node in ancestors_of_z:  # collider ancestor: opens path\n                for parent in _parents(dag, node):\n                    queue.append((parent, "up"))\n        elif direction == "down":  # arrived from a parent\n            if node not in z:  # chain: passes through if not conditioned\n                for child in dag.get(node, []):\n                    queue.append((child, "down"))\n            if node in z or node in ancestors_of_z:  # collider: opens\n                for parent in _parents(dag, node):\n                    queue.append((parent, "up"))\n    return True  # no active path found => d-separated',
        },
        'The algorithm above (Bayes-Ball) runs in O(V + E) time on the DAG - linear in the number of variables and arrows. It checks whether association can flow from X to Y given the conditioning set Z, respecting the chain/fork/collider rules. If every path is blocked, the variables are conditionally independent, and no adjustment involving Z will recover a spurious association between them.',
        'Simpson\'s paradox dissolves in this framework. The aggregate comparison leaves the backdoor path treatment <- severity -> outcome open. Conditioning on severity blocks it. The paradox is not a paradox - it is an open fork.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'What it requires', 'What it handles', 'Cost'],
          rows: [
            ['Randomized controlled trial (RCT)', 'Random assignment, ethical feasibility, time, money', 'All confounders (known and unknown)', 'Expensive: recruitment, compliance, follow-up; gold standard'],
            ['Observational + backdoor adjustment', 'Correct DAG, measured confounders, positivity (overlap)', 'Known confounders in the graph', 'Cheap computation (weighted average), expensive assumptions'],
            ['Front-door criterion', 'A mediator with no direct backdoor from X to Y', 'Unmeasured confounders between X and Y', 'Rare: the required graph structure seldom holds exactly'],
            ['Instrumental variables', 'An instrument affecting Y only through X', 'Unmeasured confounders', 'Needs a valid instrument - hard to find, easy to violate'],
            ['Do-calculus (general)', 'Complete DAG, three algebraic rules', 'Any identifiable causal effect', 'Algorithmic: polynomial in graph size for identification'],
          ],
        },
        'Drawing the DAG is the dominant cost, and it is human labor, not computation. You must enumerate every relevant variable and every arrow from domain knowledge. Missing an arrow (unmeasured confounder) means the adjustment set is wrong. Adding a wrong arrow (false causal claim) can bias the estimate. The graph is a set of assumptions, and they must be stated publicly so colleagues can challenge them.',
        'Once the graph is drawn, checking whether a set Z satisfies the backdoor criterion is O(V + E) via d-separation. The adjustment itself is a weighted average: sum over strata of P(stratum) * P(outcome | treatment, stratum). In low dimensions (a few confounders), this is trivial. In high dimensions, positivity violations (strata where one treatment never appears) make weighting unstable - propensity-score methods and doubly robust estimation address this.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Venn_A_intersect_B.svg', alt: 'Venn diagram showing the intersection of sets A and B', caption: 'Overlap is the visual form of positivity: causal adjustment needs comparable treated and untreated cases inside the same strata. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Venn_A_intersect_B.svg.'},
        'Do-calculus identification is polynomial in graph size. The computational cost is negligible compared to the intellectual cost of getting the graph right.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Epidemiology: smoking and lung cancer could not be studied via RCT (you cannot randomize people to smoke). The causal graph smoking -> tar -> cancer, with unmeasured genetic confounders, guided decades of observational research. The front-door criterion through tar deposits was the theoretical basis for identifying the effect despite unmeasured confounders.',
        'ML fairness: if hiring-decision <- race <- socioeconomic-background, naively "controlling for race" conditions on a collider and opens a bias path. The DAG tells you to adjust for socioeconomic background instead. Without the graph, fairness interventions can make discrimination worse.',
        'Program evaluation: governments want to know if a job-training program reduces unemployment. Random assignment is sometimes possible (and is the gold standard); when it is not, the DAG plus backdoor adjustment on pre-treatment covariates (education, age, prior employment) gives the best observational estimate, with assumptions on the table.',
        'Tech A/B testing: randomization severs every incoming arrow to the treatment variable, including unknown confounders. A coin flip has no causes. This is why A/B tests are the gold standard - they make the causal graph trivially simple by construction. Causal graphs explain why A/B tests work and what breaks when randomization is compromised (non-compliance, attrition, interference between units).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph is an assumption, not a discovery. If the true causal structure differs from your drawn DAG, every downstream computation - adjustment set, identification formula, point estimate - can be wrong. No algorithm reads causal arrows off a correlation table. Two variables with identical correlation can have opposite causal relationships depending on which arrow points where.',
        '"Control for everything" is the most common failure mode. Researchers add every measured variable to a regression, hoping to remove all bias. This opens every collider in the graph, manufacturing spurious associations. The casting-door experiment in view two demonstrates: talent and looks are independent by construction, but selecting on their sum (conditioning on admission, a collider) produces r = -0.50. Precise, confident, and pure artifact.',
        'Unmeasured confounders are invisible in the graph. If a common cause of treatment and outcome exists but is not drawn, no backdoor adjustment can fix the bias. Sensitivity analysis (how large would an unmeasured confounder need to be to explain away the result?) is the standard defense, but it gives bounds, not answers.',
        'Positivity violations: if certain treatment-confounder combinations never appear in the data, the adjustment formula divides by zero or near-zero. Propensity-score trimming and doubly robust methods help, but they trade bias for variance. The fundamental issue is that the data cannot tell you about populations it never observed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The 1986 Charig study compared two kidney-stone treatments. Here are the real numbers. Small stones: treatment A cured 81 of 87 (93%), treatment B cured 234 of 270 (87%). Large stones: treatment A cured 192 of 263 (73%), treatment B cured 55 of 80 (69%). Treatment A wins in both subgroups. But the aggregate tells a different story.',
        'Aggregate: treatment A cured 273 of 350 (78%), treatment B cured 289 of 350 (83%). Treatment B wins overall. This is Simpson\'s paradox. The numbers are not wrong - the arithmetic checks out. The aggregate reverses because severity confounds the comparison: doctors gave treatment A (open surgery, more invasive) to the harder cases.',
        'Draw the DAG. Severity causes both treatment choice and outcome. That is a fork: Severity -> Treatment and Severity -> Outcome. The backdoor path Treatment <- Severity -> Outcome is open. The aggregate comparison P(Outcome | Treatment) includes this backdoor flow, mixing the causal effect with the confounding bias from severity.',
        'Apply the backdoor criterion. The set Z = {Severity} blocks the only backdoor path. The adjustment formula is: P(Outcome | do(Treatment = t)) = sum over s of P(Outcome | Treatment = t, Severity = s) * P(Severity = s). We need one more number: the overall prevalence of small stones is (87 + 270) / (87 + 270 + 263 + 80) = 357/700 = 51%, so large stones is 49%.',
        'For treatment A: P(cure | do(A)) = 0.93 * 0.51 + 0.73 * 0.49 = 0.4743 + 0.3577 = 0.832, or 83.2%. For treatment B: P(cure | do(B)) = 0.87 * 0.51 + 0.69 * 0.49 = 0.4437 + 0.3381 = 0.782, or 78.2%. After adjustment, treatment A beats B by 5 percentage points. The paradox is gone. The causal effect matches what the subgroup analysis already showed: A is better.',
        'The key step was identifying Severity as the confounder and applying the correct reweighting. The unadjusted aggregate used the wrong weights because doctors assigned treatments based on severity. The backdoor formula replaced those biased weights (how many severe patients got each treatment) with the population prevalence of severity (how common severe cases are overall). That single substitution repaired the reversal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pearl, Judea. Causality: Models, Reasoning, and Inference (Cambridge, 2000; 2nd ed. 2009). The foundational text: SCMs, do-calculus, backdoor/front-door criteria, completeness proof.',
            'Pearl, Judea, Madelyn Glymour, and Nicholas Jewell. Causal Inference in Statistics: A Primer (Wiley, 2016). Accessible introduction with worked examples and exercises.',
            'Hernan, Miguel and James Robins. Causal Inference: What If (Chapman & Hall, 2020). Free online. The epidemiology perspective: inverse probability weighting, standardization, g-methods.',
            'Charig, C.R. et al. "Comparison of treatment of renal calculi by open surgery, percutaneous nephrolithotomy, and extracorporeal shockwave lithotripsy." BMJ 292 (1986): 879-882. The kidney-stone data used in this animation.',
          ],
        },
        {
          type: 'note',
          text: 'Study next by role. Prerequisite: conditional probability and Bayes\' theorem. Extension: "Doubly Robust Estimation" (propensity weighting + outcome modeling for robustness), "Importance Sampling & Off-Policy Estimation" (reweighting for off-policy data). Contrast: "A/B Testing & p-values" (randomization as the nuclear option that makes the graph trivial). Application: "Synthetic Control Donor Weights" (causal inference for comparative case studies with few treated units).',
        },
      ],
    },
  ],
};
