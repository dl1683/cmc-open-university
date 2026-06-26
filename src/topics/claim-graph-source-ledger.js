// Claim graph and source ledger: the provenance data structure underneath
// deep research, policy analysis, technical reports, and citation-heavy agents.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'claim-graph-source-ledger',
  title: 'Claim Graph & Source Ledger',
  category: 'Data Structures',
  summary: 'Model research as a graph of claims, evidence, contradictions, dates, authority, and report sections so synthesis stays auditable.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['claim graph', 'evidence workflow'], defaultValue: 'claim graph' },
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

function claimGraph(title) {
  return graphState({
    nodes: [
      { id: 'q', label: 'question', x: 0.7, y: 3.6, note: 'scope' },
      { id: 'c1', label: 'claim A', x: 2.4, y: 2.3, note: 'assert' },
      { id: 'c2', label: 'claim B', x: 2.4, y: 5.2, note: 'assert' },
      { id: 's1', label: 'paper', x: 4.7, y: 1.1, note: 'primary' },
      { id: 's2', label: 'docs', x: 4.8, y: 2.9, note: 'official' },
      { id: 's3', label: 'blog', x: 4.8, y: 4.8, note: 'secondary' },
      { id: 's4', label: 'filing', x: 4.7, y: 6.4, note: 'dated' },
      { id: 'conflict', label: 'conflict', x: 6.6, y: 3.8, note: 'why?' },
      { id: 'section', label: 'section', x: 8.0, y: 2.5, note: 'uses' },
      { id: 'answer', label: 'answer', x: 9.1, y: 4.2, note: 'cited' },
    ],
    edges: [
      { id: 'e-q-c1', from: 'q', to: 'c1' },
      { id: 'e-q-c2', from: 'q', to: 'c2' },
      { id: 'e-s1-c1', from: 's1', to: 'c1' },
      { id: 'e-s2-c1', from: 's2', to: 'c1' },
      { id: 'e-s3-c2', from: 's3', to: 'c2' },
      { id: 'e-s4-c2', from: 's4', to: 'c2' },
      { id: 'e-c1-conflict', from: 'c1', to: 'conflict' },
      { id: 'e-c2-conflict', from: 'c2', to: 'conflict' },
      { id: 'e-c1-section', from: 'c1', to: 'section' },
      { id: 'e-c2-section', from: 'c2', to: 'section' },
      { id: 'e-section-answer', from: 'section', to: 'answer' },
    ],
  }, { title });
}

function workflowGraph(title) {
  return graphState({
    nodes: [
      { id: 'scope', label: 'scope', x: 0.7, y: 3.8, note: 'question' },
      { id: 'search', label: 'search', x: 2.1, y: 1.6, note: 'find' },
      { id: 'read', label: 'read', x: 3.5, y: 1.6, note: 'extract' },
      { id: 'ledger', label: 'ledger', x: 4.9, y: 3.8, note: 'claims' },
      { id: 'rank', label: 'rank', x: 3.5, y: 5.9, note: 'authority' },
      { id: 'audit', label: 'audit', x: 6.4, y: 2.0, note: 'gaps' },
      { id: 'outline', label: 'outline', x: 6.4, y: 5.6, note: 'sections' },
      { id: 'write', label: 'write', x: 8.1, y: 3.8, note: 'synthesis' },
      { id: 'refresh', label: 'refresh', x: 9.2, y: 2.0, note: 'stale?' },
      { id: 'publish', label: 'publish', x: 9.3, y: 5.7, note: 'cited' },
    ],
    edges: [
      { id: 'e-scope-search', from: 'scope', to: 'search' },
      { id: 'e-search-read', from: 'search', to: 'read' },
      { id: 'e-read-ledger', from: 'read', to: 'ledger' },
      { id: 'e-search-rank', from: 'search', to: 'rank' },
      { id: 'e-rank-ledger', from: 'rank', to: 'ledger' },
      { id: 'e-ledger-audit', from: 'ledger', to: 'audit' },
      { id: 'e-ledger-outline', from: 'ledger', to: 'outline' },
      { id: 'e-audit-refresh', from: 'audit', to: 'refresh' },
      { id: 'e-audit-write', from: 'audit', to: 'write' },
      { id: 'e-outline-write', from: 'outline', to: 'write' },
      { id: 'e-write-publish', from: 'write', to: 'publish' },
    ],
  }, { title });
}

