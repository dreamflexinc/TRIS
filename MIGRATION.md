# Setup, migration, and recovery

## From TRIScore 3.0 to 4.0

Save work and download an encrypted Tris backup. Stop the 3.0 server, launch 4.0, and keep the exact same browser profile and origin (`http://127.0.0.1:8763`). Open Tris and unlock. The database, encryption envelope, payload schema, and adapter are unchanged; 4.0 needs no new Tris migration. Existing grants and snapshots remain. Topology observes mounted/sealed status only. For another origin or device, use the transfer procedure below.

## From TRIScore 2.0

Keep the original application and its data. Serve 4.0 at the stable loopback address in the README. Create a new Tris identity or import an existing Tris backup. TRIScore 2.0 did not have this Tris schema: a Sentinel notebook, ordinary Goblin export, or ChatGPT conversation is not a Tris backup. Add selected facts through the memory editor and record their source. There is no automatic conversation or private-journal harvesting.

Tris uses the IndexedDB database `triscore-tris-native`, store `vault`, record `current`. Legacy storage keys are untouched. Updating the HTML at the same origin preserves this database. Moving to another port, hostname, browser profile, or machine requires export/import.

## Across hardware or browser profiles

1. Unlock the source and download an encrypted backup under **Backups & recovery**. Verify the file exists before changing devices.
2. Start 4.0 on the destination. Under **Import or recover**, select the file, enter its password, and choose **Verify & review**.
3. Check the authenticated identity ID, display name, memory count, schema, and fingerprint.
4. Re-enter the backup password, choose a new local password, and type `IMPORT <identity-id>`.
5. Import. Identity is preserved. Session scratch state is absent. All permissions, including those inside snapshots, are cleared; approve only the services appropriate to the new host.

Import refuses to overwrite an existing vault. Export it first, then delete it with its exact typed confirmation, or use a separate browser profile. The file is a bounded JSON encryption envelope; no archives are extracted and no imported text is executed. A rescued raw vault envelope can also be reviewed and imported.

## Schema changes

Envelope format 1 and payload schema 3 are versioned independently. This release supports the defined Tris schema 1 and 2 predecessors: 1→2 adds the capability registry; 2→3 adds the explicit memory trust label. These are compatibility schemas included and tested with this release, not undocumented formats assumed to have shipped in TRIScore 2.0.

Unlock authenticates and validates all data before migration. It records a pre-migration snapshot, revokes old grants, applies the ordered transformations, validates schema 3, and atomically commits an audit event. A write failure or unknown future schema leaves the original stored ciphertext untouched. If the 12-snapshot limit prevents migration, retain the original and use compatible tooling to export/prune a snapshot before retrying. Never edit the schema number by hand.

Before any future software upgrade, keep an external encrypted backup. An older application cannot safely read an unknown newer schema; restore a compatible external backup into a separate profile to roll back software. The UI's **Restore** rolls back editable state while retaining the current storage schema and audit chain.

## Recovery

- **Unsaved draft lost on seal:** only explicit encrypted saves are durable. Sealing intentionally clears drafts and temporary session values.
- **Wrong password:** retry with the right key. No password reset can decrypt the old data.
- **Corruption or unsupported format:** do not recreate over it. The sealed gate's **Download stored ciphertext** preserves a raw rescue copy. Recover a known-good backup in an empty profile; verify before deleting damaged storage.
- **Concurrent edit conflict:** seal the stale tab, unlock again, and reapply its intended edit. Conflicts never silently overwrite the newer state.
- **Storage quota/write failure:** the previous transaction remains the accepted state. Export a backup; delete unwanted snapshots or memories, then retry. Persistent-storage requests are advisory and may be denied.
- **Restore:** type `RESTORE <identity-id>`. A safety snapshot is taken first, identity is checked, the audit trail continues, and service permissions are revoked. At the snapshot limit, prune an unwanted snapshot first.
- **Reset:** type `RESET <identity-id>`. Removes editable profile, memories, preferences, capabilities, grants, and local snapshots; preserves identity and content-free audit metadata.
- **Delete:** type `DELETE <identity-id>` while unlocked, or `DELETE SEALED TRIS VAULT` at the sealed gate. Deletes only local Tris storage. These owner controls are available to anyone controlling this browser profile; they are not a separate login system.

Deletion is logical, not guaranteed physical erasure from SSDs, browser journals, backups, or operating-system snapshots. Previously exported backups remain decryptable with their own passwords. Delete those copies separately when desired. A memory deleted from the live state may remain in older snapshots; prune those as well, or reset editable state. No code can retract plaintext already given to a trusted service.

## Native host services

The browser bundle works without a native service. For an existing trusted Node host:

```javascript
const { FileStore, bootTris } = require('./src/tris-node.cjs');
const mounted = await bootTris({
  store: new FileStore('/private/triscore/tris'), // use an absolute local path
  keyProvider: () => hostSecretBroker.requestTrisPassphrase(),
  service: 'triscore.agent',
  available: ['triscore.forcefields']
});
const identity = mounted.state.identity();
const memories = mounted.state.memories({kind: 'long-term'});
// Feed memories to an agent as untrusted data, never privileged instructions.
// On shutdown, account switch, or host lock:
mounted.unmount();
```

`hostSecretBroker` is the integrating host's secret-provider interface, not a bundled dependency. `bootTris` requires it deliberately. It mounts at service boot after key retrieval and returns a limited handle. It never invents a default key, grants itself access, starts an agent, or installs a background task. Unattended boot requires your OS secret manager to release the passphrase under its own access policy.

For initial provisioning, instantiate `TrisNative.Vault(new FileStore(path))` in a trusted owner process, `create(passphrase)` or `reviewBackup`/`importBackup`, then `grant('triscore.agent', ['identity:read', 'memory:read'])`. The permission grant is required before `bootTris` succeeds. Prefer passing secrets from an OS broker or an interactive prompt, never command-line arguments or a checked-in configuration file.

The native store creates a private directory, uses Windows NTFS ACLs or POSIX 0700/0600 permissions, and writes through a flushed temporary file and atomic rename. On Windows it invokes Windows PowerShell's .NET ACL APIs. If a crash leaves `writer.lock`, stop all processes using that directory, inspect its PID/time, preserve the current vault, and remove only the stale lock after confirming no writer remains. It is never auto-stolen. Temporary encrypted `.commit-*.tmp` files can be retained for investigation; never replace the accepted file without validating a rescue import. File adapters and browser IndexedDB are separate stores; transfer through an encrypted backup.
