# Tris Native architecture and security boundaries

## State separation

| Layer | Contents | Lifetime and authority |
|---|---|---|
| Immutable identity | Random ID, creation time, `agent-continuity` kind | Created once; unchanged by edits, reset, restore, migration, or import. Different identity requires delete/create or an explicit import into an empty store. |
| Editable profile | Display name, description | Owner-editable; never an authorization source. |
| Memory vault | Long-term, episodic, and project records; IDs, versions, timestamps, provenance, trust label | Encrypted durable data. Up to 5,000 records; 100,000 UTF-8 bytes per body. No embeddings, invented memories, hidden transcripts, or executable content. |
| Preferences | Bounded string key/value settings | Owner-controlled data. |
| Capability registry | IDs, versions, descriptions | Durable declarations only. Host supplies present-session availability separately. No executable function or permission is imported. |
| Permission grants | Named service → enumerated read/write scopes | Deny by default; cannot be edited by service handles. Imports, reset, and rollback revoke grants. |
| Snapshots | Schema-stamped copies of identity and editable state | At most 12; encrypted with the current archive. Restore checks identity and keeps the live audit history. |
| Audit | Sequence, UTC time, actor, action, target ID, previous hash, hash | Last 2,000 events plus an anchor hash. No passwords or memory bodies. |
| Runtime | Mount/session ID, available capabilities, scratch values, crypto key | Memory only. Dropped at lock/reload/reboot. Excluded from all exports and snapshots. |

The persistence unit is a whole encrypted archive, bounded to 16 MiB before encryption. This keeps state, snapshots, and audit in one atomic transaction. It is intentionally suited to personal agent memory, not an unbounded vector database. Each mutation validates a cloned candidate, appends audit metadata, encrypts it, compares the stored revision/ciphertext, and commits before accepting the new in-memory state.

## Encryption and integrity

The envelope specifies format, version, purpose, cipher, KDF, iteration count, salt, nonce, and revision. All header fields are AES-GCM additional authenticated data. A non-extractable AES-256 key is derived in platform Web Crypto using PBKDF2-HMAC-SHA256 at a fixed 600,000 iterations. Imported KDF parameters must match the supported format; attacker-controlled work factors are rejected. Backups use a separately chosen password, fresh salt, and fresh nonce. Passphrase rotation reencrypts the entire local archive, including snapshots.

AES-GCM authenticates the complete stored contents. Canonical SHA-256 audit hashes add inspectable event continuity inside that envelope. Neither mechanism proves truthfulness of a memory, independent authorship, biological consciousness, or a trustworthy wall clock. The password holder can author a different valid archive. The immutable identity contract is enforced by the state API and snapshot validation, not a remote identity authority.

Whole-vault replay cannot be detected solely from replayable local storage. `verify()` returns a revision, identity hash, and audit head that an integrating host can pin in independent trusted storage. No TPM counter or external append-only audit service is bundled. Audit retention truncates after 2,000 entries and advances the anchor explicitly; export archives for longer history. Reads and failed attempts made while sealed are not durable audit events because there is no unlocked audit key. Deletion removes the audit with the vault.

## Permissions and adapters

Owner methods remain in the UI closure. The global `TRIScoreTris` adapter exposes status, sealing, and the console identity read; owner operations and keys are not exposed there. `Vault.attach(service, available)` returns only methods checked against these scopes:

| Scope | Service operation |
|---|---|
| `identity:read` | Read immutable identity/profile; bounded session scratch slots |
| `memory:read` | Read memory copies, optionally filtered by kind/project |
| `memory:write` | Save/edit versioned memory records, attributed to the service |
| `preferences:read` | Read preference copies |
| `capabilities:read` | Read declarations plus this host's current availability |

There is no service scope for delete/reset, import/export, key rotation, granting permissions, or rollback. Revocation is checked on every handle call; sealing invalidates old handles. Runtime scratch values are capped at 100 slots and 100,000 UTF-8 bytes per value. The host is responsible for only handing a handle to the corresponding service. Same-realm JavaScript is trusted: these scopes are an application boundary, not isolation against malicious scripts, extensions, developer tools, or code executing as the OS user. Use separate processes and an authenticated IPC boundary before adding untrusted plugins. Do not expose an owner Vault object as an LLM tool.

Memory is explicitly `untrusted-data`. The UI uses text rendering, not HTML insertion. The state layer does not execute tools or connect a language model. The downstream agent must retain instruction/data separation when consuming stored memories.

## Commit and recovery semantics

- Browser: one IndexedDB read/write transaction compares expected ciphertext and writes the new envelope. Strict durability is requested when supported; fallback transaction completion still cannot promise survival of every sudden hardware failure. Abort signals cancel in-flight browser transactions when sealing.
- Node: exclusive writer lock, file flush, atomic same-directory rename, and POSIX directory flush. NTFS ACL checks replace ineffective Windows chmod assumptions. A stale lock blocks rather than risking two writers. Physical durability still depends on the filesystem/device; external backups remain required.
- Readers receive copies. Failed validation, failed encryption, conflicting writers, failed persistence, and unsupported schemas never intentionally overwrite the accepted ciphertext. A process failure after disk commit but before UI acknowledgement can mean a save succeeded even if no success message was shown; remount to check.
- Export logs a metadata event only once a portable encrypted envelope is prepared. The application cannot verify the browser's file download reached durable external media; the user verifies that.
- Import authenticates, validates, migrates if necessary, clears permissions, reencrypts for the new local key, and commits only into an empty destination. It does not write files supplied by paths in the imported data.

## What this protects, and what it does not

At-rest contents are protected from a party with ciphertext but without a strong passphrase. There is no plaintext persistence fallback. Clearing browser data, removing the application profile, losing all backup passwords, or hardware loss without a backup still loses continuity. Requesting persistent browser storage reduces eviction exposure but is not a backup.

An unlocked page necessarily has plaintext in memory and DOM. JavaScript garbage collection does not provide provable zeroization of strings or CryptoKey material; sealing drops references and clears visible fields, rather than claiming forensic erasure. The OS, browser, extensions, same-origin trusted modules, swap, and crash reporting remain part of the trusted computing base. Legacy Goblin journals and ordinary exports retain their original storage behavior; Tris encryption does not retroactively encrypt the rest of TRIScore.

## Implementation references

The platform contracts are documented in [Web Crypto AES-GCM encryption](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt), [password-based key derivation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), and [IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB). The implementation uses those primitives directly; it does not claim independent security certification.
