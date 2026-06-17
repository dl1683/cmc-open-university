// Crash-consistent file replacement: write temp, fsync file, rename atomically,
// then fsync the directory so both contents and name survive power loss.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fsync-rename-crash-consistency-case-study',
  title: 'fsync Rename Crash Consistency',
  category: 'Systems',
  summary: 'How durable file replacement uses temp files, dirty page cache, fsync, atomic rename, directory fsync, and crash-window reasoning.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['safe replace', 'crash windows'], defaultValue: 'safe replace' },
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

function fsyncGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 4.8, note: notes.app ?? 'save config' },
      { id: 'tmp', label: 'tmp', x: 2.2, y: 3.0, note: notes.tmp ?? 'new bytes' },
      { id: 'cache', label: 'cache', x: 3.9, y: 3.0, note: notes.cache ?? 'dirty' },
      { id: 'old', label: 'old', x: 2.2, y: 6.4, note: notes.old ?? 'config.json' },
      { id: 'rename', label: 'rename', x: 5.5, y: 4.8, note: notes.rename ?? 'atomic name' },
      { id: 'dir', label: 'dir', x: 7.1, y: 3.0, note: notes.dir ?? 'entry' },
      { id: 'disk', label: 'disk', x: 7.1, y: 6.4, note: notes.disk ?? 'stable' },
      { id: 'crash', label: 'crash', x: 8.8, y: 4.8, note: notes.crash ?? 'audit' },
    ],
    edges: [
      { id: 'e-app-tmp', from: 'app', to: 'tmp', weight: '' },
      { id: 'e-tmp-cache', from: 'tmp', to: 'cache', weight: '' },
      { id: 'e-cache-disk', from: 'cache', to: 'disk', weight: '' },
      { id: 'e-old-rename', from: 'old', to: 'rename', weight: '' },
      { id: 'e-tmp-rename', from: 'tmp', to: 'rename', weight: '' },
      { id: 'e-rename-dir', from: 'rename', to: 'dir', weight: '' },
      { id: 'e-dir-disk', from: 'dir', to: 'disk', weight: '' },
      { id: 'e-disk-crash', from: 'disk', to: 'crash', weight: '' },
    ],
  }, { title });
}

function* safeReplace() {
  yield {
    state: fsyncGraph('Write the new contents to a separate temp file'),
    highlight: { active: ['app', 'tmp', 'cache', 'e-app-tmp', 'e-tmp-cache'], compare: ['old'] },
    explanation: 'Safe replacement starts by writing new bytes to a temp file in the same directory. The old file remains the visible version while new data is still being prepared.',
    invariant: 'Do not overwrite the only good copy before the replacement is durable.',
  };

  yield {
    state: fsyncGraph('fsync the temp file to force its contents', { cache: 'dirty tmp', disk: 'tmp bytes stable' }),
    highlight: { active: ['tmp', 'cache', 'disk', 'e-tmp-cache', 'e-cache-disk'], found: ['old'] },
    explanation: 'write() can return after copying bytes into the page cache. fsync(tempfd) asks the kernel and filesystem to push the temp file contents and required file metadata to stable storage.',
  };

  yield {
    state: fsyncGraph('rename swaps the directory entry atomically', { rename: 'tmp -> live', old: 'old name', dir: 'new points' }),
    highlight: { active: ['tmp', 'old', 'rename', 'dir', 'e-old-rename', 'e-tmp-rename', 'e-rename-dir'], compare: ['crash'] },
    explanation: 'rename within the same filesystem is atomic from the namespace point of view. Readers should see either the old file or the new file name, not a half-written mixture.',
  };

  yield {
    state: fsyncGraph('fsync the directory to persist the name change', { dir: 'dirty dirent', disk: 'name stable', crash: 'survives' }),
    highlight: { active: ['dir', 'disk', 'crash', 'e-dir-disk', 'e-disk-crash'], found: ['rename'] },
    explanation: 'The directory entry is metadata too. fsync on the containing directory is the conservative step that makes the rename durable across crash recovery.',
  };

  yield {
    state: labelMatrix(
      'Durable replace recipe',
      [
        { id: 'write', label: 'write tmp' },
        { id: 'fsyncf', label: 'fsync file' },
        { id: 'rename', label: 'rename' },
        { id: 'fsyncd', label: 'fsync dir' },
      ],
      [
        { id: 'protects', label: 'protects' },
        { id: 'if crash', label: 'if crash' },
      ],
      [
        ['new bytes', 'old visible'],
        ['file data', 'tmp valid'],
        ['atomic name', 'old or new'],
        ['dir entry', 'new durable'],
      ],
    ),
    highlight: { active: ['fsyncf:protects', 'rename:protects', 'fsyncd:protects'], compare: ['write:if crash'] },
    explanation: 'The pattern separates content durability from namespace durability. File fsync protects bytes. Directory fsync protects the fact that the name now points at those bytes.',
  };
}

