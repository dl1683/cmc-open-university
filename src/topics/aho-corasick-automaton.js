// Aho-Corasick: a trie plus failure links for multi-pattern matching.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'aho-corasick-automaton',
  title: 'Aho-Corasick Automaton',
  category: 'Data Structures',
  summary: 'Multi-pattern string matching: build a trie, add failure links, and scan the text once while emitting every matched keyword.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trie failure links', 'stream matches'], defaultValue: 'trie failure links' },
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

function automaton(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 0.8, y: 4.0, note: 'state 0' },
      { id: 'h', label: 'h', x: 2.4, y: 2.3, note: '' },
      { id: 'he', label: 'he', x: 4.0, y: 1.5, note: 'output he' },
      { id: 'her', label: 'her', x: 5.6, y: 1.5, note: '' },
      { id: 'hers', label: 'hers', x: 7.2, y: 1.5, note: 'output hers' },
      { id: 'hi', label: 'hi', x: 4.0, y: 3.0, note: '' },
      { id: 'his', label: 'his', x: 5.6, y: 3.0, note: 'output his' },
      { id: 's', label: 's', x: 2.4, y: 5.8, note: '' },
      { id: 'sh', label: 'sh', x: 4.0, y: 5.4, note: '' },
      { id: 'she', label: 'she', x: 5.6, y: 5.4, note: 'output she + he' },
    ],
    edges: [
      { id: 'e-root-h', from: 'root', to: 'h', weight: 'h' },
      { id: 'e-h-he', from: 'h', to: 'he', weight: 'e' },
      { id: 'e-he-her', from: 'he', to: 'her', weight: 'r' },
      { id: 'e-her-hers', from: 'her', to: 'hers', weight: 's' },
      { id: 'e-h-hi', from: 'h', to: 'hi', weight: 'i' },
      { id: 'e-hi-his', from: 'hi', to: 'his', weight: 's' },
      { id: 'e-root-s', from: 'root', to: 's', weight: 's' },
      { id: 'e-s-sh', from: 's', to: 'sh', weight: 'h' },
      { id: 'e-sh-she', from: 'sh', to: 'she', weight: 'e' },
      { id: 'f-she-he', from: 'she', to: 'he', weight: 'fail/output' },
      { id: 'f-hers-s', from: 'hers', to: 's', weight: 'fail' },
      { id: 'f-hi-root', from: 'hi', to: 'root', weight: 'fail' },
    ],
  }, { title });
}