function* graphView() {
  const nodeCount = 10;
  const edgeCount = 11;
  const sourceCount = 4;
  const claimCount = 2;
  const recordFields = 6;
  const contradictionTypes = 5;

  yield {
    state: claimGraph('Research synthesis should be a graph, not a pile of notes'),
    highlight: { active: ['q', 'c1', 'c2', 'e-q-c1', 'e-q-c2'], compare: ['answer'] },
    explanation: `A source ledger starts with scoped claims across ${nodeCount} graph nodes linked by ${edgeCount} edges. Each claim is atomic enough to check, cite, contradict, or remove. The final answer should be downstream of this graph, not a memory of what the agent once read.`,
  };

  yield {
    state: claimGraph('Sources support, date, weaken, or contradict claims'),
    highlight: { active: ['s1', 's2', 's3', 's4', 'c1', 'c2', 'e-s1-c1', 'e-s2-c1', 'e-s3-c2', 'e-s4-c2'], found: ['conflict'] },
    explanation: `The edge label matters. Each of the ${sourceCount} sources can support a claim, merely mention it, provide a date, define a term, or contradict another source. With ${claimCount} claims in play, citation quality collapses when all edges are treated as "source says".`,
    invariant: `A citation should support the exact sentence it is attached to — ${sourceCount} sources feed ${claimCount} claims here, and each edge type matters.`,
  };

  yield {
    state: labelMatrix(
      'Claim record schema',
      [
        { id: 'text', label: 'claim text' },
        { id: 'source', label: 'source pointer' },
        { id: 'span', label: 'span' },
        { id: 'time', label: 'time' },
        { id: 'authority', label: 'authority' },
        { id: 'use', label: 'report use' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'prevents', label: 'prevents' },
      ],
      [
        ['one assertion', 'vague summary'],
        ['URL/file/page', 'lost provenance'],
        ['quote/data row', 'citation bluff'],
        ['published/accessed', 'stale fact'],
        ['primary/secondary', 'false balance'],
        ['section target', 'orphan notes'],
      ],
    ),
    highlight: { active: ['source:stores', 'span:stores', 'time:stores', 'authority:stores'], removed: ['span:prevents'] },
    explanation: `The minimum record has ${recordFields} fields: claim, source pointer, exact support span, date, authority label, and intended report section. That is enough to audit an answer and to refresh only the stale or weak parts later.`,
  };

  yield {
    state: labelMatrix(
      'Contradiction handling',
      [
        { id: 'version', label: 'newer version' },
        { id: 'method', label: 'method gap' },
        { id: 'scope', label: 'scope gap' },
        { id: 'metric', label: 'metric mismatch' },
        { id: 'interest', label: 'conflict of interest' },
      ],
      [
        { id: 'signal', label: 'what it means' },
        { id: 'response', label: 'response' },
      ],
      [
        ['fact changed', 'prefer current'],
        ['different design', 'explain both'],
        ['not same population', 'narrow claim'],
        ['incomparable score', 'normalize'],
        ['incentive bias', 'downgrade weight'],
      ],
    ),
    highlight: { active: ['version:response', 'method:response', 'scope:response', 'metric:response'], compare: ['interest:response'] },
    explanation: `Contradictions are not bugs to hide. They are where research becomes useful. The ledger classifies ${contradictionTypes} contradiction types so the synthesis can explain disagreement instead of averaging incompatible claims.`,
  };
}