function* crashWindows() {
  yield {
    state: labelMatrix(
      'Crash windows',
      [
        { id: 'beforeF', label: 'before fsync' },
        { id: 'afterF', label: 'after file' },
        { id: 'afterR', label: 'after rename' },
        { id: 'afterD', label: 'after dir' },
      ],
      [
        { id: 'visible', label: 'visible' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['old', 'new lost'],
        ['old', 'tmp remains'],
        ['old/new', 'name may roll'],
        ['new', 'done'],
      ],
    ),
    highlight: { active: ['afterD:visible'], compare: ['beforeF:risk', 'afterR:risk'] },
    explanation: 'Crash consistency is timeline reasoning. Each syscall moves one boundary, but only the final directory fsync makes the replacement contract fully durable.',
    invariant: 'Atomic visibility and durable visibility are different promises.',
  };

  yield {
    state: fsyncGraph('A crash before file fsync can lose the temp data', { tmp: 'dirty only', cache: 'RAM', disk: 'old stable', crash: 'new gone' }),
    highlight: { active: ['tmp', 'cache', 'crash'], removed: ['disk'], compare: ['old'] },
    explanation: 'If the system loses power before fsync(tempfd), the new data may never reach stable media. The old file is still the safe fallback because rename has not happened.',
  };

  yield {
    state: fsyncGraph('A crash after rename but before directory fsync is filesystem-dependent risk', { rename: 'visible new', dir: 'dirty', disk: 'file stable', crash: 'dir uncertain' }),
    highlight: { active: ['rename', 'dir', 'disk', 'crash'], compare: ['old'] },
    explanation: 'The new file contents can be durable while the directory entry update is not. Journaling helps metadata consistency, but portable code should still fsync the directory for the name update.',
  };

  yield {
    state: fsyncGraph('The complete case is editor safe-save', { app: 'editor', tmp: '.file.tmp', old: 'file.txt', rename: 'replace', dir: 'parent', crash: 'old or new' }),
    highlight: { active: ['app', 'tmp', 'cache', 'rename', 'dir', 'disk', 'crash'], found: ['old'] },
    explanation: 'An editor safe-save writes .file.tmp, fsyncs it, renames it over file.txt, and fsyncs the directory. After a crash, recovery should find either the old file or the complete new file.',
  };

  yield {
    state: labelMatrix(
      'Common mistakes',
      [
        { id: 'overwrite', label: 'overwrite' },
        { id: 'noFsync', label: 'no fsync' },
        { id: 'noDir', label: 'no dir' },
        { id: 'cross', label: 'cross fs' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['torn file', 'temp+rename'],
        ['dirty RAM', 'fsync file'],
        ['lost name', 'fsync dir'],
        ['not atomic', 'same dir'],
      ],
    ),
    highlight: { removed: ['overwrite:problem', 'noFsync:problem', 'noDir:problem'], found: ['cross:fix'] },
    explanation: 'The mistakes all confuse a different boundary: content, name, or filesystem. The recipe works because it treats each boundary explicitly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'safe replace') yield* safeReplace();
  else if (view === 'crash windows') yield* crashWindows();
  else throw new InputError('Pick an fsync/rename view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replacing a file is easy until power fails between two storage events. A process can return from write() while bytes are still only in the page cache. A filesystem can persist file contents before the directory entry that names them. A journal can protect metadata consistency while still leaving application-level state in the wrong generation.',
        'The desired contract for a safe replace is simple to state: after a crash, recovery should find either the old complete file or the new complete file. It should not find a truncated target, half of the new contents, a target name whose update vanished, or a temp file that the application treats as committed state.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is open the target, truncate it, write the new bytes, close it, and report success. That destroys the old valid copy before the new one has earned durability. If the machine crashes after truncate and before all bytes reach stable storage, the filesystem can recover cleanly while the application data is ruined.',
        'Even code that writes all bytes correctly can hit the wall. Process success is not the same as crash survival. Crash consistency asks what is true after every prefix of the syscall sequence, not just what is true when the happy path reaches the end.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'A pathname is not the file contents. It is a directory entry that points to a filesystem object. That gives durable replacement two separate targets: make the new bytes stable, then make the target name point at those stable bytes.',
        'The invariant is old-or-new, never torn. Before commit, the old file remains the committed version. After commit, the new file and its name are durable. The protocol works by preparing a separate temp file, forcing its contents, using rename as the visible commit, then forcing the parent directory so the commit survives recovery.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The safe-replace view separates preparation from commit. The temp node is new content that is not yet the live target. The cache and disk nodes show why write() and durability differ. The rename node shows the atomic namespace swap. The directory node shows the metadata step that many broken safe-save paths skip.',
        'The crash-windows view is a timeline audit. At each row, ask which object is durable: the old file, temp contents, target name, or parent directory. The lesson is boundary location. Every syscall moves one boundary, and a crash can land between them.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Create the temp file in the same directory as the target, or at least on the same filesystem. Same-filesystem rename is the atomic namespace operation the protocol depends on. Cross-filesystem moves become copy plus unlink, which is a different and weaker shape.',
        'Write all replacement bytes to the temp file. Handle short writes and errors before the file becomes a candidate commit. Then call fsync on the temp file descriptor. That asks the kernel and filesystem to push the file contents, plus the file metadata needed to find those contents, to stable storage.',
        'Call rename(temp, target). From the namespace view, readers should see either the old target or the new target, not a mixed file. Then open the parent directory and fsync the directory descriptor. The directory entry is parent-directory metadata, so fsyncing the renamed file is not the conservative substitute.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Before the temp-file fsync, a crash can lose the new bytes, but the old target is still the committed file because rename has not happened. After the file fsync and before rename, a crash may leave a temp file to clean up, but the target still names the old committed file.',
        'After rename but before directory fsync, userspace may have observed the new name, yet crash recovery can still be uncertain about whether the directory update is durable. After directory fsync, both the bytes and the target-name binding are inside the durable contract.',
        'The method works because content durability and namespace durability are forced separately. Atomic rename gives clean visibility. Directory fsync gives crash durability for that visibility. Confusing those two promises is the source of many data-loss bugs.',
      ],
    },
    {
      heading: 'Worked examples',
      paragraphs: [
        'A text editor saves file.txt. It writes .file.txt.tmp beside the target, checks that all bytes were written, fsyncs the temp file, renames it to file.txt, and fsyncs the parent directory. A crash before rename leaves the old file. A crash after the complete sequence leaves the new file.',
        'A model-serving system can use the same shape for a current-model manifest. The large model blobs may be immutable and content-addressed. The small manifest is the pointer that changes. Durable replacement makes the pointer swap recoverable without teaching every reader about partial deployment state.',
        'A package manager can write a new metadata snapshot, force the snapshot file, rename it into place, and force the directory. Readers either find the old metadata generation or the new generation. They do not have to repair a half-written JSON file after boot.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern is a good fit for small state files where one path represents the current committed value: editor saves, configuration updates, manifest swaps, package metadata, checkpoint pointers, feature-flag snapshots, and generated indexes.',
        'It is also useful when readers are simple. A reader can open the target path and parse one complete file. The writer pays the ordering cost so readers do not need a recovery protocol for partial files.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Stopping after rename is the classic failure. Rename is atomic for visibility, but it is not the full portable durability story. If the parent directory was not forced, recovery may not preserve the name update on every platform and filesystem combination.',
        'The pattern does not create a multi-file transaction. Replacing config.json and index.json together can still leave one old and one new after a crash. Multi-object updates need a manifest generation, journal, database transaction, write-ahead log, or another higher-level commit protocol.',
        'It does not protect against bad bytes. If the program writes corrupt content, fsync and rename will preserve corrupt content very reliably. Validate or checksum the temp file before commit when malformed data is worse than stale data.',
        'It does not erase platform differences. Network filesystems, disk write caches, mount options, storage controllers, browser storage layers, and OS-specific fsync semantics can change the real contract. Durable code must read the platform contract it runs on.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Use a temp name that cannot be mistaken for committed state. Place it in the target directory so rename is same-filesystem and so directory fsync covers the final name update. Clean old temp files on startup using a clear naming convention.',
        'Check every return value. A safe-save path that ignores write errors, close errors, fsync errors, rename errors, or directory-open errors is only safe in comments. Low disk space, quota failures, interrupted syscalls, and permission changes belong in the error path.',
        'If readers require validation, write a checksum, length, schema version, or generation number inside the file. The replace protocol protects the file boundary. It does not tell the reader that the content is semantically valid.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'fsync can be slow because it forces an ordering boundary through buffering. On busy storage, cloud volumes, or laptops with power-management behavior, latency can be visible to users. Measure the real storage path before putting fsync in a hot loop.',
        'Batching can reduce cost, but it changes the promise. If a UI says "saved" before directory fsync completes, the product is choosing faster feedback over a strict crash-survival claim. That may be acceptable, but the claim should be honest.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Linux fsync(2), rename(2), open(2) O_TMPFILE notes, filesystem journaling, ext4 journal modes, SQLite pager design, write-ahead logging, content-addressed storage, and browser OPFS durability constraints. The shared theme is ordering: bytes, names, metadata, and recovery rules must line up.',
      ],
    },
  ],
};
