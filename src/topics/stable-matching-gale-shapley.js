// Stable Matching: Gale-Shapley propose-reject algorithm for finding
// a stable one-to-one matching between two equal-sized groups.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'stable-matching-gale-shapley',
  title: 'Stable Matching (Gale-Shapley)',
  category: 'Data Structures',
  summary: 'Find a stable one-to-one matching between two groups using the propose-reject algorithm: no pair would rather leave their assigned partners for each other.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['full algorithm', 'worked example'], defaultValue: 'full algorithm' },
  ],
  run,
};

/* ------------------------------------------------------------------ helpers */

function prefMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState(
    { title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] },
  );
}

function matchingGraph(title, matches, proposals, rejection) {
  // 3 men (m1-m3) on left, 3 women (w1-w3) on right
  const nodes = [
    { id: 'm1', label: 'm1', x: 1.0, y: 1.5, note: matches.m1 ? `matched ${matches.m1}` : 'free' },
    { id: 'm2', label: 'm2', x: 1.0, y: 4.0, note: matches.m2 ? `matched ${matches.m2}` : 'free' },
    { id: 'm3', label: 'm3', x: 1.0, y: 6.5, note: matches.m3 ? `matched ${matches.m3}` : 'free' },
    { id: 'w1', label: 'w1', x: 6.0, y: 1.5, note: matches.w1 ? `matched ${matches.w1}` : 'free' },
    { id: 'w2', label: 'w2', x: 6.0, y: 4.0, note: matches.w2 ? `matched ${matches.w2}` : 'free' },
    { id: 'w3', label: 'w3', x: 6.0, y: 6.5, note: matches.w3 ? `matched ${matches.w3}` : 'free' },
  ];
  const edges = [];
  // Stable matched edges
  for (const [m, w] of Object.entries(matches)) {
    if (m.startsWith('m') && w) {
      edges.push({ id: `e-${m}-${w}`, from: m, to: w, weight: 'matched' });
    }
  }
  // Current proposal edge
  if (proposals) {
    edges.push({ id: `e-prop-${proposals.from}-${proposals.to}`, from: proposals.from, to: proposals.to, weight: 'proposal' });
  }
  // Rejection edge
  if (rejection) {
    edges.push({ id: `e-rej-${rejection.from}-${rejection.to}`, from: rejection.from, to: rejection.to, weight: 'rejected' });
  }
  return graphState({ nodes, edges }, { title });
}

/* ----------------------------------------------------------- full algorithm */

