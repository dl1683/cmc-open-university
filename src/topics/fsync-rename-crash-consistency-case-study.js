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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a crash timeline. A page cache is memory where writes can sit before reaching storage, and durable storage is the place expected to survive power loss. Active nodes show the current syscall, compared nodes show what is visible versus what is durable, and found nodes show the state that would survive recovery.',
        'The safe inference rule is old or new, never torn. Before the rename, the target path must still recover to the old file. After the file fsync, rename, and parent-directory fsync have all succeeded, the target path must recover to the new file.',
        {type:'callout', text:'Crash consistency is an ordering problem: first make bytes durable, then make the name durable, and only then claim the replacement committed.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Crash consistency means the data layout after a crash still satisfies the promise the program made before the crash. A save operation that returns success should not leave a zero-byte config file after the next reboot.',
        'Filesystems often separate file contents from directory metadata. The bytes of a new file and the directory entry naming that file can reach storage at different times, so a correct update protocol must force both in the right order.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to open the target, truncate it, write the new bytes, close it, and report success. This works in normal testing because the process sees the new contents immediately through the operating-system cache.',
        'A slightly better attempt writes a temp file and renames it over the target. That fixes the visibility problem for live readers, because same-filesystem rename is atomic for the directory namespace.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that visibility is not durability. A reader can see the new name after rename while the storage device has not yet made the directory update crash-safe.',
        'Truncate in place has an even sharper failure. If a 10 KB settings file is truncated and only 3 KB reaches disk before power loss, recovery can find a valid filesystem containing an invalid application file.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat replacement as a two-object commit. The new file object must be durable first, and the parent directory entry that points the target name at that object must be durable second.',
        'The invariant is that the committed target path always names one complete generation. The old generation remains committed until rename, and the new generation is not claimed as crash-safe until the parent directory has been fsynced.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Create a temp file in the same directory as the target. Same directory matters because rename across filesystems can degrade into copy plus unlink, which does not have the same atomic namespace contract.',
        'Write the complete contents to the temp file and check for short writes or errors. Call fsync on the temp file so the bytes and the file metadata needed to find them reach stable storage.',
        'Call rename from temp path to target path, then open the parent directory and call fsync on that directory descriptor. The rename changes the namespace; the directory fsync makes that namespace change survive recovery.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Before the temp-file fsync, a crash can lose the new file, but the old target is still intact. After the temp-file fsync and before rename, a crash may leave a temp file to clean, but the committed target still names the old generation.',
        'After rename and before directory fsync, live readers see the new file, but the crash-survival claim is not complete. After directory fsync returns, both the new bytes and the target-name binding have crossed the durability boundary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The time cost is dominated by fsync latency, not by the rename. On fast local SSDs this can be sub-millisecond to a few milliseconds; on busy network or cloud storage it can be much slower and more variable.',
        'The space cost is one extra copy of the file during the update. If a 4 MB manifest is replaced, the directory briefly contains the old 4 MB target and the new 4 MB temp file. Doubling the file size roughly doubles write bandwidth and temporary space, while fsync still adds an ordering boundary.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits editor saves, configuration files, package-manager metadata, checkpoint pointers, model-serving manifests, and generated indexes. It is strongest when one path represents the current committed version and readers should not run a repair protocol.',
        'Databases use richer versions of the same idea. Write-ahead logs, page checksums, and commit records all separate preparation from commit so recovery can choose a complete generation instead of trusting a partial write.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The pattern is not a multi-file transaction. Replacing config.json and index.json with separate rename sequences can recover with one old file and one new file unless a higher-level manifest or journal defines the generation.',
        'It also does not validate the bytes. If the program writes corrupt JSON and then fsyncs and renames it, the protocol will preserve the corrupt JSON very reliably. Semantic validation, checksums, and version fields belong before the commit point.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service has config.json generation 41 with 12,000 bytes. It writes config.json.tmp generation 42 with 12,480 bytes, fsyncs the temp file, renames it to config.json, and fsyncs the directory.',
        'If power fails after 8,000 bytes of the temp file are written, recovery still uses generation 41 because rename has not happened. If power fails after rename but before directory fsync, the result depends on filesystem and storage semantics, so the program cannot honestly claim generation 42 is crash-safe until the directory fsync returns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Linux fsync(2), rename(2), open(2), and syncfs(2) man pages, plus filesystem documentation for ext4, XFS, APFS, NTFS, and the specific network filesystem in use. The portable lesson is to read the durability contract of the platform, not only the POSIX call names.',
        'Next study write-ahead logging, SQLite rollback journals and WAL mode, content-addressed storage, generation manifests, and browser OPFS durability. They all solve the same problem: define the state that recovery is allowed to find.',
      ],
    },
  ],
};