function* evidenceWorkflow() {
  const workflowSteps = 10;
  const workflowEdges = 11;
  const maxEvidence = 80;
  const stopPoint = 45;
  const coverageAtStop = 0.84;
  const confusionAtStop = 0.44;

  yield {
    state: workflowGraph('Evidence workflow: search, read, rank, ledger, audit, write'),
    highlight: { active: ['scope', 'search', 'read', 'ledger', 'e-scope-search', 'e-search-read', 'e-read-ledger'], compare: ['write'] },
    explanation: `A research agent should not write from raw search results. Across ${workflowSteps} pipeline steps linked by ${workflowEdges} edges, it should extract evidence into a ledger, rank source authority, and audit gaps before drafting. That is the data-structure version of critical thinking.`,
  };

  yield {
    state: workflowGraph('Authority ranking happens before synthesis'),
    highlight: { active: ['search', 'rank', 'ledger', 'e-search-rank', 'e-rank-ledger'], found: ['audit'], compare: ['write'] },
    explanation: `Official docs, primary papers, benchmark repos, filings, vendor blogs, news stories, and social posts should not have equal weight. With ${workflowSteps} stages in the pipeline, ranking early prevents the final report from laundering weak sources into strong prose.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'evidence items', min: 0, max: maxEvidence }, y: { label: 'research value', min: 0, max: 1 } },
      series: [
        { id: 'coverage', label: 'coverage', points: [{ x: 5, y: 0.25 }, { x: 12, y: 0.48 }, { x: 24, y: 0.7 }, { x: stopPoint, y: coverageAtStop }, { x: maxEvidence, y: 0.9 }] },
        { id: 'confusion', label: 'confusion', points: [{ x: 5, y: 0.03 }, { x: 12, y: 0.08 }, { x: 24, y: 0.19 }, { x: stopPoint, y: confusionAtStop }, { x: maxEvidence, y: 0.8 }] },
      ],
      markers: [
        { id: 'stop', x: stopPoint, y: coverageAtStop, label: 'audit before more crawl' },
      ],
    }),
    highlight: { active: ['coverage', 'stop'], compare: ['confusion'] },
    explanation: `More evidence helps until it becomes redundant or noisy. At ${stopPoint} items, coverage reaches ${coverageAtStop} but confusion hits ${confusionAtStop}. A ledger enables stop rules: if the remaining gaps are specific, search for those gaps instead of crawling up to ${maxEvidence} weak sources.`,
  };

  yield {
    state: workflowGraph('Audit sends stale or unsupported claims back to research'),
    highlight: { active: ['ledger', 'audit', 'refresh', 'e-ledger-audit', 'e-audit-refresh'], found: ['publish'], compare: ['write'] },
    explanation: `A good ledger supports refresh across all ${workflowSteps} workflow stages. Date-sensitive claims can be rechecked, unsupported claims can be removed, and contradictions can be reopened without rewriting the whole report.`,
    invariant: `The answer is only as strong as the weakest important claim it depends on — audit the full ${workflowEdges}-edge pipeline before publishing.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'claim graph') yield* graphView();
  else if (view === 'evidence workflow') yield* evidenceWorkflow();
  else throw new InputError('Pick a claim-ledger view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation builds a claim graph one node at a time. First you see a question node appear -- that is the research question the graph will answer. Then claim nodes attach to it, each one a single testable statement. Source nodes connect to claims through labeled edges: "support," "contradict," "supersede," "scope." Pay close attention when a contradiction node appears between two claims. That moment is the whole point: the graph names the conflict instead of hiding it behind smooth prose.',
        {type: 'image', src: './assets/gifs/claim-graph-source-ledger.gif', alt: 'Animated walkthrough of the claim graph source ledger visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The second view switches to the evidence pipeline: eight stages (search, read, extract, rank, ledger, audit, outline, write) light up in sequence. The feedback arrow from audit back to search is the critical loop. It means the system discovers holes in its evidence and goes back for more sources before writing, rather than papering over gaps with confident language.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A report can have fifty footnotes and still be wrong. The footnotes point to real documents, but none of those documents actually prove the specific sentence they are attached to. This failure mode has a name: citation bluffing. The references are genuine; the link between each claim and its evidence is vague, implicit, or missing entirely. Readers who trust the footnote count never notice.',
        {type: 'callout', text: 'A claim graph makes evidence a first-class dependency, so fluent prose cannot outrun exact support.'},
        'A claim graph exists to make every claim-to-evidence link explicit and machine-auditable. Instead of a bibliography dumped at the end of the document, each atomic claim carries a pointer to the exact paragraph, data cell, or artifact that backs it. Claims are nodes. Sources are nodes. Typed edges connect them. The source ledger is the persistent table underneath the graph: it stores the claim text, source pointer, exact support span, publication date, access date, authority tier, scope note, and the report section that consumes this claim.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Most research writing follows a familiar path: search, skim, take notes, draft prose, then bolt citations on at the end. For short pieces where no one will challenge individual sentences -- a blog post, an internal summary -- this is fine. A flat reference list at the bottom does the job.',
        'A step up is a bibliography manager like Zotero or BibTeX. These store whole-document metadata: title, author, year, DOI. You know which papers you read. But the manager still cannot answer the hard question: "which exact sentence in source S proves claim C?" That mapping lives only in the writer\'s head, and it evaporates the moment someone else inherits the report.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The flat approach breaks in three concrete situations. First, partial support: a benchmark paper proves system A beats system B on workload W, but says nothing about workload V. A single citation at the end of a sentence cannot express "this source covers half of what I just asserted." Second, contradiction: two papers report different numbers for the same metric -- different software versions, different populations, different measurement methods. A flat bibliography treats both as equally valid support, so the contradiction stays invisible.',
        'Third, maintenance over time. Six months later, source S publishes updated numbers. With a flat bibliography, finding every claim that depended on S means re-reading the entire report and manually checking every sentence. At 50 sources and 200 claims, that re-read takes hours and will miss things. The wall is simple: unstructured citation does not scale with source count, claim count, or the lifetime of the document.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model evidence as a directed graph, not a list. Each claim is a node. Each source is a node. The edge between them carries a typed label chosen from a controlled vocabulary: support, contradict, define, date, scope, weaken, or supersede. Report sections are also nodes, connected to the claims they consume. A contradiction is its own node type, recording the reason two claims disagree: version change, method difference, population mismatch, metric mismatch, or incentive bias. By making every relationship typed and directional, the graph becomes queryable: "show me every claim supported only by vendor blogs," or "which sections break if source S4 is retracted?"',
        {type: 'image', src: 'https://www.w3.org/TR/prov-overview/prov-family.png', alt: 'W3C PROV family diagram with data model serializations and constraints', caption: 'The PROV family shows why provenance is a data model, not just a citation style: entities, constraints, serializations, and access rules stay separate. Source: W3C PROV-Overview, https://www.w3.org/TR/prov-overview/.'},
        'The source ledger is the concrete storage behind those edges. Each row holds seven fields: (1) claim text -- the single falsifiable statement, (2) source pointer -- URL, PDF page, database row, or commit hash, (3) support span -- the exact paragraph, table cell, or data range that constitutes the evidence, (4) source date and access date, (5) authority label -- primary research, official documentation, vendor blog, news report, or social post, (6) scope note -- what this source does and does not prove, (7) target report section. Field 3, the support span, is the one that kills citation bluffing. It forces you to point at the exact evidence, not gesture at the whole document.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The workflow has eight stages that run in order, with one feedback loop. Stage 1, Search: issue queries and collect candidate sources. Nothing is trusted at this point; this is candidate generation only. Stage 2, Read: open each candidate and break it into atomic claims. An atomic claim is a single falsifiable statement -- "System X achieves 86.4% accuracy on benchmark B" rather than "System X performs well." Stage 3, Extract: for each atomic claim, record the exact support span, source pointer, and publication date in a new ledger row. Stage 4, Rank: assign an authority label to each source before any synthesis begins. A peer-reviewed paper outranks a vendor blog for performance claims; official documentation outranks a tutorial for API behavior.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes and arrows', caption: 'Directed edges are the useful mental model: support, contradiction, supersession, and section-dependency relationships all have direction. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Stage 5, Ledger: commit all extracted claims and their typed edges to persistent storage. Stage 6, Audit: walk the entire graph checking three conditions -- does every critical claim have at least one primary source? Is any supporting source older than the claim\'s relevance window? Are contradictions explicitly classified or just silently present? Stage 7, Outline: build the report structure using only claims that survived audit. Unsupported claims are dropped, not patched with weaker evidence. Stage 8, Write: draft prose from the surviving graph, turning contradictions into explicit discussion rather than burying them. The audit stage feeds back to search: every gap found during audit triggers a new search round, creating a closed loop.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The graph works because it decouples evidence quality from writing fluency. A skilled writer -- or a language model -- can produce confident, well-structured prose from memory or pattern-matching alone. The claim graph breaks that shortcut by requiring every sentence to pass through a support check before it reaches the final draft. The failure mode shifts from "the answer sounded right" to a specific, actionable diagnosis: "claim C17 has no primary source," or "claim C21 is supported only for the 2023 benchmark, not the current release." That is a mechanical guarantee, not a stylistic preference.',
        'The graph also makes research state reusable across time. When source S publishes an update, the graph identifies every claim and every report section that depends on S -- no manual re-reading required. When a new source contradicts claim C, the graph traces the affected conclusions. When a reviewer challenges a single sentence, the ledger either produces the exact supporting span or flags the claim for removal. This is the same principle behind dependency graphs in build systems and provenance tracking in data pipelines: outputs carry an auditable path back to the inputs that produced them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building a claim graph is slower than writing from notes, and the overhead is front-loaded. For a report consuming S sources, with each source yielding roughly k atomic claims, extraction costs O(S * k) human or agent attention-minutes. Each claim must be read, decomposed, span-located, dated, and authority-labeled. Audit then walks every claim node and every edge once: O(C + E) where C is total claims and E is total edges. For a typical 50-source report producing 200 claims and 300 edges, that audit pass is fast; the extraction phase dominates.',
        'Storage is not the bottleneck. A ledger with 200 claims and 50 sources occupies a few hundred kilobytes of structured data -- a JSON file or a small SQLite table. The real cost is the human or agent attention during extraction: reading each source carefully enough to identify exact spans rather than skimming for gist. For a 10-source blog post, this overhead is not worth it. For a 100-source policy analysis that will be maintained for two years, the graph pays for itself during the first update cycle, when you can trace exactly which claims need re-verification instead of re-reading everything.',
        'There is also a confidentiality cost. The ledger may store excerpts from licensed publications, internal documents, or private data. A production system needs access control on individual ledger rows, redaction rules for sensitive spans before any export, and a hard boundary between evidence content (which informs claims) and system instructions (which must never be treated as trusted evidence).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Deep research agents use the claim graph as the gate between retrieval and answer generation. Embedding-based search can find semantically nearby text, but the claim ledger decides which retrieved passages actually have the authority and span-level precision to support the final answer. Without this gate, an agent can hallucinate a claim, then find a vaguely similar passage and "cite" it -- producing a footnote that looks real but proves nothing. The ledger blocks that path by requiring span-level match before the claim enters the draft.',
        'Policy analysis and legal research impose the same requirement from the opposite direction: regulators and courts demand traceable evidence chains. A policy memo claiming "intervention X reduced outcome Y by 30%" must connect to the specific study, the specific population, the specific time period, and the confidence interval -- not just a document title. The claim graph stores all of that context on the edge itself. Technical due diligence reports, systematic literature reviews, incident postmortems, and benchmark comparison papers all share this structure: claims must trace to evidence, and evidence must carry enough metadata to evaluate its weight.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph fails when claims are not decomposed into atomic statements. "Product X is better than Product Y" cannot be supported or contradicted because it collapses workload, metric, version, cost, and deployment context into a single vague assertion. The fix is mechanical: decompose into "Product X processes 10,000 queries per second on workload W at p99 latency 12ms on hardware H." That statement is atomic, falsifiable, and can carry a precise support edge. If the writer or agent refuses to decompose, the graph degrades into a decorated bibliography -- nodes exist, but the edges carry no real information.',
        'The graph also fails when edge labels are too coarse. If every edge just means "source mentions this topic," you lose the distinction between a source that defines a term, one that reports an experimental measurement, one that repeats a claim from somewhere else, and one that directly contradicts a finding. Those are four different relationships, and collapsing them into one label destroys the audit capability. Finally, the structure can launder low-quality evidence into confident prose if authority labels are ignored during synthesis. A claim supported only by an anonymous forum post can survive to the final draft if the writer treats it the same as a peer-reviewed result. The graph is a tool, not a guarantee -- it is only useful when the writer or agent actually obeys the constraints it encodes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the research question is: "Do long-context language models remove the need for retrieval-augmented generation (RAG)?" A shallow answer picks a side. A claim graph decomposes. Claim C1: "Models with 128K+ token context windows can process entire document corpora without retrieval infrastructure." Ledger row: source = official model documentation (dated 2024-03-04), span = "200K token context window," authority = official docs, edge label = support. Claim C2: "Evidence placed in the middle of long contexts is recalled less accurately than evidence at the start or end." Ledger row: source = Liu et al., "Lost in the Middle" (2023), span = section 4.1 results table, authority = peer-reviewed, edge label = support.',
        'Claim C3: "Retrieval reduces inference cost by sending only relevant chunks instead of full documents." Ledger row: source = API pricing page (dated 2024-01-15), span = per-token pricing table, authority = official docs, edge label = support. Claim C4: "Retrieval pipelines can introduce ranking errors that send irrelevant or misleading chunks to the model." Ledger row: source = Barnett et al., "Seven Failure Points of RAG" (2024), span = section 3, authority = preprint, edge label = support. Now the graph reveals a contradiction node between C1 and C2: C1 says long context is sufficient, C2 says accuracy degrades within that same context window. The contradiction type is scope mismatch -- C1 addresses capacity, C2 addresses accuracy within that capacity.',
        'Audit pass: C1 has strong support (official docs, current). C2 has strong support (peer-reviewed, replicated). C3 has moderate support (pricing page may change without notice). C4 has moderate support (preprint, not yet peer-reviewed). The auditor flags C3 for staleness risk and C4 for authority upgrade once peer review completes. Final synthesized answer: long context eliminates retrieval plumbing for small corpora but does not eliminate accuracy risks in the middle of that context, and cost comparisons depend on pricing that may shift. Every clause in that sentence traces to a specific ledger row. If any source is updated, the graph shows exactly which claims and which sections of the final report need re-evaluation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the STORM research system (Stanford, https://storm-project.stanford.edu/research/storm/) and its paper (Shao et al., 2024, https://arxiv.org/abs/2402.14207) demonstrate automated claim-graph construction for Wikipedia-style articles. WebGPT (Nakano et al., 2021, https://arxiv.org/abs/2112.09332) introduced web-browsing agents that attribute generated text to retrieved sources. The W3C PROV data model (https://www.w3.org/TR/prov-overview/) formalizes provenance as entities, activities, and agents connected by typed relationships -- the closest existing standard to what the claim graph encodes.',
        'For next topics: study Deep Research Agent Architecture to see how claim graphs fit into end-to-end agent pipelines. Study RAG Citation Span Index for the retrieval-side mechanics of locating exact supporting spans within retrieved documents. Study GraphRAG Community Summary for graph-based synthesis that operates at corpus scale rather than single-document scale. Study Prompt Injection Threat Model for why the boundary between evidence and instructions matters for security. Study Distributed Tracing for the analogous engineering pattern: tracing system outputs back through intermediate services to the original inputs.',
      ],
    },
  ],
};
