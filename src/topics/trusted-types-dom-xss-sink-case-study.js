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
        'The graph traces how a value moves from raw input to DOM render through the Trusted Types pipeline. Each node is either a data source, a policy component, or a browser enforcement gate. Each edge is a data-flow step the value must traverse.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the component currently processing or evaluating the value.',
            'Compare nodes are gates or checks not yet resolved -- enforcement pending or policy not yet invoked.',
            'Found nodes are checks that passed: the value has been accepted by that gate.',
            'Removed nodes are paths the browser blocked because enforcement rejected a raw string.',
          ],
        },
        {
          type: 'note',
          text: 'The "sink guard" view walks the data flow from raw string to DOM with and without enforcement. The "policy rollout" view walks the migration strategy: report-only discovery, fix prioritization, policy design, and enforcement activation.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'DOM XSS is the class of cross-site scripting that happens entirely in the browser. The server returns safe HTML, but client-side JavaScript takes a string from one place -- a URL parameter, an API response, a user comment, a postMessage payload -- and writes it into a DOM sink that parses it as markup or code. The injection never touches the server.',
        {
          type: 'quote',
          text: 'DOM-based XSS is an XSS attack wherein the attack payload is executed as a result of modifying the DOM "environment" in the victim\'s browser used by the original client side script, so that the client side code runs in an "unexpected" manner.',
          attribution: 'OWASP, "DOM Based XSS" reference page',
        },
        'The problem is type collapse. In JavaScript, safe markup, template output, user-authored text, sanitized HTML, and attacker-controlled input are all the same type: `string`. A sink like `innerHTML` accepts any string. It cannot distinguish a reviewed sanitizer output from a raw URL parameter. The language gives the browser no signal about intent.',
        {
          type: 'table',
          headers: ['Sink', 'API', 'What it parses', 'Attack surface'],
          rows: [
            ['innerHTML', 'Element.innerHTML = str', 'Full HTML', 'Script tags, event handlers, SVG payloads'],
            ['outerHTML', 'Element.outerHTML = str', 'Full HTML', 'Same as innerHTML, replaces element'],
            ['document.write', 'document.write(str)', 'Full HTML into document stream', 'Arbitrary markup injection'],
            ['insertAdjacentHTML', 'el.insertAdjacentHTML(pos, str)', 'Full HTML at position', 'Event handlers, embedded scripts'],
            ['eval', 'eval(str)', 'JavaScript source', 'Arbitrary code execution'],
            ['setTimeout (string)', 'setTimeout(str, ms)', 'JavaScript source', 'Deferred code execution'],
            ['script.src', 'script.src = str', 'Script URL', 'External script inclusion'],
            ['location.href', 'location.href = str', 'Navigation URL', 'javascript: protocol injection'],
          ],
        },
        'Trusted Types exists to break type collapse at the platform level. Instead of relying on every developer to sanitize every string before every sink write, the browser itself rejects raw strings at protected sinks and accepts only typed wrappers created by reviewed policies.',
        {
          type: 'note',
          text: 'Google reported that Trusted Types eliminated DOM XSS as a vulnerability class in applications that fully adopted it. The mechanism works because the enforcement point is the sink itself -- the last place a string can be intercepted before it becomes executable DOM.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is manual discipline: train developers to sanitize or escape every value before writing it to a sink. Use DOMPurify or a framework-provided sanitizer. Run linters that flag direct `innerHTML` assignments. Conduct code reviews that check for raw sink writes. Add CSP `script-src` to block inline scripts.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// The manual discipline approach:',
            '// Rule: always sanitize before innerHTML',
            'import DOMPurify from "dompurify";',
            '',
            'function renderComment(el, commentHTML) {',
            '  el.innerHTML = DOMPurify.sanitize(commentHTML);',
            '}',
            '',
            '// But nothing stops a different file from doing:',
            'preview.innerHTML = userMarkdown; // no sanitizer, no error',
          ].join('\n'),
          label: 'Manual sanitization works per-callsite but cannot enforce coverage',
        },
        'This approach is correct in principle. The problem is not the technique -- it is the coverage guarantee. Manual discipline is a convention, not a contract. The browser does not know whether the string was sanitized. The linter does not see wrapper functions or dynamic property access. The code review does not catch every path through every dependency.',
        {
          type: 'bullets',
          items: [
            'DOMPurify protects the call sites that use it. It cannot protect call sites that forget it.',
            'Linting catches `el.innerHTML = x` but misses `el[prop] = x` where prop is "innerHTML" at runtime.',
            'CSP script-src blocks inline `<script>` tags injected via innerHTML, but does not block event-handler attributes like `onload`, `onerror`, or `onfocus`.',
            'Code review catches unsafe patterns in new code. It does not retroactively fix old code, vendored libraries, or rarely-executed error paths.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that manual sanitization is a property of each call site, while safety is a property of all call sites. Missing one is enough.',
        {
          type: 'diagram',
          text: [
            '  Application with 200 innerHTML writes:',
            '  ',
            '  components/Editor.js      innerHTML = sanitize(x)    SAFE',
            '  components/Preview.js      innerHTML = sanitize(x)    SAFE',
            '  components/Comment.js      innerHTML = sanitize(x)    SAFE',
            '  ... (196 more files)       innerHTML = sanitize(x)    SAFE',
            '  lib/legacy-widget.js       innerHTML = rawString       <-- XSS',
            '  ',
            '  Coverage: 199/200 = 99.5%',
            '  Security: BROKEN',
          ].join('\n'),
          label: 'One missed sink in 200 is a vulnerability, not 99.5% security',
        },
        'Large frontend codebases have hundreds of sink writes accumulated over years. They span first-party components, vendored libraries, WYSIWYG editors, markdown renderers, template engines, error-handling paths, feature-flagged branches, and admin-only panels. A security audit that fixes 199 out of 200 sink writes has not solved the problem.',
        'The second wall is drift. A new developer adds a feature with a direct `innerHTML` write. A library update introduces a new sink. A wrapper function that once called the sanitizer gets refactored and the sanitizer call is lost. A dynamic property assignment bypasses the linter. Each of these creates a new gap in coverage, silently.',
        {
          type: 'table',
          headers: ['Coverage gap', 'Why manual review misses it', 'How often it appears'],
          rows: [
            ['Wrapper functions', 'Linter sees the wrapper, not the sink inside it', 'Common in large codebases'],
            ['Dynamic property access', 'el[sinkName] = value bypasses static patterns', 'Rare but exploitable'],
            ['Vendor libraries', 'Minified code is not reviewed; internal sinks are hidden', 'Every third-party widget'],
            ['Error paths', 'Display error HTML in catch blocks, rarely tested', 'Most applications'],
            ['Feature flags', 'Disabled code is not reviewed but ships in the bundle', 'Feature-flagged products'],
            ['Template engines', 'Custom template compilers may emit direct sink writes', 'CMS and email builders'],
          ],
        },
        {
          type: 'note',
          text: 'The wall is not that sanitization is hard. The wall is that sanitization is voluntary. Trusted Types moves the check from convention (every developer must remember) to enforcement (the browser rejects violations).',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat DOM injection sinks as capability boundaries. A raw string should not have the capability to become executable markup. Only a value explicitly minted by a reviewed policy should cross the sink boundary.',
        {
          type: 'diagram',
          text: [
            '  WITHOUT TRUSTED TYPES:',
            '  ',
            '  any string ---------> innerHTML ---------> DOM',
            '     (no gate)            (accepts anything)',
            '  ',
            '  WITH TRUSTED TYPES:',
            '  ',
            '  any string --X--> innerHTML     (TypeError: rejected)',
            '  ',
            '  any string --> policy.createHTML() --> TrustedHTML --> innerHTML --> DOM',
            '                  (reviewed gate)        (typed value)   (accepts type)',
          ].join('\n'),
          label: 'The sink becomes a type gate: raw strings are rejected, only TrustedHTML passes',
        },
        'The invariant: protected sinks accept only their matching trusted type. `innerHTML` requires `TrustedHTML`. `eval` requires `TrustedScript`. `script.src` requires `TrustedScriptURL`. The browser enforces this at the moment of assignment, not at the moment of construction.',
        {
          type: 'table',
          headers: ['Trusted type', 'Created by', 'Accepted by', 'Guards against'],
          rows: [
            ['TrustedHTML', 'policy.createHTML(input)', 'innerHTML, outerHTML, insertAdjacentHTML, document.write', 'HTML injection, event-handler attributes, embedded scripts'],
            ['TrustedScript', 'policy.createScript(input)', 'eval, setTimeout(string), setInterval(string)', 'Arbitrary code execution from string inputs'],
            ['TrustedScriptURL', 'policy.createScriptURL(input)', 'script.src, Worker constructor, importScripts', 'Malicious script loading from untrusted URLs'],
          ],
        },
        'A policy is a named factory, not magic safety. Its value is centralization: instead of auditing every sink write in the application, the security team audits a small number of policy implementations. The policy name becomes the unit of review. The browser enforces which names are allowed through the `trusted-types` CSP directive.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Trusted Types is activated through Content Security Policy. Two directives control the system:',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Require trusted values for all DOM XSS sinks:',
            'Content-Security-Policy: require-trusted-types-for \'script\'',
            '',
            '# Restrict which policy names may be created:',
            'Content-Security-Policy: trusted-types cmsHTML templateEscape',
            '',
            '# Combined in one header:',
            'Content-Security-Policy: require-trusted-types-for \'script\'; trusted-types cmsHTML templateEscape',
            '',
            '# Report-only mode for migration (does not block):',
            'Content-Security-Policy-Report-Only: require-trusted-types-for \'script\'; trusted-types cmsHTML templateEscape; report-uri /csp-report',
          ].join('\n'),
          label: 'CSP directives for Trusted Types enforcement',
        },
        'When enforcement is active, any raw string assignment to a protected sink throws a `TypeError`. The browser does not silently sanitize -- it stops the assignment. This turns a potential XSS into a visible runtime error that shows up in monitoring, testing, and development.',
        'Application code creates policies through the `trustedTypes` API. Each policy has a name and one or more factory functions:',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Create a named policy with a sanitization function',
            'const cmsPolicy = trustedTypes.createPolicy("cmsHTML", {',
            '  createHTML: (input) => {',
            '    // DOMPurify strips scripts, event handlers, dangerous attrs',
            '    return DOMPurify.sanitize(input, {',
            '      ALLOWED_TAGS: ["p", "b", "i", "a", "ul", "ol", "li", "h2", "h3"],',
            '      ALLOWED_ATTR: ["href", "title"],',
            '    });',
            '  },',
            '});',
            '',
            '// Use the policy -- returns TrustedHTML, not a string',
            'preview.innerHTML = cmsPolicy.createHTML(markdownOutput);',
            '',
            '// Direct string assignment throws TypeError under enforcement:',
            '// preview.innerHTML = markdownOutput; // TypeError!',
          ].join('\n'),
          label: 'Policy creation and usage: the factory returns a typed wrapper',
        },
        'The `trusted-types` directive restricts which policy names may exist. If the CSP says `trusted-types cmsHTML templateEscape`, then `trustedTypes.createPolicy("bypass", ...)` throws. This prevents arbitrary libraries from minting their own trusted values after enforcement begins.',
        {
          type: 'table',
          headers: ['Component', 'Role', 'Who controls it'],
          rows: [
            ['require-trusted-types-for', 'Activates sink enforcement', 'Server (CSP header or meta tag)'],
            ['trusted-types directive', 'Allowlists policy names', 'Server (CSP header)'],
            ['trustedTypes.createPolicy()', 'Creates a named policy factory', 'Application JavaScript'],
            ['policy.createHTML()', 'Produces TrustedHTML from a string', 'Application JavaScript'],
            ['DOM sink (innerHTML, etc.)', 'Accepts TrustedHTML, rejects string', 'Browser engine'],
            ['Violation report', 'Sends JSON to report endpoint', 'Browser via report-uri / Reporting API'],
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Trusted Types works because the enforcement point is the sink, not the source. A code search can miss wrapper functions. A linter can miss dynamic property access. A code review can miss vendored code. The browser cannot miss the assignment -- it is the runtime that executes it.',
        {
          type: 'quote',
          text: 'By mandating Trusted Types across your application, you can completely eliminate DOM XSS vulnerabilities. This works because the browser prevents passing strings to injection sinks and enforces the use of typed objects.',
          attribution: 'Google Security Blog, "Trusted Types help prevent Cross-Site Scripting" (2020)',
        },
        'The security argument has three parts:',
        {
          type: 'bullets',
          items: [
            'Completeness: the browser enforces the check on every assignment to every protected sink, including dynamic access, eval variants, and document.write. No call site is exempt.',
            'Centralization: the risky string-to-DOM conversion is concentrated in a small number of policy implementations. If those policies are correct, all sink writes through them are correct.',
            'Ratchet effect: report-only mode reveals existing violations. Enforcement prevents new ones. The system only moves toward fewer raw sink writes, never backward.',
          ],
        },
        'The deeper principle is capability control. In a system without Trusted Types, any code that holds a string and a reference to a DOM element has the implicit capability to inject markup. With Trusted Types, that capability is restricted to code that holds a policy reference. The review surface shrinks from "every line that touches a sink" to "every policy factory function."',
        {
          type: 'note',
          text: 'Trusted Types does not prove that a policy is correct. It proves that every sink write goes through a policy. The distinction matters: a bad policy (one that returns unsanitized input) still produces XSS. The mechanism reduces the audit surface, not the need for auditing.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A CMS lets editors write articles in markdown with a small allowlist of HTML tags. The preview panel renders the output live. Before Trusted Types, the rendering path looks like this:',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// BEFORE: raw string flows to sink',
            'function updatePreview(markdown) {',
            '  const html = markdownToHTML(markdown);',
            '  document.getElementById("preview").innerHTML = html;',
            '}',
          ].join('\n'),
          label: 'Unguarded sink: if markdownToHTML passes through event handlers, the sink accepts them',
        },
        'If the markdown renderer does not strip `onerror` attributes or `javascript:` URLs, the CMS is vulnerable. Worse, the preview might use a different renderer than the published view, so test coverage may not catch it.',
        'With Trusted Types enforcement, `innerHTML = html` throws TypeError. The team creates a policy:',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// AFTER: policy-guarded sink',
            'const cmsHTML = trustedTypes.createPolicy("cmsHTML", {',
            '  createHTML: (input) => DOMPurify.sanitize(input, {',
            '    ALLOWED_TAGS: ["p", "b", "i", "em", "strong", "a", "ul", "ol", "li",',
            '                   "h2", "h3", "h4", "blockquote", "code", "pre"],',
            '    ALLOWED_ATTR: ["href", "title", "class"],',
            '    ALLOW_DATA_ATTR: false,',
            '  }),',
            '});',
            '',
            'function updatePreview(markdown) {',
            '  const html = markdownToHTML(markdown);',
            '  document.getElementById("preview").innerHTML = cmsHTML.createHTML(html);',
            '}',
          ].join('\n'),
          label: 'Policy-guarded sink: DOMPurify strips dangerous content, policy mints TrustedHTML',
        },
        'The security review now focuses on one file: the policy definition. Reviewers check the DOMPurify config, the allowed tags, and the allowed attributes. Every preview render passes through this single gate.',
        {
          type: 'table',
          headers: ['Step', 'Action', 'Result'],
          rows: [
            ['1', 'Deploy CSP-Report-Only with require-trusted-types-for', '47 violation reports collected in staging'],
            ['2', 'Triage violations by component owner and sink type', '31 innerHTML, 9 insertAdjacentHTML, 4 document.write, 3 eval'],
            ['3', 'Create cmsHTML policy for the preview renderer', 'Preview renders through DOMPurify with strict config'],
            ['4', 'Create templateEscape policy for the admin dashboard', 'Dashboard inserts escaped text, never raw HTML'],
            ['5', 'Replace document.write calls with DOM API alternatives', '4 violations eliminated without needing a policy'],
            ['6', 'Remove eval calls (legacy JSON parsing)', '3 violations eliminated by switching to JSON.parse'],
            ['7', 'Activate enforcement with trusted-types cmsHTML templateEscape', 'Remaining violations throw TypeError in staging'],
            ['8', 'Fix 3 remaining violations in error-display paths', 'All sinks covered; enforcement clean in staging and production'],
          ],
        },
        {
          type: 'note',
          text: 'The default policy is a migration tool, not a destination. A default policy catches all untyped sink writes as a fallback. Use it during migration to prevent breakage, then remove it once all paths are covered by named policies. A permanent default policy that passes strings through defeats the purpose.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Trusted Types has no runtime performance cost for correct code. Policy creation is a one-time factory registration. The type check at the sink is a property check the browser already performs. The cost is entirely in migration and developer workflow.',
        {
          type: 'table',
          headers: ['Cost center', 'What drives it', 'Mitigation'],
          rows: [
            ['Sink inventory', 'Number of innerHTML, eval, document.write, script.src calls across the codebase', 'Report-only mode with violation grouping and source maps'],
            ['Third-party libraries', 'Vendor code with internal sink writes that cannot be patched', 'Wrap in iframe, replace with Trusted Types-aware alternative, or proxy through default policy during migration'],
            ['Policy design', 'Each rendering context needs its own sanitization logic', 'Provide platform-level helpers: renderText, renderSanitizedHTML, renderTemplateOutput'],
            ['Developer education', 'Engineers unfamiliar with the API create broad bypass policies', 'Lint rules that flag overly permissive createHTML implementations'],
            ['Testing', 'Enforcement mode surfaces violations only at runtime, not at compile time', 'Integration tests that exercise all rendering paths with enforcement active'],
            ['Framework integration', 'React, Angular, Lit already handle innerHTML; interaction with TT varies', 'Angular has built-in TT support; React uses dangerouslySetInnerHTML which needs wrapping'],
          ],
        },
        'Migration cost scales with the number of unique sink writes, not with traffic or page views. A small SPA with 5 innerHTML calls migrates in hours. A legacy CMS with 300 sink writes across 80 components migrates over weeks, with report-only mode running throughout.',
        {
          type: 'note',
          text: 'The biggest ergonomic risk is policy sprawl. If every component defines its own policy, the review surface grows back to the original problem. Keep policies few (2-5 for most applications), tied to rendering responsibilities, and owned by security-reviewed modules.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Google deployed Trusted Types across its web properties and reported it eliminated DOM XSS as a vulnerability class in covered applications. The mechanism is most valuable in applications that combine user-authored content with dynamic rendering.',
        {
          type: 'table',
          headers: ['Application type', 'Why Trusted Types helps', 'Key sinks guarded'],
          rows: [
            ['CMS / blog platforms', 'Editors produce rich HTML that flows to preview and publish sinks', 'innerHTML, insertAdjacentHTML'],
            ['Email builders', 'Template rendering combines user text, dynamic fields, and HTML layout', 'innerHTML, document.write'],
            ['Admin dashboards', 'Display user-submitted data (names, descriptions, error messages) in DOM', 'innerHTML, textContent misuse'],
            ['Markdown editors', 'Markdown-to-HTML conversion produces strings that reach innerHTML', 'innerHTML'],
            ['Browser extensions', 'Content scripts inject UI into arbitrary pages using innerHTML', 'innerHTML, insertAdjacentHTML'],
            ['Analytics dashboards', 'Chart tooltips and labels may render user-defined names as HTML', 'innerHTML in tooltip libraries'],
            ['Design tools (Figma, Canva)', 'Plugin systems render plugin-provided HTML in the main document', 'innerHTML, Shadow DOM innerHTML'],
          ],
        },
        'Trusted Types pairs with CSP `script-src` for defense in depth. CSP nonces and hashes prevent unauthorized `<script>` tags. Trusted Types prevents DOM injection from application JavaScript. Together they close both the markup-injection and script-injection paths.',
        {
          type: 'code',
          language: 'text',
          text: [
            '# Defense-in-depth CSP combining script-src and Trusted Types:',
            'Content-Security-Policy:',
            "  script-src 'nonce-abc123' 'strict-dynamic';",
            "  require-trusted-types-for 'script';",
            '  trusted-types cmsHTML templateEscape;',
            '  report-uri /csp-violations',
          ].join('\n'),
          label: 'CSP combining nonce-based script control with Trusted Types sink control',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Trusted Types fails when the policy itself is the vulnerability. A policy that returns its input unchanged is a bypass, not a guard:',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// DANGEROUS: this policy defeats the entire mechanism',
            'const bypass = trustedTypes.createPolicy("bypass", {',
            '  createHTML: (input) => input, // no sanitization',
            '});',
            '',
            '// This "works" but provides zero protection:',
            'el.innerHTML = bypass.createHTML(attackerControlledString);',
          ].join('\n'),
          label: 'A passthrough policy satisfies the type check but provides no security',
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Why it happens', 'Consequence'],
          rows: [
            ['Passthrough policy', 'Developer creates policy to stop TypeError without adding sanitization', 'DOM XSS still exploitable through the policy'],
            ['Overly permissive default policy', 'Migration shortcut that silently wraps all strings', 'Every sink write bypasses review; false sense of security'],
            ['Too many policies', 'Each team creates its own policy for its own component', 'Review surface grows back to original size; policies become rubber stamps'],
            ['Policy name not restricted', 'CSP omits trusted-types directive or uses wildcard', 'Any script can create a policy with any name'],
            ['Browser compatibility', 'Safari and Firefox do not support Trusted Types natively (as of 2025)', 'Enforcement only works in Chromium browsers; polyfill needed for cross-browser'],
            ['Server-side XSS', 'Injection happens in server-rendered HTML before JavaScript runs', 'Trusted Types only guards client-side DOM manipulation sinks'],
          ],
        },
        'Browser support is the most significant practical limitation. Trusted Types shipped in Chrome 83 (2020) and is supported in all Chromium-based browsers (Edge, Opera, Brave). Firefox and Safari have not implemented it natively. A polyfill exists but provides development-time checking, not browser-level enforcement.',
        {
          type: 'note',
          text: 'Trusted Types is not a complete XSS defense. It guards DOM manipulation sinks in client-side JavaScript. It does not protect against server-side injection, reflected XSS in initial HTML, CSS injection, or prototype pollution. Use it as one layer in a defense-in-depth strategy alongside CSP, input validation, output encoding, and iframe sandboxing.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'Covers'],
          rows: [
            ['W3C Trusted Types specification', 'Normative definition of TrustedHTML, TrustedScript, TrustedScriptURL, policy API, and CSP integration'],
            ['MDN: Trusted Types API', 'API reference for trustedTypes.createPolicy, policy factory functions, and type checking'],
            ['MDN: require-trusted-types-for', 'CSP directive reference for enabling sink enforcement'],
            ['MDN: trusted-types directive', 'CSP directive reference for restricting allowed policy names'],
            ['Google Security Blog: "Trusted Types help prevent Cross-Site Scripting" (2020)', 'Production deployment experience at Google scale'],
            ['web.dev: "Prevent DOM-based cross-site scripting vulnerabilities with Trusted Types"', 'Migration guide with code examples and rollout strategy'],
            ['DOMPurify documentation', 'The most common sanitizer used inside Trusted Types policies'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Content Security Policy Nonce and Hash Policy -- understand CSP before adding Trusted Types directives.',
            'Companion: Cross-Origin Isolation (COOP/COEP/CORP) -- another browser-enforced security boundary, for process isolation.',
            'Extension: Subresource Integrity Hash Manifest -- guards script loading, while Trusted Types guards script content from DOM sinks.',
            'Contrast: Capability Security and Attenuation -- the broader theoretical framework for treating access as a typed capability.',
            'Practice: SameSite Cookies and CSRF -- request-level authority control complements DOM-level sink control.',
          ],
        },
      ],
    },
  ],
};
