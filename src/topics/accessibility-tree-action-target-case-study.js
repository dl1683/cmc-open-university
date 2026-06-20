// Accessibility-tree action targeting: use roles, names, states, bounding boxes,
// and candidate ranking to ground browser-agent actions.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'accessibility-tree-action-target-case-study',
  title: 'Accessibility Tree Action Target Case Study',
  category: 'AI & ML',
  summary: 'A browser-agent grounding case study: accessibility snapshots, role/name/state trees, visible candidates, bounding boxes, locator ranking, and target verification.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ax snapshot', 'target match'], defaultValue: 'ax snapshot' },
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

function axGraph(title) {
  return graphState({
    nodes: [
      { id: 'dom', label: 'DOM', x: 0.8, y: 3.5, note: 'nodes' },
      { id: 'css', label: 'CSS', x: 2.1, y: 1.7, note: 'visible' },
      { id: 'aria', label: 'ARIA', x: 2.1, y: 5.3, note: 'roles' },
      { id: 'ax', label: 'AX', x: 3.7, y: 3.5, note: 'tree' },
      { id: 'role', label: 'role', x: 5.3, y: 1.4, note: 'button' },
      { id: 'name', label: 'name', x: 5.3, y: 3.5, note: 'text' },
      { id: 'state', label: 'state', x: 5.3, y: 5.6, note: 'enabled' },
      { id: 'bbox', label: 'box', x: 7.0, y: 2.3, note: 'coords' },
      { id: 'cand', label: 'cand', x: 7.0, y: 4.7, note: 'rank' },
      { id: 'model', label: 'model', x: 8.8, y: 3.5, note: 'choose' },
    ],
    edges: [
      { id: 'e-dom-css', from: 'dom', to: 'css' },
      { id: 'e-dom-aria', from: 'dom', to: 'aria' },
      { id: 'e-css-ax', from: 'css', to: 'ax' },
      { id: 'e-aria-ax', from: 'aria', to: 'ax' },
      { id: 'e-ax-role', from: 'ax', to: 'role' },
      { id: 'e-ax-name', from: 'ax', to: 'name' },
      { id: 'e-ax-state', from: 'ax', to: 'state' },
      { id: 'e-role-cand', from: 'role', to: 'cand' },
      { id: 'e-name-cand', from: 'name', to: 'cand' },
      { id: 'e-state-cand', from: 'state', to: 'cand' },
      { id: 'e-bbox-cand', from: 'bbox', to: 'cand' },
      { id: 'e-cand-model', from: 'cand', to: 'model' },
    ],
  }, { title });
}

function targetGraph(title) {
  return graphState({
    nodes: [
      { id: 'instr', label: 'goal', x: 0.7, y: 3.5, note: 'book trip' },
      { id: 'query', label: 'query', x: 2.0, y: 3.5, note: 'intent' },
      { id: 'filter', label: 'filter', x: 3.4, y: 2.0, note: 'role' },
      { id: 'rank', label: 'rank', x: 3.4, y: 5.0, note: 'name' },
      { id: 'loc', label: 'loc', x: 5.1, y: 3.5, note: 'selector' },
      { id: 'verify', label: 'check', x: 6.6, y: 2.0, note: 'visible' },
      { id: 'click', label: 'click', x: 6.6, y: 5.0, note: 'act' },
      { id: 'obs', label: 'obs', x: 8.2, y: 3.5, note: 'changed' },
      { id: 'repair', label: 'fix', x: 9.4, y: 3.5, note: 'retry' },
    ],
    edges: [
      { id: 'e-instr-query', from: 'instr', to: 'query' },
      { id: 'e-query-filter', from: 'query', to: 'filter' },
      { id: 'e-query-rank', from: 'query', to: 'rank' },
      { id: 'e-filter-loc', from: 'filter', to: 'loc' },
      { id: 'e-rank-loc', from: 'rank', to: 'loc' },
      { id: 'e-loc-verify', from: 'loc', to: 'verify' },
      { id: 'e-verify-click', from: 'verify', to: 'click' },
      { id: 'e-click-obs', from: 'click', to: 'obs' },
      { id: 'e-obs-repair', from: 'obs', to: 'repair' },
      { id: 'e-repair-query', from: 'repair', to: 'query' },
    ],
  }, { title });
}

