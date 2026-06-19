// Trusted Types: turn DOM injection sinks into typed capability boundaries
// backed by CSP enforcement, policy registries, sanitizers, and rollout reports.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'trusted-types-dom-xss-sink-case-study',
  title: 'Trusted Types DOM XSS Sink Guard',
  category: 'Security',
  summary: 'How Trusted Types, CSP enforcement, named policies, sanitizers, DOM XSS sinks, report-only rollout, and legacy adapters fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sink guard', 'policy rollout'], defaultValue: 'sink guard' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function ttGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'input', label: 'raw', x: 0.5, y: 4.2, note: notes.input ?? 'HTML string' },
      { id: 'sink', label: 'sink', x: 2.5, y: 4.2, note: notes.sink ?? 'innerHTML' },
      { id: 'csp', label: 'CSP', x: 4.1, y: 5.5, note: notes.csp ?? 'require TT' },
      { id: 'registry', label: 'registry', x: 4.1, y: 2.9, note: notes.registry ?? 'names' },
      { id: 'policy', label: 'policy', x: 6.1, y: 2.9, note: notes.policy ?? 'factory' },
      { id: 'sanitize', label: 'sanitize', x: 8.0, y: 2.9, note: notes.sanitize ?? 'clean' },
      { id: 'trusted', label: 'THTML', x: 8.0, y: 5.5, note: notes.trusted ?? 'HTML' },
      { id: 'dom', label: 'DOM', x: 9.5, y: 4.2, note: notes.dom ?? 'render' },
    ],
    edges: [
      { id: 'e-input-sink', from: 'input', to: 'sink', weight: '' },
      { id: 'e-sink-csp', from: 'sink', to: 'csp', weight: '' },
      { id: 'e-reg-policy', from: 'registry', to: 'policy', weight: '' },
      { id: 'e-policy-sanitize', from: 'policy', to: 'sanitize', weight: '' },
      { id: 'e-sanitize-trusted', from: 'sanitize', to: 'trusted', weight: '' },
      { id: 'e-trusted-sink', from: 'trusted', to: 'sink', weight: '' },
      { id: 'e-sink-dom', from: 'sink', to: 'dom', weight: '' },
      { id: 'e-csp-registry', from: 'csp', to: 'registry', weight: '' },
    ],
  }, { title });
}

function* sinkGuard() {
  yield {
    state: ttGraph('Without enforcement, a string can flow into a dangerous sink', { input: 'comment', csp: 'off', dom: 'script?' }),
    highlight: { active: ['input', 'sink', 'dom', 'e-input-sink', 'e-sink-dom'], removed: ['csp'] },
    explanation: 'DOM XSS often happens when untrusted strings reach injection sinks such as innerHTML. Trusted Types changes the sink contract so raw strings are no longer accepted when enforcement is enabled.',
    invariant: 'The sink boundary is the key data structure: raw strings should not cross it.',
  };

  yield {
    state: ttGraph('CSP enforcement rejects raw strings at the sink', { csp: 'enforce', sink: 'guarded', dom: 'blocked' }),
    highlight: { active: ['sink', 'csp', 'e-sink-csp'], removed: ['e-input-sink', 'dom'] },
    explanation: 'With require-trusted-types-for enabled, the browser can throw instead of assigning a plain string to a protected DOM sink. That turns an audit finding into a runtime boundary.',
  };

  yield {
    state: ttGraph('Named policies are capability factories', { registry: 'allowlist', policy: 'safeHTML', sanitize: 'DOMPurify', trusted: 'TrustedHTML' }),
    highlight: { active: ['registry', 'policy', 'sanitize', 'trusted', 'e-reg-policy', 'e-policy-sanitize', 'e-sanitize-trusted'] },
    explanation: 'A policy is a named factory for trusted values. The application should keep policy names few, reviewed, and tied to real sanitization or escaping behavior.',
  };

  yield {
    state: labelMatrix(
      'Sink map',
      [
        { id: 'html', label: 'HTML' },
        { id: 'script', label: 'script' },
        { id: 'url', label: 'scriptURL' },
        { id: 'template', label: 'template' },
      ],
      [
        { id: 'type' },
        { id: 'risk' },
      ],
      [
        ['TrustedHTML', 'DOM XSS'],
        ['TrustedScript', 'eval path'],
        ['TrustedURL', 'loader'],
        ['TrustedHTML', 'markup'],
      ],
    ),
    highlight: { active: ['html:type', 'url:type'], compare: ['script:risk'] },
    explanation: 'Trusted Types is not one sanitizer. It is a typed contract around several dangerous sink families, with different trusted value classes for different target contexts.',
  };

  yield {
    state: ttGraph('A trusted value crosses the sink boundary intentionally', { input: 'markdown', policy: 'mdPolicy', sanitize: 'strip JS', trusted: 'TrustedHTML', dom: 'safe render' }),
    highlight: { active: ['input', 'registry', 'policy', 'sanitize', 'trusted', 'sink', 'dom', 'e-trusted-sink', 'e-sink-dom'], compare: ['csp'] },
    explanation: 'The final flow is explicit: raw content goes through a reviewed policy, the policy returns TrustedHTML, and the sink accepts that typed value. The review surface becomes smaller.',
  };
}