function* fullAlgorithm() {
  yield {
    state: prefMatrix(
      'Preference lists: each person ranks the other side',
      [
        { id: 'm1', label: 'm1' },
        { id: 'm2', label: 'm2' },
        { id: 'm3', label: 'm3' },
        { id: 'w1', label: 'w1' },
        { id: 'w2', label: 'w2' },
        { id: 'w3', label: 'w3' },
      ],
      [{ id: 'c1', label: '1st choice' }, { id: 'c2', label: '2nd choice' }, { id: 'c3', label: '3rd choice' }],
      [
        ['w1', 'w2', 'w3'],
        ['w1', 'w3', 'w2'],
        ['w2', 'w1', 'w3'],
        ['m2', 'm3', 'm1'],
        ['m1', 'm3', 'm2'],
        ['m1', 'm2', 'm3'],
      ],
    ),
    highlight: { active: ['m1:c1', 'm2:c1', 'm3:c1'] },
    explanation: 'The input is two groups of equal size, each person holding a strict ranking of everyone on the other side. The algorithm finds a matching where no unmatched pair mutually prefer each other over their assigned partners. That property is stability.',
    invariant: 'Every person appears exactly once in every preference list on the opposing side.',
  };

  yield {
    state: matchingGraph('Round 1: all free men propose to their top choice', {}, null, null),
    highlight: { active: ['m1', 'm2', 'm3'] },
    explanation: 'Every free proposer starts by proposing to the highest-ranked person they have not yet proposed to. m1 and m2 both propose to w1. m3 proposes to w2. When multiple proposers target the same recipient, the recipient chooses.',
  };

  yield {
    state: matchingGraph('w1 receives proposals from m1 and m2', {}, { from: 'm1', to: 'w1' }, null),
    highlight: { active: ['m1', 'm2'], compare: ['w1'] },
    explanation: 'w1 ranks m2 first and m1 third. She tentatively accepts m2 and rejects m1. The acceptance is tentative: if a better proposer arrives later, she will switch. m1 returns to the free pool.',
  };

  yield {
    state: matchingGraph('w1 holds m2; w2 holds m3; m1 is free', { m2: 'w1', w1: 'm2', m3: 'w2', w2: 'm3' }, null, { from: 'w1', to: 'm1' }),
    highlight: { found: ['m2', 'w1', 'm3', 'w2'], active: ['m1'] },
    explanation: 'After round 1: m2-w1 and m3-w2 are tentatively matched. m1 is free and moves to his second choice. Each rejection pushes a proposer down his list, never to revisit that recipient.',
    invariant: 'A rejected proposer is never reconsidered by that recipient.',
  };

  yield {
    state: matchingGraph('Round 2: m1 proposes to w2 (his 2nd choice)', { m2: 'w1', w1: 'm2', m3: 'w2', w2: 'm3' }, { from: 'm1', to: 'w2' }, null),
    highlight: { active: ['m1'], compare: ['w2', 'm3'] },
    explanation: 'w2 currently holds m3. She ranks m1 first and m3 second. m1 is better, so w2 drops m3 and tentatively accepts m1. m3 is now free.',
  };

  yield {
    state: matchingGraph('w2 switches to m1; m3 is now free', { m2: 'w1', w1: 'm2', m1: 'w2', w2: 'm1' }, null, { from: 'w2', to: 'm3' }),
    highlight: { found: ['m1', 'w2', 'm2', 'w1'], active: ['m3'] },
    explanation: 'This is the propose-reject mechanism in action. A tentative match is not permanent. When a recipient gets a better proposal, she upgrades and the old partner rejoins the free pool. The rejected proposer moves to the next name on his list.',
  };

  yield {
    state: matchingGraph('Round 3: m3 proposes to w1 (his 2nd choice)', { m2: 'w1', w1: 'm2', m1: 'w2', w2: 'm1' }, { from: 'm3', to: 'w1' }, null),
    highlight: { active: ['m3'], compare: ['w1', 'm2'] },
    explanation: 'w1 currently holds m2. She ranks m2 first and m3 second. m2 is better, so w1 rejects m3. m3 stays free and must propose to his last choice.',
  };

  yield {
    state: matchingGraph('Round 4: m3 proposes to w3 (his 3rd choice)', { m2: 'w1', w1: 'm2', m1: 'w2', w2: 'm1' }, { from: 'm3', to: 'w3' }, null),
    highlight: { active: ['m3'], compare: ['w3'] },
    explanation: 'w3 is free and has no one to compare against. She accepts m3. All men are now matched. The algorithm terminates.',
  };

  yield {
    state: matchingGraph('Final stable matching', { m1: 'w2', w2: 'm1', m2: 'w1', w1: 'm2', m3: 'w3', w3: 'm3' }, null, null),
    highlight: { found: ['m1', 'w2', 'm2', 'w1', 'm3', 'w3'] },
    explanation: 'Stable matching: m1-w2, m2-w1, m3-w3. No unmatched pair would both prefer each other over their current partners. The algorithm always terminates, always produces a perfect matching, and the result is always stable.',
    invariant: 'No blocking pair exists: for every man-woman pair not matched together, at least one of them prefers their current partner.',
  };
}

/* -------------------------------------------------------- worked example */