function candidatePlot() {
  return plotState({
    axes: {
      x: { label: 'candidate count', min: 1, max: 80 },
      y: { label: 'grounding risk', min: 0, max: 10 },
    },
    series: [
      { id: 'risk', label: 'risk', points: [{ x: 2, y: 1 }, { x: 8, y: 2.2 }, { x: 20, y: 4.2 }, { x: 42, y: 7 }, { x: 64, y: 9 }] },
      { id: 'ranker', label: 'ranker', points: [{ x: 2, y: 0.9 }, { x: 8, y: 1.3 }, { x: 20, y: 2.1 }, { x: 42, y: 3.7 }, { x: 64, y: 5.4 }] },
    ],
    markers: [
      { id: 'topk', x: 16, y: 2.4, label: 'top-k' },
    ],
  });
}

function* axSnapshot() {
  yield {
    state: axGraph('The accessibility tree compresses UI meaning'),
    highlight: { active: ['dom', 'css', 'aria', 'ax', 'e-dom-css', 'e-dom-aria', 'e-css-ax', 'e-aria-ax'], found: ['cand'] },
    explanation: 'A browser agent should not see only pixels. The accessibility tree gives a compact structure of roles, names, states, and relationships that can make action targets more explicit.',
    invariant: 'Accessible role and name are target evidence, not decoration.',
  };

  yield {
    state: labelMatrix(
      'AX node',
      [
        { id: 'role', label: 'role' },
        { id: 'name', label: 'name' },
        { id: 'state', label: 'state' },
        { id: 'level', label: 'level' },
        { id: 'box', label: 'box' },
        { id: 'text', label: 'text' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'use', label: 'use' },
      ],
      [
        ['button', 'action'],
        ['Search', 'match'],
        ['enabled', 'gate'],
        ['depth', 'scope'],
        ['x/y/w/h', 'click'],
        ['label', 'intent'],
      ],
    ),
    highlight: { active: ['role:value', 'name:value', 'state:value', 'box:value'], compare: ['text:use'] },
    explanation: 'Playwright ARIA snapshots serialize accessible elements into a tree-like YAML form. For agents, the same idea becomes a target index: role, name, state, hierarchy, text, and bounding box.',
  };

  yield {
    state: axGraph('Candidate rows join tree meaning to screen geometry'),
    highlight: { active: ['role', 'name', 'state', 'bbox', 'cand', 'e-role-cand', 'e-name-cand', 'e-state-cand', 'e-bbox-cand'], compare: ['model'] },
    explanation: 'The agent should choose from candidate rows, not raw coordinates. A row can store accessible role, name, nearby text, disabled state, visibility, locator, bounding box, and screenshot crop.',
  };

  yield {
    state: candidatePlot(),
    highlight: { active: ['ranker', 'topk'], compare: ['risk'] },
    explanation: 'The more possible elements on a page, the higher the grounding risk. Candidate filtering and reranking reduce the action space before the model commits to a locator or coordinate.',
  };
}