function* trieFailureLinks() {
  const dictionary = ['he', 'she', 'his', 'hers'];
  const patternCount = dictionary.length;
  const nodeLabels = ['root', 'h', 'he', 'her', 'hers', 'hi', 'his', 's', 'sh', 'she'];
  const nodeCount = nodeLabels.length;
  const outputNodes = ['he', 'hers', 'his', 'she'];
  const edgeCount = 12;
  const buildSteps = ['insert patterns', 'BFS from root', 'compute fail links', 'merge outputs'];
  const storageFields = ['goto edge', 'failure edge', 'output set', 'current state'];

  yield {
    state: automaton('Dictionary: he, she, his, hers'),
    highlight: { active: ['root', 'h', 's'], found: ['he', 'she', 'his', 'hers'] },
    explanation: `Aho-Corasick starts with a trie of all ${patternCount} patterns. Every prefix is one of ${nodeCount} states. The ${outputNodes.length} output states (${outputNodes.join(', ')}) record which keywords end there.`,
  };

  yield {
    state: automaton('Failure links jump to the longest suffix state'),
    highlight: { active: ['she', 'f-she-he', 'he'], compare: ['hers', 'f-hers-s'] },
    explanation: `Failure links are the multi-pattern version of KMP fallback. If the automaton cannot follow the next character among ${edgeCount} edges, it jumps to the longest suffix that is also a trie prefix — e.g. "${'she'}" fails to "${'he'}".`,
    invariant: `A failure link preserves the longest useful suffix; the ${nodeCount}-node automaton has ${edgeCount - 9} dedicated failure edges connecting suffix states.`,
  };

  yield {
    state: labelMatrix(
      'Build order',
      [
        { id: 'trie', label: 'insert patterns' },
        { id: 'bfs', label: 'BFS from root' },
        { id: 'fail', label: 'compute fail links' },
        { id: 'output', label: 'merge outputs' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['Trie edges', 'sum pattern lengths'],
        ['Queue by depth', 'linear states'],
        ['fallback transitions', 'linear with alphabet handling'],
        ['suffix matches', 'reported matches preserved'],
      ],
    ),
    highlight: { found: ['fail:structure', 'output:structure'], active: ['bfs:cost'] },
    explanation: `Failure links are built in ${buildSteps.length} phases breadth-first so a parent failure link is known before its children need it. Output links ensure that matching ${'she'} also reports ${'he'}.`,
  };

  yield {
    state: labelMatrix(
      'What the automaton stores',
      [
        { id: 'goto', label: 'goto edge' },
        { id: 'fail', label: 'failure edge' },
        { id: 'out', label: 'output set' },
        { id: 'state', label: 'current state' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'neighbor', label: 'study link' },
      ],
      [
        ['consume matching char', 'Trie'],
        ['recover on mismatch', 'KMP Prefix Function'],
        ['emit pattern ids', 'Inverted Index'],
        ['longest matched suffix', 'Finite State Machine'],
      ],
    ),
    highlight: { active: ['fail:neighbor', 'state:meaning'], found: ['out:meaning'] },
    explanation: `Aho-Corasick is best read as a finite-state machine compiled from ${patternCount} dictionary entries into ${storageFields.length} per-node fields. Each text character causes transitions until the machine reaches the right suffix state.`,
  };
}

function* streamMatches() {
  const scanText = 'ushers';
  const textLen = scanText.length;
  const scanChars = scanText.split('');
  const matchesFound = ['she', 'he', 'hers'];
  const matchCount = matchesFound.length;
  const runtimeRows = ['text chars', 'failure traversals', 'outputs', 'total'];
  const useCases = ['intrusion signatures', 'content filter', 'DNA motifs', 'bibliographic search'];

  yield {
    state: labelMatrix(
      'Scan text: ushers',
      [
        { id: 'u', label: 'u' },
        { id: 's', label: 's' },
        { id: 'h', label: 'h' },
        { id: 'e', label: 'e' },
        { id: 'r', label: 'r' },
        { id: 's2', label: 's' },
      ],
      [
        { id: 'state', label: 'state after char' },
        { id: 'output', label: 'output' },
      ],
      [
        ['root', 'none'],
        ['s', 'none'],
        ['sh', 'none'],
        ['she', 'she, he'],
        ['her', 'none'],
        ['hers', 'hers'],
      ],
    ),
    highlight: { found: ['e:output', 's2:output'], active: ['e:state', 's2:state'] },
    explanation: `The ${textLen}-character text "${scanText}" is scanned once across ${textLen} rows. At ${scanChars[3]}, the state ${'she'} emits ${'she'} and follows output inheritance to emit ${'he'}. At the final ${scanChars[5]}, it emits ${'hers'}.`,
  };

  yield {
    state: automaton('After reporting she, failure/output reports he'),
    highlight: { active: ['she', 'f-she-he'], found: ['he'] },
    explanation: `The match ${'she'} ends at the same character as ${'he'}, because ${'he'} is a suffix of ${'she'}. Output merging is what makes ${matchCount} overlapping matches appear without rescanning "${scanText}".`,
  };

  yield {
    state: labelMatrix(
      'Runtime accounting',
      [
        { id: 'text', label: 'text chars' },
        { id: 'fail', label: 'failure traversals' },
        { id: 'emit', label: 'outputs' },
        { id: 'total', label: 'total' },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['O(n)', 'one stream pass'],
        ['amortized linear', 'suffix depth drops'],
        ['O(matches)', 'must report them'],
        ['O(n + matches)', 'after preprocessing'],
      ],
    ),
    highlight: { found: ['total:bound'], compare: ['emit:bound'] },
    explanation: `The scanner is linear in the text plus the number of matches emitted. The ${runtimeRows.length}-row accounting shows the bound is O(n + matches); for "${scanText}" that means ${textLen} char reads plus ${matchCount} outputs.`,
  };

  yield {
    state: labelMatrix(
      'Case-study uses',
      [
        { id: 'ids', label: 'intrusion signatures' },
        { id: 'filter', label: 'content filter' },
        { id: 'bio', label: 'DNA motifs' },
        { id: 'index', label: 'bibliographic search' },
      ],
      [
        { id: 'whyMany', label: 'why many-pattern matching' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['thousands of signatures', 'match explosion'],
        ['many forbidden phrases', 'normalization matters'],
        ['motif dictionary', 'alphabet small but huge text'],
        ['keyword catalog', 'historical paper use case'],
      ],
    ),
    highlight: { active: ['ids:whyMany', 'index:whyMany'], compare: ['filter:risk'] },
    explanation: `Aho-Corasick is what you reach for across ${useCases.length} domains — ${useCases[0]}, ${useCases[useCases.length - 1]}, and more — when the dictionary is fixed, the stream is large, and overlapping matches matter.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trie failure links') yield* trieFailureLinks();
  else if (view === 'stream matches') yield* streamMatches();
  else throw new InputError('Pick an Aho-Corasick view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization shows the Aho-Corasick automaton for the dictionary {"he", "she", "his", "hers"}. Each circle is a state in the automaton, labeled with the string prefix it represents. "root" is the start state, representing the empty string. Solid arrows between states are goto transitions: following one means the automaton consumed a matching character from the text and moved deeper into the trie.',
        'Dashed arrows labeled "fail" are failure links. A failure link points from a state to the longest proper suffix of that state\'s prefix that is itself a prefix in the trie. When the automaton cannot follow a goto edge for the next text character, it falls back along a failure link instead of restarting from root. The arrow from "she" to "he" is labeled "fail/output" because "he" is both the failure target and a complete pattern, making it an output link as well.',
        'States annotated "output" emit a match when entered. In the "stream matches" view, the text pointer advances exactly once per character and never rewinds. Active highlights mark the current state. Found highlights mark patterns that have been reported. The matrix views show the state transitions character by character and the matches discovered at each position.',
        {type: 'callout', text: 'Aho-Corasick turns many keyword searches into one automaton by preserving the longest useful suffix after every mismatch.'},

        {type: 'image', src: './assets/gifs/aho-corasick-automaton.gif', alt: 'Animated walkthrough of the aho corasick automaton visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Alfred Aho and Margaret Corasick published "Efficient String Matching: An Aid to Bibliographic Search" in Communications of the ACM in 1975, while both were at Bell Labs. The problem they solved: given a dictionary of k fixed keyword strings with total length m and a text of length n, find every occurrence of every keyword in the text, including overlapping ones, in O(n + m + z) time where z is the number of matches. The result was the algorithm behind Unix fgrep, which needed to search for many fixed strings simultaneously.',
        'The problem is fundamental because multi-pattern matching appears in any domain where a fixed dictionary must be checked against a stream. Network intrusion detection systems like Snort check every packet against thousands of attack signatures. Antivirus engines like ClamAV scan file bytes against tens of thousands of malware signatures. Bioinformatics pipelines search gigabase genomes for hundreds of known DNA motifs. In every case, the dictionary is fixed (updated infrequently), the stream is enormous, and you need every match including overlaps.',
        'Before Aho-Corasick, the only option was to run a single-pattern matcher once per keyword. The algorithm eliminated that multiplier entirely, reducing the text scanning cost from O(k * n) to O(n) regardless of how many patterns are in the dictionary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Take any good single-pattern matcher, say KMP (Knuth-Morris-Pratt), and run it once per pattern. KMP finds all occurrences of one pattern p in O(n + |p|) time. With k patterns totaling m characters, the cost is O(k * n + m). For a concrete case: 5,000 attack signatures against a 100 MB packet capture means 5,000 full passes over 100 million characters, roughly 500 billion character comparisons. Each pass builds its own failure function independently, even though many patterns share prefixes or suffixes.',
        'Rabin-Karp is another option. It hashes a sliding window of the text and checks against a hash set of patterns. This works well when all patterns have the same length, but a dictionary with varying lengths (2-character patterns mixed with 20-character patterns) requires either multiple window sizes or padding, both of which degrade performance. Worst-case cost on hash collisions is still O(k * n).',
        'Both approaches share a structural flaw: they treat patterns as independent search problems. Patterns "he", "her", and "hers" share the prefix "he", and "she" contains "he" as a suffix, but independent matchers cannot exploit either relationship. Every shared structure in the dictionary is discovered and discarded k separate times.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is redundant work across patterns. Each pattern gets its own pass over the text, and suffix-fallback information computed during one pass is invisible to every other pass. The patterns "he", "her", "hers", and "she" all involve the two-character sequence "he", but four independent matchers each discover and handle it separately. The text is read k times, doing O(n) work each time, with no information shared between passes.',
        'The second wall is overlapping matches. When the text contains "she", the substring "he" also ends at the same position (positions 2-3 overlap with positions 1-3). Independent matchers detect both matches, but only by coincidence of running in separate passes. A single-pass algorithm must notice that when "she" completes, "he" also completes at the same text position, without rescanning any character. This requires the matcher to track not just the current pattern being matched, but every shorter pattern that could complete at the same position.',
        'These two walls are connected. Prefix sharing and suffix sharing are the two ways patterns overlap structurally. Any algorithm that solves multi-pattern matching in one pass must exploit both forms of sharing simultaneously.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Merge all k patterns into a single finite-state machine that processes the text character by character and emits every match. The machine has three components. First, a trie built from all patterns. The trie merges shared prefixes: "he", "her", and "hers" share the path root -> h -> he, so those characters are only stored once. Each root-to-leaf path spells a pattern, and each internal node represents a prefix shared by multiple patterns.',
        {type: 'image', src: 'https://iq.opengenus.org/content/images/2018/11/trie.png', alt: 'Trie structure used as the base of Aho-Corasick matching.', caption: 'The trie merges shared prefixes before failure links add suffix recovery. (Source: iq.opengenus.org)'},
        'Second, failure links. These are the generalization of KMP\'s failure function from a single string to an entire trie. KMP\'s failure function for one pattern answers: "after a mismatch at position j, what is the longest proper prefix of pattern[0..j-1] that is also a suffix?" Aho-Corasick\'s failure link for a trie state answers the same question across all patterns: "if no goto edge exists for the next character, what is the longest proper suffix of my prefix that is itself a prefix in the trie?" This suffix might belong to a completely different pattern. State "she" fails to state "he" because "he" is the longest suffix of "she" that appears as a prefix in the trie.',
        'Third, output links. These handle overlapping completions. When state "she" is entered, the output link chain reports that "he" also completes at the same position, because "he" is both a complete pattern and the failure target of "she". The output chain collects every shorter pattern that ends at the current text position without requiring any backtracking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase 1 -- trie construction. Insert each pattern character by character starting from root. For each character, if a child edge on that character already exists, follow it; otherwise create a new node. Mark the final node of each pattern as an output node, recording which pattern ends there. For the dictionary {"he", "she", "his", "hers"}: inserting "he" creates root -> h -> he (mark he). Inserting "she" creates root -> s -> sh -> she (mark she). Inserting "his" extends root -> h to root -> h -> hi -> his (mark his). Inserting "hers" extends root -> h -> he to root -> h -> he -> her -> hers (mark hers). Result: 10 nodes and 9 goto edges.',
        'Phase 2 -- failure link construction. Process all trie nodes in BFS order (breadth-first, level by level from root). Every depth-1 node gets failure link to root, because a single character has no proper suffix that is also a trie prefix. For a deeper node u reached from parent p via character c: start at f(p) (the parent\'s failure link target). If f(p) has a child on c, then f(u) = that child. If not, follow f(f(p)) and repeat, continuing until either a goto edge on c is found or root is reached. BFS ordering is essential: it guarantees that f(p) is computed before any child of p needs it. Concrete example: f(sh) = h because root (the failure target of s) has a child on "h". Then f(she) = he because h (the failure target of sh) has a child on "e".',
        'Phase 3 -- output link construction. For each node u in BFS order: if u\'s failure target f(u) is itself an output node, set u\'s output link to f(u). Otherwise, copy f(u)\'s output link (which may be null). This creates chains: she\'s failure target is he, and he is an output node, so she gets output link -> he. This means entering state "she" will report both "she" (its own output) and "he" (via the output link).',
        'Search phase. Initialize the current state to root. For each character c in the text: attempt goto(current, c). If the goto edge exists, move to that child. If not, set current = f(current) and try goto again. Repeat until a goto edge is found or current is root (root implicitly has a self-loop on every character not in its children). After settling into the new state, walk the output link chain starting from the current state and report every pattern found. The text pointer advances exactly once per character and never rewinds.',
        {type: 'image', src: 'https://bs-uploads.toptal.io/blackfish-uploads/uploaded_file/file/191788/image-1582328549102-447a1375d0c3be19c4d8039d8ba0d7a1.png', alt: 'Aho-Corasick automaton diagram with trie transitions and failure links.', caption: 'Failure links turn the trie into a stream automaton that avoids rescanning text. (Source: bs-uploads.toptal.io)'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The central invariant: after reading text[0..i], the current state is the longest suffix of text[0..i] that is a prefix of some pattern in the dictionary. Call this suffix s(i). A goto transition on the next character c extends s(i) to s(i) + c, which is one character longer. A failure link shortens it to the next-longest suffix that is still a trie prefix. Because failure links always move to a strictly shorter string (f(u) is always shorter than u), the chain terminates. Because they move to the longest possible shorter suffix, no potential match is skipped between the current suffix and the next one.',
        'Output links guarantee completeness. Every pattern that ends at position i is a suffix of text[0..i]. The longest such suffix that is a trie prefix is the current state. Every shorter suffix that is also a complete pattern is reachable by following the output link chain from the current state. The chain visits every such pattern exactly once, so no match is missed and none is reported twice.',
        'The amortized argument for linear time uses a potential function. Let D(i) be the depth (string length) of the current state after reading character i. Each goto transition increases D by exactly 1. Each failure link traversal decreases D by at least 1. D starts at 0 and never goes negative. Over the entire scan of n characters, there are exactly n increases (one per character), so there can be at most n total decreases. The total number of failure link traversals across the entire scan is therefore at most n. Adding n goto transitions plus at most n failure traversals plus z output reports gives O(n + z) total work during the search phase.',
        'Preprocessing correctness relies on BFS ordering. When computing f(u) for node u at depth d, the algorithm follows the failure chain of u\'s parent p. All nodes on that chain have depth less than d, so their failure links were computed in earlier BFS levels. The induction base is that all depth-1 nodes have f = root, which is trivially correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build time: O(m) to insert all patterns into the trie, where m is the total length of all patterns. Failure link construction visits each node once in BFS. At each node, the failure chain traversal is bounded by the node\'s depth, but the total work across all nodes is bounded by m (same potential argument: each goto during insertion increases depth by 1, each failure traversal during construction decreases it). With hash-map children, total build is O(m). With dense arrays indexed by character (one slot per alphabet symbol per node), build is O(m * |S|) where |S| is the alphabet size.',
        'Build space: O(m * |S|) with dense goto arrays -- for ASCII, that is 128 slots per node, so 10 nodes costs 1,280 entries. Hash-map children reduce space to O(m) but add a constant-factor overhead per lookup (hash computation, cache misses). In practice, dense arrays are used for small alphabets (DNA: |S| = 4, ASCII: |S| = 128) and hash maps for large alphabets (Unicode).',
        'Search time: O(n + z) where n is the text length and z is the total number of pattern occurrences reported. The n term comes from reading each character once and performing amortized O(1) failure traversals per character. The z term comes from walking output link chains, each of which reports one match in O(1). This bound is independent of k, the number of patterns. Doubling the dictionary size doubles build time and space but does not change search time at all.',
        'Concrete comparison. For k = 5,000 patterns, m = 50,000 total pattern characters, n = 100,000,000 text characters. Naive (KMP per pattern): 5,000 * 100,000,000 = 500 billion character reads. Aho-Corasick build: proportional to 50,000 (trie + failure links). Aho-Corasick search: proportional to 100,000,000 + z. The speedup is a factor of k = 5,000.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network intrusion detection. Snort and Suricata compile thousands of attack signatures (byte sequences identifying known exploits, malware beacons, and policy violations) into an Aho-Corasick automaton. Every packet payload is streamed through the automaton once. The dictionary changes only when rules are updated (typically daily), so the build cost is amortized across billions of packets. The requirement is matching at wire speed -- 10 Gbps links produce roughly 1.25 GB/s of payload, and the automaton must keep up without dropping packets.',
        'Antivirus and malware scanning. ClamAV builds an Aho-Corasick automaton from its signature database (tens of thousands of byte-level signatures). When scanning a file, it streams the file through the automaton once, regardless of how many signatures exist. YARA rules use a similar multi-pattern prefilter: the Aho-Corasick stage quickly identifies which rules have potential matches, then a secondary verification stage confirms full rule matches. Without the prefilter, scanning a 1 GB disk image against 30,000 signatures would require 30,000 passes.',
        'Bioinformatics. DNA motif search scans genomes (billions of base pairs, alphabet = {A, C, G, T}) against dictionaries of known regulatory motifs, binding sites, or primer sequences. The small alphabet makes dense goto arrays cheap (4 entries per node), and the enormous text length makes one-pass scanning essential. The Human Genome Project\'s 3.2 billion base pairs would require 3.2 billion * k character comparisons under the naive approach; Aho-Corasick does it in 3.2 billion.',
        'Text processing tools. GNU grep with the -F flag (fixed-string matching, the direct descendant of the original fgrep) uses Aho-Corasick internally when given multiple patterns via -e or a pattern file via -f. Content filtering systems (profanity filters, spam blocklists, sensitive-data detectors) compile forbidden phrases into an automaton and scan user-generated content in a single pass, enabling real-time filtering at scale.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Single-pattern search. When k = 1, the trie has no shared prefixes to exploit and no output links to follow. KMP is simpler and has less overhead. Boyer-Moore is often faster in practice for single patterns because it can skip characters by comparing right-to-left, a trick that Aho-Corasick cannot use (it must process every character to maintain its state invariant). The automaton only pays off when k is large enough to amortize the build cost.',
        'Regex and approximate matching. The automaton matches exact fixed substrings only. It cannot handle wildcards, character classes, quantifiers (*,+,?), alternation, backreferences, or edit-distance (fuzzy) matching. For regular expressions, you need Thompson NFA construction or a derivative-based matcher. For approximate matching, you need Levenshtein automata or bitap algorithms. Aho-Corasick is strictly a fixed-string matcher.',
        'Dynamic dictionaries. Adding or removing even one pattern requires rebuilding all failure and output links, because a new pattern can change the failure target of existing nodes (a new prefix might become the longest suffix for an existing state). If the dictionary changes every few seconds, rebuild cost can dominate. Incremental variants exist (Aoe 1989, Dori and Landau 2006) but add substantial implementation complexity and are not widely deployed.',
        'Large alphabets. Dense goto arrays allocate |S| entries per node. For full Unicode (1,114,112 code points), that is over 1 million entries per node, which is clearly impractical. Hash maps or compressed sparse row formats are required, but they add a constant factor per transition (hash computation, pointer chasing) that can matter at wire speed. For ASCII (128 entries per node), dense arrays are standard.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Dictionary: {"he", "she", "his", "hers"}, 4 patterns, total length m = 2 + 3 + 3 + 4 = 12 characters. Trie construction produces 10 nodes: root, h, he*, hi, his*, her, hers*, s, sh, she* (asterisks mark output nodes), and 9 goto edges. Node count is less than m because "he" and "her"/"hers" share the prefix root -> h -> he.',
        'Failure links, computed BFS level by level. Depth 1: f(h) = root, f(s) = root (single characters have no proper suffix that is a trie prefix). Depth 2: for he, parent h has f(h) = root, root has no child on "e", so f(he) = root. For hi, same reasoning, f(hi) = root. For sh, parent s has f(s) = root, root has a child on "h" (node h), so f(sh) = h. Depth 3: for she, parent sh has f(sh) = h, and h has a child on "e" (node he), so f(she) = he. For her, parent he has f(he) = root, root has no child on "r", so f(her) = root. For his, parent hi has f(hi) = root, root has a child on "s" (node s), so f(his) = s. Depth 4: for hers, parent her has f(her) = root, root has a child on "s" (node s), so f(hers) = s.',
        'Output links. Walk through all nodes: she\'s failure target is he, and he is an output node, so she gets output link -> he. Every other node either has a failure target that is not an output node, or the failure target\'s output link is null. Result: the only output link in this automaton is she -> he.',
        'Now scan the text "ushers" (n = 6). Character u (index 0): current = root, root has no child on "u", stay at root. No outputs. Character s (index 1): root has child on "s", goto s. No output at s. Character h (index 2): s has child on "h", goto sh. No output at sh. Character e (index 3): sh has child on "e", goto she. she is an output node: emit "she" ending at index 3 (positions 1-3). Follow output link to he: emit "he" ending at index 3 (positions 2-3). Character r (index 4): she has no child on "r". Follow failure link: f(she) = he. he has a child on "r", goto her. No output at her. Character s (index 5): her has child on "s", goto hers. hers is an output node: emit "hers" ending at index 5 (positions 2-5). hers has no output link. Final tally: 3 matches found ("she" at 1-3, "he" at 2-3, "hers" at 2-5) in one pass over 6 characters. The text pointer advanced 6 times and never rewound. Failure links were followed once (at index 4). Total work: 6 goto attempts + 1 failure traversal + 3 output reports = 10 operations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Aho, A. V. and Corasick, M. J. (1975), "Efficient String Matching: An Aid to Bibliographic Search," Communications of the ACM 18(6), pp. 333-340. This is the foundational paper that introduced the automaton, proved the O(n + m + z) bound, and described the construction algorithm. Commentz-Walter (1979) combined Aho-Corasick with Boyer-Moore\'s right-to-left scanning heuristic to speed up search on certain workloads where patterns are long and the alphabet is large. Aoe (1989) described an incremental construction that avoids full rebuilds when patterns are added.',
        'Prerequisites: Trie (the base data structure; understand trie insertion and lookup before studying Aho-Corasick), KMP Algorithm (the failure function for a single pattern; Aho-Corasick generalizes this concept from one string to an entire trie of strings). Study KMP first -- if you understand why KMP\'s failure function gives the longest proper prefix that is also a suffix, the leap to Aho-Corasick\'s failure links across a trie is natural.',
        'Related algorithms: Rabin-Karp (hash-based multi-pattern matching; simpler to implement but O(k*n) worst case and awkward with varying-length patterns), Suffix Array and Suffix Tree (preprocess the text instead of the patterns; better when the text is fixed and many different queries arrive over time), Commentz-Walter (hybrid of Aho-Corasick and Boyer-Moore for multi-pattern search with right-to-left scanning), Regular Expressions (when patterns need quantifiers, alternation, character classes, or approximate matching beyond fixed substrings).',
      ],
    },
  ],
};