function* workedExample() {
  yield {
    state: prefMatrix(
      'Setup: 3 men, 3 women, each with a strict ranking',
      [
        { id: 'm1', label: 'Alex' },
        { id: 'm2', label: 'Blake' },
        { id: 'm3', label: 'Chris' },
        { id: 'w1', label: 'Dana' },
        { id: 'w2', label: 'Eden' },
        { id: 'w3', label: 'Fran' },
      ],
      [{ id: 'c1', label: '1st' }, { id: 'c2', label: '2nd' }, { id: 'c3', label: '3rd' }],
      [
        ['Dana', 'Eden', 'Fran'],
        ['Dana', 'Fran', 'Eden'],
        ['Eden', 'Dana', 'Fran'],
        ['Blake', 'Chris', 'Alex'],
        ['Alex', 'Chris', 'Blake'],
        ['Alex', 'Blake', 'Chris'],
      ],
    ),
    highlight: { active: ['m1:c1', 'm2:c1', 'm3:c1'] },
    explanation: 'Men propose in order of their preference lists. Alex wants Dana most, Blake wants Dana most, Chris wants Eden most. Each woman compares competing proposals against her own ranking.',
  };

  yield {
    state: prefMatrix(
      'Round 1: Alex and Blake both propose to Dana',
      [
        { id: 'a', label: 'Alex -> Dana' },
        { id: 'b', label: 'Blake -> Dana' },
        { id: 'c', label: 'Chris -> Eden' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 1st choice', 'rejected (Dana ranks Alex 3rd)'],
        ['proposes 1st choice', 'held (Dana ranks Blake 1st)'],
        ['proposes 1st choice', 'held (Eden has no one)'],
      ],
    ),
    highlight: { active: ['a:action', 'b:action', 'c:action'], found: ['b:result', 'c:result'], removed: ['a:result'] },
    explanation: 'Dana gets proposals from Alex and Blake. Her ranking is Blake > Chris > Alex. She holds Blake and rejects Alex. Eden gets only Chris and holds him. Alex is now free and moves to his second choice.',
  };

  yield {
    state: prefMatrix(
      'Round 2: Alex proposes to Eden (his 2nd choice)',
      [
        { id: 'a', label: 'Alex -> Eden' },
        { id: 'comp', label: 'Eden compares' },
        { id: 'out', label: 'Chris ejected' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 2nd choice', 'Eden ranks Alex 1st'],
        ['Alex (1st) vs Chris (2nd)', 'prefers Alex'],
        ['freed from Eden', 'moves to 2nd choice'],
      ],
    ),
    highlight: { active: ['a:action'], found: ['comp:result'], removed: ['out:result'] },
    explanation: 'Eden currently holds Chris. She ranks Alex 1st and Chris 2nd. She drops Chris for Alex. Chris is now free and proposes to his second choice, Dana.',
  };

  yield {
    state: prefMatrix(
      'Round 3: Chris proposes to Dana (his 2nd choice)',
      [
        { id: 'c', label: 'Chris -> Dana' },
        { id: 'comp', label: 'Dana compares' },
        { id: 'keep', label: 'Blake stays' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 2nd choice', 'Dana ranks Chris 2nd'],
        ['Blake (1st) vs Chris (2nd)', 'prefers Blake'],
        ['Blake still held', 'Chris rejected'],
      ],
    ),
    highlight: { active: ['c:action'], found: ['keep:result'], removed: ['c:result'] },
    explanation: 'Dana holds Blake (her 1st choice). Chris is her 2nd choice. She keeps Blake. Chris is rejected again and falls to his last choice, Fran.',
  };

  yield {
    state: prefMatrix(
      'Round 4: Chris proposes to Fran (his 3rd choice)',
      [
        { id: 'c', label: 'Chris -> Fran' },
        { id: 'result', label: 'Fran accepts' },
        { id: 'done', label: 'all matched' },
      ],
      [{ id: 'action', label: 'action' }, { id: 'result', label: 'result' }],
      [
        ['proposes 3rd choice', 'Fran is free'],
        ['no competition', 'holds Chris'],
        ['terminate', 'stable matching found'],
      ],
    ),
    highlight: { active: ['c:action'], found: ['result:result', 'done:result'] },
    explanation: 'Fran is unmatched and accepts Chris. All men are matched. The algorithm terminates with: Alex-Eden, Blake-Dana, Chris-Fran.',
  };

  yield {
    state: prefMatrix(
      'Stability check: verify no blocking pair exists',
      [
        { id: 'p1', label: 'Alex & Dana?' },
        { id: 'p2', label: 'Alex & Fran?' },
        { id: 'p3', label: 'Blake & Eden?' },
        { id: 'p4', label: 'Blake & Fran?' },
        { id: 'p5', label: 'Chris & Dana?' },
        { id: 'p6', label: 'Chris & Eden?' },
      ],
      [{ id: 'check', label: 'both prefer each other?' }, { id: 'verdict', label: 'blocking?' }],
      [
        ['Alex prefers Dana, but Dana prefers Blake (her match)', 'no'],
        ['Alex prefers Eden (his match) over Fran', 'no'],
        ['Blake prefers Dana (his match) over Eden', 'no'],
        ['Blake prefers Dana (his match) over Fran', 'no'],
        ['Dana prefers Blake (her match) over Chris', 'no'],
        ['Eden prefers Alex (her match) over Chris', 'no'],
      ],
    ),
    highlight: { found: ['p1:verdict', 'p2:verdict', 'p3:verdict', 'p4:verdict', 'p5:verdict', 'p6:verdict'] },
    explanation: 'For every unmatched man-woman pair, at least one of them prefers their current partner. No blocking pair exists. The matching is stable. The proposing side (men) got their best achievable partner under any stable matching; the receiving side (women) got their worst.',
    invariant: 'Proposer-optimal, recipient-pessimal: the proposing side cannot do better in any stable matching.',
  };
}

/* ---------------------------------------------------------------- dispatch */

export function* run(input) {
  const view = String(input.view);
  if (view === 'full algorithm') yield* fullAlgorithm();
  else if (view === 'worked example') yield* workedExample();
  else throw new InputError('Pick a stable matching view.');
}

/* ----------------------------------------------------------------- article */

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        `The animation shows two columns: proposers on the left and recipients on the right. Each person carries a status label -- free or matched with a partner. Edges between columns represent proposals, tentative matches, or rejections.`,
        {type: 'callout', text: `Stable matching is not the highest-score pairing; it is the pairing where every rejected pair has at least one side that will not leave.`},
        `Active highlights mark the proposer currently making a proposal. Compare highlights mark the recipient evaluating that proposal against her current partner. Found highlights mark edges in the current tentative matching. When a recipient switches partners, the old edge disappears and the rejected proposer returns to the free pool.`,
        `Watch three things at each step: which proposer is free and proposing, which recipient is comparing, and whether the comparison triggers a rejection. Every rejection pushes the proposer one slot down his preference list, and that slot is never revisited. The algorithm ends when no free proposer remains.`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        `Many allocation problems cannot be solved by optimization alone because participants have preferences. A hospital wants the best residents, but residents also rank hospitals. A school district assigns students to schools, but families have ranked choices. An organ exchange matches donors to recipients across incompatible pairs. In each case, the goal is not a maximum or minimum -- it is a matching that no pair of participants would jointly abandon.`,
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Graph_K3-3.svg/250px-Graph_K3-3.svg.png', alt: 'Complete bipartite graph K3,3 with three vertices on each side and every cross-side edge drawn', caption: 'A two-sided matching market starts as a bipartite candidate graph; preferences and stability decide which edges survive. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Graph_K3-3.svg.'},
        `David Gale and Lloyd Shapley formalized this in 1962: given two groups of equal size with strict preference rankings, find a matching where no unmatched pair mutually prefer each other to their assigned partners. They proved such a stable matching always exists and gave an O(n^2) algorithm to find one. Shapley received the Nobel Prize in Economics in 2012 for this work and related contributions to cooperative game theory.`,
        `The National Resident Matching Program (NRMP) has used a variant of the algorithm since 1952 to match medical residents to hospitals in the United States -- predating the formal publication by a decade. The algorithm was independently discovered in practice before it was proven in theory.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `Enumerate all possible matchings between n proposers and n recipients. There are n! such matchings. For each one, check whether any unmatched pair would both prefer each other -- a blocking pair. If no blocking pair exists, the matching is stable.`,
        `Checking one matching for stability requires examining all O(n^2) unmatched pairs. The total work is O(n! * n^2). For 10 people per side, n! is 3,628,800. For 20, it is over 2 * 10^18. The approach is correct but computationally impossible at any practical scale.`,
        `A greedy alternative -- pair off mutually top-ranked couples first, then handle the rest -- also fails. Removing a pair changes the preference landscape for everyone else, and the greedy order can create blocking pairs downstream. Stability is a global property that local greedy moves cannot guarantee.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `Stability is a constraint on every unmatched pair simultaneously. A matching with n pairs has n(n-1)/2 potential blocking pairs to rule out. Enumerating all n! matchings and checking each one is exponential. Greedy pairing is fast but produces unstable results.`,
        `The core difficulty is that preferences interact. Matching Alex to Dana might force Blake to Eden, which makes Chris and Eden a blocking pair. Every assignment choice constrains every other. The search space is factorial, and stability is a global invariant that cannot be checked locally during construction -- unless the construction process is designed to prevent blocking pairs from forming in the first place.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Build stability into the process instead of checking it after the fact. Let one side propose in order of preference, and let the other side hold the best offer seen so far. A proposer who is rejected drops to the next name on his list and never returns. A recipient who receives a better offer upgrades and releases her current partner.`,
        `This propose-reject mechanism has a key monotonic property: proposers move down their lists, recipients move up. No proposer ever revisits a recipient who rejected him. No recipient ever downgrades to a worse partner. These one-directional movements guarantee termination and, crucially, prevent blocking pairs from surviving to the final matching.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Input: two groups of n people. Each person holds a strict ranking of all n people on the other side. One group is designated as proposers, the other as recipients.`,
        `Initialize all people as free. While any proposer is free: the free proposer proposes to the highest-ranked recipient he has not yet proposed to. If she is free, she tentatively accepts. If she is matched but prefers this proposer to her current partner, she drops her current partner (who becomes free) and tentatively accepts the new proposer. If she prefers her current partner, she rejects the new proposer (who stays free and will propose to his next choice in the next round).`,
        `Each proposer proposes to at most n recipients. There are n proposers. The total number of proposals is at most n^2. Each proposal involves a constant-time comparison (using the recipient's ranking array for O(1) lookup). The algorithm terminates in at most n^2 steps.`,
        `Implementation detail: store each proposer's next-to-propose index and each recipient's ranking as an inverse array (rank[m] = position of m in her list) so that comparisons are O(1) rather than O(n) scans.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Termination: each proposal either matches a free proposer or moves one proposer down his list. A proposer can propose to each recipient at most once, so the total proposals are bounded by n^2. The process must end.`,
        `Perfect matching: every recipient who receives a proposal stays matched from that point on (she may upgrade but never becomes free again). With n proposers and n recipients of equal size, every proposer will eventually find a recipient who accepts -- no proposer can exhaust all n recipients without being accepted, because that would require all n recipients to prefer their current partners, but only n-1 other proposers exist.`,
        `Stability (proof by contradiction): suppose man m and woman w are not matched to each other, but both prefer each other to their current partners. Then m must have proposed to w before proposing to his current (less preferred) partner. When m proposed to w, she either accepted him or rejected him for someone she preferred more. If she accepted, she could only have dropped him later for someone even better -- her final partner is at least as good as m. Either way, w does not prefer m to her final partner. Contradiction.`,
        `The matching is proposer-optimal: each proposer gets the best partner he could receive in any stable matching. It is simultaneously recipient-pessimal: each recipient gets the worst partner she could receive in any stable matching. Swapping which side proposes reverses this asymmetry.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Time: O(n^2) worst case. Each of n proposers proposes to at most n recipients, and each proposal is O(1) with precomputed inverse rankings. Doubling n quadruples the worst-case work. With 100 people per side, at most 10,000 proposals. With 1,000, at most 1,000,000.`,
        `Space: O(n^2) for storing all preference lists (n people each with a list of length n). The algorithm's working state -- free list, current matches, next-proposal pointers -- is O(n).`,
        `In practice the algorithm terminates much faster than n^2 proposals because early rounds often match many pairs. Empirical studies on random preferences show roughly O(n log n) proposals on average.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `The National Resident Matching Program (NRMP) matches approximately 40,000 medical residents to hospital programs in the United States each year. The algorithm was adopted in 1952 and formalized by Roth in 1984 as equivalent to Gale-Shapley. Residents submit preference lists over programs, programs rank applicants, and the algorithm produces a resident-optimal stable matching.`,
        `School choice systems in Boston, New York City, and other districts use deferred acceptance (the mechanism design name for Gale-Shapley) to assign students to public schools. Students rank schools; schools have priorities based on sibling enrollment, distance, and lottery numbers. The result is a stable assignment that respects both student preferences and school priorities.`,
        `Kidney exchange programs pair incompatible donor-recipient pairs into swap cycles. While the full problem involves combinatorial optimization over cycles, the pairwise stability concept from Gale-Shapley informs the design of exchange mechanisms that prevent any pair from preferring a private swap over the centralized allocation.`,
        `College admissions in several countries use extensions of the algorithm. The original Gale-Shapley paper was titled "College Admissions and the Stability of Marriage," treating many-to-one matching where each college admits multiple students but each student attends one college.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Proposer-side bias. The algorithm is optimal for the proposing side and pessimal for the receiving side. In the NRMP, residents propose, so the result favors residents. Swapping roles would favor hospitals. The asymmetry is structural, not a bug, but it means the choice of who proposes is a policy decision with distributional consequences.`,
        `Strict complete preferences required. Every participant must rank every member of the other side with no ties. In practice, applicants do not rank all hospitals, and ties are common. Extensions exist (Gale-Shapley with ties is NP-hard to optimize, random tie-breaking is polynomial but loses optimality guarantees) but the basic algorithm assumes a complete strict order.`,
        `Strategic manipulation. Recipients can sometimes gain by misreporting preferences -- rejecting a truly acceptable proposer to hold out for a better one. Roth (1982) proved that no stable matching mechanism is strategy-proof for both sides. The proposing side cannot gain by lying (truthful reporting is a dominant strategy for proposers), but the receiving side can.`,
        `Many-to-many and larger markets. The basic algorithm handles one-to-one matching. Residency matching needs many-to-one (hospitals accept multiple residents). Couples matching (two residents who must be placed together) can break the existence guarantee: stable matchings may not exist with couples. Extensions like the Roth-Peranson algorithm handle this with heuristic search.`,
        `No notion of cardinal utility. The algorithm uses only ordinal rankings. If a participant is nearly indifferent between two options but strongly prefers them to a third, that intensity is invisible. Mechanism designers sometimes layer additional objectives (welfare maximization, fairness constraints) on top of stability.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Three men (m1, m2, m3) and three women (w1, w2, w3). Men's preferences: m1: w1 > w2 > w3; m2: w1 > w3 > w2; m3: w2 > w1 > w3. Women's preferences: w1: m2 > m3 > m1; w2: m1 > m3 > m2; w3: m1 > m2 > m3.`,
        `Round 1: m1 proposes to w1, m2 proposes to w1, m3 proposes to w2. w1 receives m1 and m2. She ranks m2 first, holds m2, rejects m1. w2 receives m3 and holds him. State: m2-w1, m3-w2. m1 is free.`,
        `Round 2: m1 proposes to w2 (his 2nd choice). w2 holds m3 but ranks m1 first. She drops m3, holds m1. State: m1-w2, m2-w1. m3 is free.`,
        `Round 3: m3 proposes to w1 (his 2nd choice). w1 holds m2 and ranks m2 first. She rejects m3. m3 is still free.`,
        `Round 4: m3 proposes to w3 (his 3rd choice). w3 is free and accepts. Final matching: m1-w2, m2-w1, m3-w3. Total proposals: 6 (out of a maximum 9). Check: m1 prefers w1 over w2, but w1 prefers m2 (her match) over m1 -- not a blocking pair. All other unmatched pairs similarly fail the mutual-preference test. The matching is stable.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary source: Gale and Shapley, "College Admissions and the Stability of Marriage" (American Mathematical Monthly, 1962). Roth, "The Evolution of the Labor Market for Medical Interns and Residents: A Case Study in Game Theory" (Journal of Political Economy, 1984) established the NRMP connection. Roth and Sotomayor, "Two-Sided Matching: A Study in Game-Theoretic Modeling and Analysis" (Cambridge, 1990) is the definitive reference.`,
        `Prerequisite: study Hopcroft-Karp bipartite matching for the maximum-cardinality version without preferences. Extension: study the Hungarian algorithm for weighted bipartite assignment where edges carry costs, and the Roth-Peranson algorithm for many-to-one matching with couples. Contrast: study auction mechanisms (Vickrey, ascending) for settings where cardinal valuations replace ordinal rankings, and Nash bargaining for two-party negotiation with transferable utility.`,
      ],
    },
  ],
};