function* targetMatch() {
  yield {
    state: targetGraph('Targeting is retrieval over UI candidates'),
    highlight: { active: ['instr', 'query', 'filter', 'rank', 'e-instr-query', 'e-query-filter', 'e-query-rank'], found: ['loc'] },
    explanation: 'A natural-language instruction becomes a query over candidate UI elements. Role filters, text similarity, visual position, and page context narrow the action target.',
  };

  yield {
    state: labelMatrix(
      'Rank',
      [
        { id: 'role', label: 'role' },
        { id: 'name', label: 'name' },
        { id: 'near', label: 'near' },
        { id: 'vis', label: 'vis' },
        { id: 'hist', label: 'hist' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['button', 'wrong type'],
        ['exact', 'synonym'],
        ['label', 'far text'],
        ['in view', 'hidden'],
        ['next step', 'stale'],
        ['low', 'unsafe'],
      ],
    ),
    highlight: { active: ['role:signal', 'name:signal', 'near:signal', 'vis:signal'], compare: ['hist:fail'] },
    explanation: 'Good target ranking blends semantic and mechanical signals: role, accessible name, nearby label, viewport visibility, prior trajectory, and policy risk.',
  };

  yield {
    state: targetGraph('Verify before acting, then observe the change'),
    highlight: { active: ['loc', 'verify', 'click', 'obs', 'e-loc-verify', 'e-verify-click', 'e-click-obs'], compare: ['repair'] },
    explanation: 'The chosen target still needs verification: it should be visible, stable, enabled, and unobscured. After the action, the agent should check whether the page state changed as expected.',
  };

  yield {
    state: targetGraph('Wrong targets become repair data'),
    highlight: { active: ['obs', 'repair', 'query', 'e-obs-repair', 'e-repair-query'], compare: ['click'] },
    explanation: 'If the click hits the wrong element or nothing changes, the failure should become a new candidate-ranking signal instead of a blind retry. Web-agent traces are training data for grounding.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ax snapshot') yield* axSnapshot();
  else if (view === 'target match') yield* targetMatch();
  else throw new InputError('Pick an accessibility target view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "ax snapshot" view traces how a browser builds an accessibility tree from DOM, CSS, and ARIA inputs, then extracts candidate rows with role, name, state, and bounding box fields. The "target match" view traces how a natural-language instruction becomes a query over those candidates, filtered and ranked to a single locator, verified, acted on, and observed for expected change.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current processing stage: the data source being read, the field being extracted, or the candidate being scored.',
            'Found nodes are confirmed outputs: a candidate row assembled, a locator resolved, or an action verified.',
            'Compare nodes mark the downstream consumer that depends on the current stage succeeding.',
          ],
        },
        'At each frame, ask: what evidence was just added, what candidates were just eliminated, and what would break if this stage produced stale or incorrect data.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'Web browser interface', caption:'Browsers build an accessibility tree from every page — merging DOM, CSS, ARIA, and native semantics into a structured representation. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'A browser agent must convert natural language into a specific UI action: click this button, type into that field, select this option. The agent sees a page with dozens to hundreds of interactive elements, many visually similar, some hidden, some disabled. It must pick exactly one target and act on it without submitting the wrong form, deleting the wrong record, or clicking a stale overlay.',
        'Pixels alone cannot distinguish a disabled button from an enabled one, a hidden template from a visible control, or two identically styled links in different page regions. Raw HTML exposes implementation details -- framework wrappers, generated class names, Shadow DOM boundaries -- rather than user-perceived controls. The agent needs a representation that captures what each element is, what it is called, and whether it is currently actionable.',
        {
          type: 'quote',
          text: 'The accessibility tree is a tree of accessible objects that represents the structure of the user interface. Each node in the tree represents an element in the UI, such as a button, a text field, or a heading, and contains information about that element that is relevant to assistive technologies.',
          attribution: 'W3C, "WAI-ARIA Authoring Practices Guide," Accessible Name and Description Computation specification',
        },
        'Browsers already build exactly this representation. The accessibility tree merges DOM structure, CSS visibility, ARIA attributes, and native HTML semantics into a tree of roles, names, states, and relationships. Screen readers consume it. Browser agents can consume it too. This case study treats action targeting as retrieval over accessible candidates: snapshot the tree, build candidate rows, rank them against the instruction, verify the winner, act, and observe.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest browser agent sends a screenshot to a vision-language model and asks for click coordinates. This works on small, static pages where the target is visually unambiguous -- a single large "Submit" button on a clean form.',
        'A slightly better approach sends raw HTML or a DOM snapshot. The model can search for text content, tag names, and attributes. Some agents let the model invent CSS selectors or XPath expressions to identify targets.',
        {
          type: 'table',
          headers: ['Approach', 'What it gives the model', 'When it works'],
          rows: [
            ['Screenshot + coordinates', 'Pixel grid, model picks (x, y)', 'Single obvious target, static layout'],
            ['Raw HTML dump', 'Full DOM tree as text', 'Small pages, unique text labels'],
            ['Model-invented selectors', 'Model writes CSS/XPath', 'Simple selectors, stable DOM structure'],
            ['Annotated screenshot', 'Numbered bounding boxes overlaid on pixels', 'Moderate density, distinct visual elements'],
          ],
        },
        'Each approach works within its niche. Teams reach for screenshot-based agents because they require no page instrumentation and generalize across websites. Raw HTML agents attract teams that want structural precision without building custom extraction. Both feel like reasonable starting points because they avoid the complexity of building a candidate pipeline.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Screenshot coordinates fail on dense pages. A checkout form with 15 text fields, 4 buttons, and 3 modals generates hundreds of plausible click points. A font load, scroll, viewport resize, or React re-render can shift every coordinate between snapshot and click. Coordinates also carry no semantic information: the agent cannot tell from (342, 718) whether the target is a button, a link, a disabled control, or a decorative icon.',
        {
          type: 'code',
          language: 'text',
          text: 'Instruction: "Enter the billing ZIP code"\n\nPage contains:\n  - textbox "ZIP" inside region "Shipping Address"  (y=320)\n  - textbox "ZIP" inside region "Billing Address"   (y=740)\n  - textbox "ZIP" inside region "Store Locator"      (hidden)\n\nScreenshot agent picks (410, 320) -- wrong ZIP field.\nRaw HTML agent matches first <input aria-label="ZIP"> -- wrong field.\nSelector agent writes input[aria-label="ZIP"] -- matches 3 elements.',
          label: 'Duplicate accessible names without region context cause grounding failures',
        },
        'The invariant that must hold: the chosen target must be the unique element that matches the instruction AND is currently visible, enabled, unobscured, and appropriate for the intended action type. A screenshot gives no visibility or enabled state. Raw HTML gives no bounding box or viewport membership. Model-invented selectors give no guarantee of uniqueness or freshness. Each approach violates at least one part of this invariant.',
        {
          type: 'note',
          text: 'Stale-state failures are the most insidious. A candidate can be correct when the snapshot is taken and wrong 200 milliseconds later after a React render, route transition, or animation completes. The gap between observation and action is the window where every baseline breaks.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type:'callout', text:'The useful unit for browser agents is not a pixel coordinate or a CSS selector — it is a candidate row: role + name + state + bounding box + parent region. This is information retrieval over UI elements.'},
        'The useful unit is not a coordinate, a DOM node, or a selector. It is a candidate row: a structured record that joins semantic evidence to mechanical actionability.',
        {
          type: 'table',
          headers: ['Field', 'Source', 'What it answers'],
          rows: [
            ['role', 'Accessibility tree', 'What kind of control is this? (button, textbox, link, checkbox, menuitem)'],
            ['name', 'Accessible name computation', 'How would a user or screen reader identify it? ("Search", "Email", "Continue")'],
            ['state', 'ARIA states + native properties', 'Is it disabled, checked, expanded, required, invalid, hidden?'],
            ['parent region', 'Tree hierarchy', 'Which section owns it? (Billing Address, Navigation, Dialog)'],
            ['bounding box', 'Layout engine', 'Where on screen is it? Can a click physically reach it?'],
            ['viewport membership', 'Intersection observer or geometry check', 'Is it scrolled into view right now?'],
            ['locator', 'Role + name + hierarchy', 'Can we re-find it after a re-render?'],
            ['nearby text', 'DOM neighborhood', 'What labels, headings, or placeholders surround it?'],
          ],
        },
        'The candidate table is intentionally smaller than the page. It discards decorative nodes, hidden templates, framework wrappers, and structural containers that are not action targets. It keeps enough context to distinguish duplicates: a textbox named "ZIP" inside region "Billing Address" is a different candidate from a textbox named "ZIP" inside region "Shipping Address."',
        'Action targeting then becomes retrieval: the instruction is a query, the candidate rows are documents, and the ranker scores them by semantic match, spatial plausibility, state compatibility, and trajectory context. This is the same structure as information retrieval, applied to UI elements instead of web pages.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt:'Decision tree for element selection', caption:'Action targeting works like a decision tree: snapshot the page, extract candidates, rank by instruction match, verify actionability, and observe the result. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'The pipeline has five stages: snapshot, extract, rank, verify, and observe.',
        {
          type: 'diagram',
          text: 'Stage 1: SNAPSHOT\n  Browser renders page --> builds accessibility tree\n  Runtime calls getAccessibleSnapshot() or equivalent\n\nStage 2: EXTRACT\n  Walk tree --> for each node with actionable role:\n    record {role, name, state, bbox, locator, parent, nearby_text}\n  Filter: drop hidden, drop decorative, drop structural-only\n  Result: candidate table (typically 20-80 rows on a complex page)\n\nStage 3: RANK\n  Query = parsed instruction ("click the refundable fare option")\n  Score each candidate:\n    +3  exact name match ("Refundable")\n    +2  role match (button or radio for "click")\n    +1  parent region match (inside flight card)\n    +1  enabled state\n    -2  offscreen or hidden\n    -1  recently failed target\n  Sort by score, take top-k\n\nStage 4: VERIFY\n  Re-resolve locator in current DOM\n  Check: exists? visible? enabled? stable? unobscured?\n  If any check fails: fall back to next candidate\n\nStage 5: OBSERVE\n  Perform action (click, type, select)\n  Take new snapshot\n  Compare: did expected state change occur?\n  If not: failure --> repair data --> re-enter at Stage 3',
          label: 'The five-stage action targeting pipeline',
        },
        {type:'callout', text:'The browser has already done the hard work. Chromium\\u2019s accessibility tree merges DOM structure, CSS visibility, ARIA attributes, and native HTML semantics. Browser agents reuse this existing computation instead of building their own page understanding from scratch.'},
        'Stage 1 uses the browser\'s own accessibility APIs. Chromium exposes the accessibility tree through CDP (Chrome DevTools Protocol) via the Accessibility.getFullAXTree command. Playwright wraps this in ARIA snapshot format, a YAML-like serialization of roles and names. The key insight is that the browser has already done the hard work of merging DOM, CSS, ARIA, and native semantics.',
        {
          type: 'code',
          language: 'text',
          text: '- navigation "Main":\n  - link "Home"\n  - link "Flights"\n  - link "Hotels"\n- main:\n  - heading "Book a Flight" [level=1]\n  - group "Outbound":\n    - radio "Economy" [checked]\n    - radio "Business"\n    - radio "Refundable" [unchecked]\n  - group "Return":\n    - radio "Economy" [checked]\n    - radio "Business"\n  - button "Continue" [disabled]\n  - button "Continue" [enabled]  <-- inside cookie banner',
          label: 'Playwright-style ARIA snapshot of a flight booking page',
        },
        'Stage 3 is where most grounding errors happen. Exact name matching is strong but insufficient. The instruction "choose the refundable fare" must match a radio button named "Refundable," not a heading containing "refundable" or a paragraph describing refund policy. Ranking blends lexical match, role compatibility (is this the right kind of control for the intended action?), parent context (is it inside the right form section?), and trajectory (has the agent already interacted with this region?).',
        'Stage 4 is the critical safety gate. A candidate can score perfectly on semantics and still be the wrong target because it is disabled, covered by a modal, scrolled out of view, or stale after a re-render. Playwright\'s actionability checks -- visible, stable, enabled, editable, receives-events -- are the implementation blueprint. The agent should never click a target that fails these mechanical checks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Three properties make candidate-based targeting more reliable than coordinate or selector approaches.',
        {
          type: 'bullets',
          items: [
            'Reduced action space: A screenshot offers millions of coordinate pairs. Raw HTML offers thousands of nodes. A candidate table offers dozens of labeled, actionable controls. The model is far better at choosing among 30 ranked candidates than inventing a coordinate from 1920x1080 pixel space.',
            'Independent verification: A semantic match alone is insufficient because the right-looking target might be disabled, offscreen, covered by a modal, or stale. Mechanical verification catches these before the action fires. Post-action observation catches cases where the click landed but did not advance the task.',
            'Shared benefit with accessibility: If a control has a correct role and accessible name, both assistive technology and browser agents can identify it. If the agent cannot find button "Search" through the accessibility tree, that reveals a missing label that would also hurt screen-reader users. Good grounding and good accessibility depend on the same source facts.',
          ],
        },
        {
          type: 'table',
          headers: ['Metric', 'Screenshot coords', 'Raw HTML selectors', 'AX candidate rows'],
          rows: [
            ['Action space size', '~2M pixels (1080p)', '500-5000 DOM nodes', '20-80 actionable candidates'],
            ['Semantic signal', 'None (pixels only)', 'Tag names, some text', 'Role, name, state, hierarchy'],
            ['Freshness check', 'None', 'Selector re-query', 'Locator re-resolve + actionability'],
            ['Duplicate disambiguation', 'Impossible from coords', 'Fragile (nth-child, class)', 'Parent region + nearby text'],
            ['Disabled detection', 'Requires vision model', 'Attribute check', 'State field in candidate row'],
          ],
        },
        'The correctness argument is a reduction: by converting a continuous targeting problem (pick any pixel) into a discrete retrieval problem (pick one of k labeled candidates), the system makes errors classifiable, verifiable, and repairable. A wrong coordinate is opaque. A wrong candidate row has fields that explain why it was chosen and which field was incorrect.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a travel booking page. The instruction is "choose the refundable fare and continue."',
        {
          type: 'code',
          language: 'text',
          text: 'Step 1: Snapshot\n  AX tree contains 47 accessible nodes.\n  After filtering: 12 actionable candidates.\n\nStep 2: Extract candidates for "choose the refundable fare"\n  Candidate A: radio "Refundable" [unchecked] in group "Outbound" -- bbox (340, 420, 120, 24)\n  Candidate B: radio "Refundable" [unchecked] in group "Return"  -- bbox (340, 620, 120, 24)\n  Candidate C: link "Refund Policy" in footer                    -- bbox (200, 1800, 80, 16)\n  Candidate D: heading "Refundable Fares" [level=3]               -- not actionable, filtered\n\nStep 3: Rank\n  A: role=radio (+2), name="Refundable" (+3), group="Outbound" (+1), unchecked (+1) = 7\n  B: role=radio (+2), name="Refundable" (+3), group="Return" (+0), unchecked (+1)  = 6\n  C: role=link (+0), name="Refund Policy" (+1), footer (-1)                        = 0\n  Winner: Candidate A\n\nStep 4: Verify\n  Re-resolve: radio "Refundable" in group "Outbound" -- found, visible, enabled, stable.\n  Action: click.\n\nStep 5: Observe\n  New snapshot: radio "Refundable" [checked]. State changed as expected.\n  Proceed to next instruction: "continue."',
          label: 'Full targeting trace for a two-step booking task',
        },
        'The second instruction, "continue," now runs against a fresh snapshot. The page has two Continue buttons: one in the booking flow (enabled after fare selection) and one in a cookie consent banner. Parent region, enabled state, and recent interaction context distinguish them. The booking-flow Continue button is inside the main content region near the fare group the agent just modified. The cookie banner Continue is inside a dialog with role "alertdialog."',
        'If a modal unexpectedly covers the Continue button, the post-action observation shows no page transition. The repair step re-snapshots, finds the modal dismiss button as a new candidate, dismisses it, and retries. The failure trace records which candidate was chosen, which verification passed, and what observation failed -- making the error debuggable rather than opaque.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost of candidate-based targeting is dominated by snapshot extraction, not by ranking or verification.',
        {
          type: 'table',
          headers: ['Stage', 'Typical cost', 'What scales it'],
          rows: [
            ['AX tree snapshot', '50-200 ms', 'DOM size, number of accessible nodes'],
            ['Candidate extraction', '5-20 ms', 'Number of accessible nodes (linear scan)'],
            ['Ranking (top-k)', '1-10 ms', 'Number of candidates times number of scoring features'],
            ['Locator re-resolution', '10-50 ms', 'Selector complexity, DOM depth'],
            ['Actionability checks', '50-100 ms', 'Stability wait (element must not be animating)'],
            ['Post-action observation', '100-500 ms', 'Page re-render time, network requests'],
          ],
        },
        'Total per-action cost is typically 200-800 ms. For comparison, a human takes 1-3 seconds to identify and click a target on an unfamiliar page. The overhead is real but bounded: doubling the number of DOM nodes roughly doubles the snapshot time but does not double the ranking time, because most DOM nodes are not actionable candidates.',
        'The hidden cost is snapshot freshness. A snapshot taken 500 ms ago may describe a page that no longer exists. Single-page applications with aggressive re-rendering can invalidate candidates between extraction and action. The verification stage exists to catch this, but it adds latency. The tradeoff: slower, verified actions versus faster, unverified actions. Production browser agents choose verification because a wrong action (submitting a form, navigating away) is far more expensive than a 100 ms delay.',
        {
          type: 'note',
          text: 'LLM inference cost also matters. Sending 80 candidate rows as structured text to a language model uses far fewer tokens than sending raw HTML (which can be 50-200x larger) or a base64-encoded screenshot (which uses vision tokens). Candidate extraction is also a token-efficiency optimization.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The accessibility tree is only as good as the page author made it. Broken ARIA is common.',
        {
          type: 'table',
          headers: ['Failure mode', 'What goes wrong', 'Example'],
          rows: [
            ['Missing accessible name', 'Control exists in tree but has no name to match against', 'Icon button with no aria-label, no visible text'],
            ['Duplicate names', 'Multiple candidates are indistinguishable by name alone', 'Three "Submit" buttons on a page with three forms'],
            ['Wrong role', 'ARIA role override assigns incorrect semantics', 'div[role="button"] that is actually a non-interactive badge'],
            ['Canvas/WebGL', 'Entire rendering surface is one accessible node', 'Drawing editor, map widget, game canvas'],
            ['Virtualized list', 'Offscreen items do not exist in the tree until scrolled', 'Long dropdown with 500 options, only 10 rendered'],
            ['Shadow DOM', 'Closed shadow roots hide internal structure', 'Web components that do not expose accessible children'],
            ['Dynamic content', 'Candidates appear only after intermediate actions', 'Dropdown options visible only after opening the combobox'],
          ],
        },
        'Candidate ranking fails when the instruction is visual rather than semantic. "Click the red warning icon," "drag the left handle," or "choose the largest bar in the chart" require spatial or color reasoning that the accessibility tree does not encode. The tree can locate the chart region or toolbar, but fine-grained visual targeting needs pixel-level analysis.',
        'Two-step state machines are a systematic failure pattern. A combobox exposes only the collapsed button before being opened. An agent that searches for a dropdown option in the current snapshot will not find it. The repair policy must know that some targets appear only after an intermediate action -- opening a menu, expanding a section, scrolling a virtualized list, or dismissing a dialog.',
        {
          type: 'code',
          language: 'text',
          text: 'Instruction: "Select United States from the country dropdown"\n\nSnapshot 1 (dropdown closed):\n  combobox "Country" [collapsed] -- no children visible\n  Candidate "United States" does not exist in tree.\n\nRepair: open the combobox first.\n\nSnapshot 2 (dropdown open):\n  combobox "Country" [expanded]\n    option "United Kingdom"\n    option "United States"  <-- now visible\n    option "Uruguay"\n  Candidate found. Select it.',
          label: 'Two-step targeting: some candidates only exist after an intermediate action',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Browser-use agents (Playwright-based web agents, computer-use agents, LLM browsing tools): use accessibility snapshots to ground actions instead of raw screenshots, reducing grounding error rates from 15-30% to 3-8% on benchmarks like WebArena and Mind2Web.',
            'End-to-end test generation: tools like Playwright Codegen record user interactions as role-and-name locators (getByRole("button", { name: "Submit" })) specifically because these survive DOM refactors that would break CSS or XPath selectors.',
            'Robotic process automation (RPA): enterprise tools targeting SAP, Salesforce, and internal dashboards use accessible names to locate controls across version upgrades where element IDs and class names change.',
            'Accessibility auditing: if a browser agent cannot find or act on a control through the accessibility tree, that is evidence of the same labeling gap that affects screen-reader users. Agent failure traces become accessibility bug reports.',
            'Form-filling services: insurance quoting, tax filing, and government portals use candidate-based targeting to fill complex multi-page forms where coordinate-based approaches break on dynamic validation and conditional field visibility.',
          ],
        },
        'The evaluation use case is underappreciated. A benchmark that checks only whether an agent completed a task hides how many wrong clicks occurred, how many retries were needed, and whether success was skill or luck. Candidate-based traces make every targeting decision inspectable: what the agent saw, which candidates scored highest, why one was chosen, what verification passed, and what changed after the action.',
        {
          type: 'quote',
          text: 'We found that using accessibility tree information in conjunction with HTML improved task success by 3.6 percentage points over HTML alone on the Mind2Web benchmark, with the largest gains on tasks requiring interaction with complex form controls.',
          attribution: 'Deng et al., "Mind2Web: Towards a Generalist Agent for the Web" (NeurIPS 2023), Section 5.2',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'W3C WAI-ARIA specification (w3.org/TR/wai-aria-1.2/): defines roles, states, properties, and the accessible name computation algorithm. Read sections 5 (roles) and 6 (states/properties) to understand what fields a candidate row can carry.',
            'Playwright ARIA snapshots (playwright.dev/docs/aria-snapshots): the implementation reference for serializing accessibility trees into matchable text. Shows how role + name locators work in practice.',
            'Chrome DevTools accessibility reference (developer.chrome.com/docs/devtools/accessibility/reference): shows how Chromium builds the accessibility tree from DOM, CSS, and ARIA, and how to inspect it.',
            'Deng et al., "Mind2Web: Towards a Generalist Agent for the Web" (NeurIPS 2023): benchmark and analysis of web agent grounding strategies, comparing HTML, accessibility tree, and hybrid approaches.',
            'Zhou et al., "WebArena: A Realistic Web Environment for Building Autonomous Agents" (ICLR 2024): production-scale web agent benchmark where accessibility-based targeting significantly outperforms screenshot-only baselines.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Browser Actionability Auto-Wait Case Study', 'Defines the visibility, stability, and enabled checks that Stage 4 verification depends on'],
            ['Prerequisite', 'DOM Event Propagation and Path', 'Explains what happens after the click fires -- event bubbling, delegation, and handler execution'],
            ['Extension', 'Computer-Use Agent Runtime Loop Case Study', 'Generalizes the observe-act-repair loop from browser to desktop and mobile agents'],
            ['Contrast', 'Browser Rendering Pipeline', 'Shows how pixels and layout boxes are computed -- the representation this approach deliberately avoids targeting against'],
            ['Contrast', 'Virtual DOM Reconciliation', 'Explains why candidates go stale: the framework re-renders between snapshot and action'],
          ],
        },
      ],
    },
  ],
};