function* policyRollout() {
  yield {
    state: ttGraph('Start in report-only mode to discover sink traffic', { csp: 'report-only', registry: 'observe', dom: 'still works' }),
    highlight: { active: ['sink', 'csp', 'registry', 'e-sink-csp', 'e-csp-registry'], compare: ['dom'] },
    explanation: 'Legacy apps often have many hidden sink writes. Report-only CSP lets teams collect violations before enforcement so they can prioritize high-traffic paths.',
    invariant: 'A Trusted Types rollout is an inventory problem before it is an enforcement problem.',
  };

  yield {
    state: labelMatrix(
      'Rollout queue',
      [
        { id: 'render', label: 'render' },
        { id: 'cms', label: 'CMS' },
        { id: 'widget', label: 'widget' },
        { id: 'ads', label: 'ads' },
      ],
      [
        { id: 'fix' },
        { id: 'risk' },
      ],
      [
        ['escape', 'low'],
        ['sanitize', 'stored XSS'],
        ['adapter', 'vendor'],
        ['isolate', 'high'],
      ],
    ),
    highlight: { active: ['render:fix', 'cms:fix', 'widget:fix'], compare: ['ads:risk'] },
    explanation: 'The migration queue classifies each sink by owner, fix strategy, and risk. Some paths need escaping, some need sanitization, and some third-party code should move to a sandboxed frame.',
  };

  yield {
    state: ttGraph('Trusted policy names should be few and reviewed', { registry: '2 names', policy: 'cmsHTML', sanitize: 'allowlist' }),
    highlight: { active: ['registry', 'policy', 'sanitize', 'trusted', 'e-reg-policy', 'e-policy-sanitize'], compare: ['input'] },
    explanation: 'The trusted-types CSP directive can restrict which policy names may be created. That prevents arbitrary libraries from minting their own bypass policy after enforcement begins.',
  };

  yield {
    state: ttGraph('A default policy can hide debt if it is too broad', { registry: 'default', policy: 'catch all', sanitize: 'weak', dom: 'masked' }),
    highlight: { active: ['registry', 'policy', 'sanitize'], compare: ['sink', 'dom'], removed: ['csp'] },
    explanation: 'A default policy may help compatibility, but it can also turn a strict type boundary into a silent sanitizer call everywhere. Use it carefully and remove it as owners fix call sites.',
  };

  yield {
    state: ttGraph('The complete case study is a CMS preview surface', { input: 'article', policy: 'cmsHTML', sanitize: 'allow tags', trusted: 'TrustedHTML', dom: 'preview' }),
    highlight: { active: ['input', 'registry', 'policy', 'sanitize', 'trusted', 'sink', 'dom'], found: ['csp'] },
    explanation: 'A CMS preview app enables Trusted Types in report-only mode, fixes the markdown preview path with a reviewed policy, sandboxes ad previews, restricts policy names, and then enforces CSP.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sink guard') yield* sinkGuard();
  else if (view === 'policy rollout') yield* policyRollout();
  else throw new InputError('Pick a Trusted Types view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Trusted Types DOM XSS Sink Guard. How Trusted Types, CSP enforcement, named policies, sanitizers, DOM XSS sinks, report-only rollout, and legacy adapters fit together..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Trusted Types exists because DOM XSS often happens after the server has already returned a page. Modern JavaScript reads data from comments, CMS fields, markdown previews, search results, URL parameters, API responses, extensions, analytics snippets, and vendor widgets. If one of those strings is written into a dangerous DOM sink, the browser may parse it as markup or scriptable content.',
        'The underlying problem is type collapse. Safe markup, unsafe markup, user text, template output, and attacker-controlled fragments are all JavaScript strings unless the application creates a stronger boundary. A sink such as `innerHTML` cannot tell whether the value came from a reviewed sanitizer or from an untrusted comment field.',
        'Trusted Types gives the browser a boundary it can enforce. Under the right CSP directive, protected sinks reject plain strings and accept typed values such as `TrustedHTML`. Those values are created by named policies, so the risky conversion from raw text to DOM-capable content becomes visible and reviewable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The baseline defense is context-aware output handling. Escape text before inserting it into HTML. Sanitize HTML if the feature truly allows selected tags. Validate URLs before assigning them to loader or navigation sinks. Keep CSP nonces and hashes for script execution control. These practices still matter.',
        'The wall is coverage. Large frontends have old components, helper wrappers, feature flags, WYSIWYG editors, markdown renderers, test-only shortcuts, template libraries, third-party packages, and rare error paths. A security review can fix ninety-nine sink writes and still miss the one that takes attacker-controlled input.',
        'The other wall is drift. New engineers add features. Libraries change. A safe helper gets bypassed for a deadline. A grep misses a wrapper. Trusted Types changes the failure mode by putting the final check at the sink instead of relying only on code review and convention.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat dangerous DOM sinks as capability boundaries. A raw string should not have the capability to become executable or parseable DOM content. Only a reviewed policy should be able to mint the typed value that crosses the boundary.',
        'The invariant is simple: protected sinks should receive trusted values, not arbitrary strings. For HTML sinks, that usually means `TrustedHTML`. For script-related sinks, it may mean `TrustedScript` or `TrustedScriptURL`. The exact type depends on the sink family, but the principle is the same.',
        'A policy is not magic safety. It is a named factory. Its value is that it centralizes the risky transformation. Instead of auditing every assignment as a standalone decision, the team audits a small set of policy implementations and watches violation reports for code that still tries to bypass them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The sink-guard view separates the unsafe flow from the intended flow. The unsafe flow is raw input moving directly into a sink. With enforcement disabled, the browser accepts it. With enforcement enabled, the CSP gate stops it before the sink can parse it as DOM.',
        'The intended flow takes a longer path on purpose. Raw input goes to a named policy. The policy applies the right transformation for the target context, such as HTML sanitization, template escaping, or URL allowlist validation. The policy returns a trusted value, and only that value crosses into the sink.',
        'The policy-rollout view shows why adoption is an inventory problem first. Report-only mode does not make the page safe by itself. It reveals where raw strings are still reaching protected sinks, which teams own those paths, and which fixes should be policy calls, safer rendering APIs, sandboxed iframes, or removed code.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'A site enables Trusted Types through Content Security Policy. `require-trusted-types-for` tells the browser to require trusted values for protected DOM XSS sink functions. In report-only mode, violations are reported while the page continues. In enforcement mode, the browser blocks the raw-string assignment.',
        'Application code creates policies through the Trusted Types API. A policy has a name and factory functions such as `createHTML`. A good `createHTML` implementation does not merely wrap a string. It sanitizes, escapes, templates, or validates according to the context, then returns a typed value.',
        'The `trusted-types` CSP directive can restrict which policy names are allowed. This matters because any code that can create an allowed policy can mint trusted values. Large applications should keep policy names few, reviewed, and tied to real rendering responsibilities.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the browser sees the final dangerous operation. A code search can miss wrapper functions. A review checklist can be stale. A framework helper can hide an assignment. The browser still knows that a string is being assigned to a protected sink.',
        'It also works as a ratchet. Report-only mode builds the map of existing violations. Enforcement turns the map into a guardrail. After that point, a new raw sink write fails early instead of becoming quiet security debt.',
        'The deeper reason is capability control. Raw strings are common and easy to obtain. Trusted values are intentionally minted. That difference lets the platform say, "ordinary data may flow through the app, but DOM-capable content must pass through reviewed code."',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a CMS preview surface. Authors can write markdown with a small allowlist of HTML tags. Before Trusted Types, the renderer converts markdown to a string and assigns it to `preview.innerHTML`. If the renderer or sanitizer misses an event-handler attribute, URL edge case, or parser trick, the sink accepts the string.',
        'With Trusted Types enforcement, `preview.innerHTML = htmlString` fails. The preview code must call a policy such as `cmsHTML`. That policy runs the selected sanitizer with a narrow allowlist, strips scriptable attributes, validates links, and returns `TrustedHTML`.',
        'The review target becomes concrete. Security reviewers can inspect the `cmsHTML` policy, sanitizer configuration, tests, and allowed tags. Product engineers can still render previews, but the dangerous conversion is no longer scattered across unrelated components.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost is migration. Old applications may have hundreds of sink writes. Some are safe but untyped. Some are unsafe. Some come from dependencies. Some only run in rare feature modes. Report-only CSP, violation grouping, source maps, and owner routing are usually needed before enforcement is practical.',
        'The second cost is developer ergonomics. If safe rendering requires awkward boilerplate, engineers will ask for broad policies or default bypasses. A serious rollout provides narrow helpers for common patterns: render text, render sanitized CMS HTML, render template output, validate script URLs, and isolate third-party previews.',
        'The tradeoff is strictness versus compatibility. A permissive default policy can keep a legacy page working, but it can also convert every raw string automatically and hide the debt. Too many named policies can make review meaningless. Too few helpers can make teams fight the system.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'It wins in large client-side applications with dynamic rendering: CMS previews, markdown editors, email builders, dashboards, design tools, admin panels, browser extensions, documentation tools, and analytics consoles. These products often mix user-authored content, generated markup, and frequent DOM mutation.',
        'It also wins in organizations with many frontend teams. A platform security team can define allowed policies and safe helpers once, then use browser enforcement to make the rule consistent across product surfaces.',
        'Trusted Types is especially useful when paired with ordinary CSP. Nonces and hashes reduce unauthorized script execution through script tags. Trusted Types narrows DOM injection paths created by application JavaScript itself.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails if the policy is a bypass. A policy that returns raw input is not a sanitizer. A policy that uses a weak sanitizer still produces weak trusted values. Trusted Types controls the boundary; it does not prove that the transformation inside the policy is correct.',
        'It fails if policy creation is uncontrolled. If every package can create its own allowed policy, the type system becomes ceremony. Restrict policy names and review the code that creates them.',
        'It also fails as a complete security story. You still need server-side validation, output encoding, iframe sandboxing for hostile content, dependency review, CSP script controls, secure templating, and browser compatibility planning.',
      ],
    },
    {
      heading: 'How it works (3)',
      paragraphs: [
        'Start with report-only mode and collect violations by URL, component, sink, stack trace, and owner. Do not jump straight to enforcement on a large legacy app unless the breakage is acceptable. The first artifact should be an inventory: which sinks exist, who owns them, and what kind of fix each one needs.',
        'Design policies narrowly. A CMS policy is different from a markdown policy, and both are different from a script URL policy. Prefer named policies tied to product surfaces or rendering contracts, not generic names such as "safe" or "bypass".',
        'Use enforcement as a release gate only after the important flows are clean. Keep violation reporting after enforcement so regressions are visible. Review default policy use regularly and remove it when compatibility work is done.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Content Security Policy Nonce and Hash Policy next, because Trusted Types usually sits beside script-src controls. Then study Subresource Integrity Hash Manifest for supply-chain loading, Cross-Origin Isolation for browser process boundaries, SameSite Cookies and CSRF for request authority, and Capability Security and Attenuation for the broader idea of typed authority.',
        'Primary references are MDN on `require-trusted-types-for`, MDN on the Trusted Types API, MDN on the `trusted-types` CSP directive, and the W3C Trusted Types specification. Read them with the sink boundary in mind: the feature is strongest when policy creation is rare, reviewed, and tied to real sanitization.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Trusted Types DOM XSS Sink Guard moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
