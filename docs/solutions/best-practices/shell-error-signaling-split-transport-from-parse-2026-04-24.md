---
title: "Shell error signaling: split transport failures from content-parse failures, and assert post-conditions before irreversible steps"
date: 2026-04-24
category: docs/solutions/best-practices
module: audiobook-m4b
problem_type: best_practice
component: tooling
severity: high
applies_when:
  - "Shell scripts that shell out to remote commands (ssh, curl, rsync, kubectl exec) and parse their output"
  - "Chaining an irreversible step (delete, quarantine, publish) after a prior step's exit code"
  - "A helper collapses both transport failures and parse failures into a single empty/default value"
  - "Designing exit code contracts for dispatcher or orchestrator scripts"
  - "Multi-stage pipelines where a later stage depends on a state transition performed by an earlier stage"
tags:
  - shell-scripts
  - error-handling
  - ssh
  - exit-codes
  - invariants
  - state-machines
  - claude-code-skills
  - post-condition-checks
related_components:
  - development_workflow
---

# Shell error signaling: split transport failures from content-parse failures, and assert post-conditions before irreversible steps

## Context

A ce-review audit of the `audiobook-m4b` Claude Code skill (`~/.claude/skills/audiobook-m4b/`) flagged two independent reliability bugs in its shell pipeline that turned out to be the same underlying mistake in two different dialects. Both were in production paths that either ran unattended on a cron-like cadence or deleted user source files on success — so cheap fault-signal confusion had expensive consequences.

**Finding #1 — `scripts/convert_on_titan.sh`, `read_current_load()`.** The pre-existing code shelled out over ssh to read `/proc/loadavg`, then swallowed every non-zero ssh exit into an empty string via `|| echo ""`. The downstream float-regex check then failed and the script exited 7 with the message "could not parse titan load average." The auditor flagged this as an **operational debuggability** defect: unreachable host, auth failure, missing `/proc/loadavg`, and a genuinely malformed awk output all produced the same stderr line and the same exit code, sending on-call down a parser-debugging path when the real fault was usually ssh transport.

**Finding #2 — `scripts/remote/run_m4b_tool.sh`, the publish→quarantine chain.** After calling `publish_to_library.sh`, the runner checked only the script's return code before advancing to the quarantine step (which deletes source files). The auditor flagged this as a **safety invariant** defect: the skill's core guarantee is "sources are only deleted when every step succeeded," but the code was trusting rc=0 as proof that `state=published` had actually been written to the manifest. Any silent bug in the publish script — schema drift, a skipped write, a partial failure that still exited 0 — would cause the runner to quarantine sources under a manifest that lied, leaving the user with no library artifact and no sources. During the 53-book stress test earlier the same week, `output_path` was observed missing from manifests on successful-looking runs (session history) — exactly the class of silent no-op this rule guards against, and the motivating real-world evidence that rc=0 can't be trusted as proof of state.

Both findings share the same root cause: a single signal was being asked to carry multiple distinct meanings, and a success-shaped signal was being treated as proof of a state transition it didn't actually witness.

## Guidance

Two concrete sub-rules for shell pipelines that cross process or transport boundaries.

### 1. Split transport failures from content-parse failures

An ssh (or rsync, or `kubectl exec`) non-zero exit is a different fault class than "transport succeeded, output was garbage." Give them distinct exit codes and distinct stderr messages. The anti-pattern smell is `|| echo ""` or `2>/dev/null || true` wrapping a remote command, followed by a parse step whose error message blames the output.

Before:

```bash
read_current_load() {
  if [[ -n "${ABM4B_FAKE_LOAD:-}" ]]; then
    # fake-load branch for tests
    ...
  else
    ssh_run "awk '{print \$1}' /proc/loadavg" 2>/dev/null || echo ""
  fi
}

raw_load="$(read_current_load)"
if ! [[ "$raw_load" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "❌ could not parse titan load average (got: \"$raw_load\")" >&2
  exit 7
fi
```

After:

```bash
read_current_load() {
  if [[ -n "${ABM4B_FAKE_LOAD:-}" ]]; then
    # fake-load branch unchanged
    return 0
  fi
  local out rc
  out="$(ssh_run "awk '{print \$1}' /proc/loadavg" 2>/dev/null)"
  rc=$?
  if (( rc != 0 )); then
    return 8  # distinct "ssh broken" signal
  fi
  printf '%s' "$out"
  return 0
}

set +e
raw_load="$(read_current_load)"
load_rc=$?
set -e
if (( load_rc == 8 )); then
  echo "❌ ssh to $SSH_HOST failed while reading titan load average" >&2
  exit 8
fi
if ! [[ "$raw_load" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "❌ could not parse titan load average (got: \"$raw_load\"). ssh succeeded but output was not a float" >&2
  exit 7
fi
```

### 2. Assert post-conditions after rc=0, before any irreversible next step

A successful exit code is weaker evidence than the post-condition it was supposed to produce. If the next step is destructive — deleting files, moving records, advancing a state machine — read the post-condition directly and verify it. The smell: "step A succeeded, therefore the thing A was supposed to do happened."

Before:

```bash
update_manifest state publishing
if ! bash "$PUBLISH_SCRIPT" "$MANIFEST" >>"$LOG" 2>"$pub_err"; then
  # publish failed, bail out
fi
rm -f "$pub_err"

# Fall through to quarantine — trusts rc=0 to mean state=published
update_manifest state quarantining
bash "$QUARANTINE_SCRIPT" "$MANIFEST" ...
```

After:

```bash
if ! bash "$PUBLISH_SCRIPT" "$MANIFEST" >>"$LOG" 2>"$pub_err"; then
  # publish failed, bail out
fi
rm -f "$pub_err"

# Confirm the publish script actually wrote state=published.
post_publish_state="$(read_field state)"
if [[ "$post_publish_state" != "published" ]]; then
  fallback_tail="$(python3 -c "import json,sys; print(json.dumps([sys.argv[1]]))" \
    "publish script rc=0 but state=$post_publish_state")"
  update_manifest state publish_failed \
    reason "publish script returned 0 but did not write state=published" \
    stderr_tail "$fallback_tail" finished_at "$(now)"
  exit 1
fi
```

### Exit code contract artifact

Concrete artifact of rule #1 — `convert_on_titan.sh`'s exit codes after the fix:

| Exit | Meaning |
|------|---------|
| 3    | parallel-count guard |
| 5    | load ≥ threshold after wait exhausted |
| 6    | duplicate-source in-flight |
| 7    | ssh succeeded but load output unparseable |
| 8    | ssh transport failure (new) |

Before the audit, rc=8 was unassigned (session history) — the transport and parse fault classes were both collapsed into rc=7. If you're working in this skill, rc=8 is now reserved.

## Why This Matters

**Operational debuggability.** When every failure mode funnels to the same signal, on-call burns hours on the wrong diagnosis. The previous exit-7 message ("could not parse titan load average") sent the first responder to look at awk, `/proc/loadavg` format changes, or the regex — when 90% of real-world occurrences were ssh transport (host down, key expired, network partition). Distinct exit codes collapse the first pager-response decision tree from "is the host down? is the disk full? is the parser broken? is the config stale?" to a single `echo $?` read. Exit 8 → check ssh. Exit 7 → check the remote command's output. Cheap insurance, large reduction in mean-time-to-diagnosis.

**Safety invariants.** Destructive steps downstream of a "success" amplify bugs rather than contain them. The skill's core invariant is "sources are only deleted when every step succeeded" — and that invariant was being enforced by trusting a subprocess's exit code rather than inspecting the state it was supposed to have written. A single `read_field state` check costs two lines and prevents an entire incident class of "we shipped the bug into production because rc=0 said it was fine." Return code is evidence. The post-condition is proof. When the next step is irreversible, you need proof.

## When to Apply

Apply both rules to:

- Any shell script that shells out to remote hosts (`ssh`, `rsync`, `scp`, `kubectl exec`, `docker exec`) and parses the output. Split transport-failure and parse-failure into distinct exit codes.
- Any pipeline where step N triggers an irreversible step N+1 (file deletion, row deletion, record publish, branch merge, quarantine). Read the post-condition before advancing.
- Any test-hook path (`ABM4B_FAKE_*` here, any `MOCK_*` or `FAKE_*` shim in general) that bypasses the real transport — the fake must return the same distinct signals the real path would, or your tests confirm a reality that doesn't exist.
- State-machine advances where a script's job is to write a state field — the caller must verify the field, not just the script's exit code.

Does **not** apply to:

- Read-only scripts whose only side effect is printing to stdout — one signal is fine, no post-condition exists to check.
- Internal pure-function helpers where transport and parsing are the same operation (no boundary crossed).
- Idempotent retry loops where the next iteration naturally re-verifies the post-condition.

## Examples

**Example 1 — transport vs parse separation** (from `convert_on_titan.sh`, `read_current_load()`):

```bash
# Before: every fault → empty string → exit 7
ssh_run "awk '{print \$1}' /proc/loadavg" 2>/dev/null || echo ""

# After: transport fault → exit 8; parse fault → exit 7
out="$(ssh_run "awk '{print \$1}' /proc/loadavg" 2>/dev/null)"
rc=$?
if (( rc != 0 )); then return 8; fi
printf '%s' "$out"
```

**Example 2 — post-condition assertion before destructive step** (from `run_m4b_tool.sh`):

```bash
# Before: rc=0 from publish → straight into quarantine (deletes sources)
bash "$PUBLISH_SCRIPT" "$MANIFEST" ...
bash "$QUARANTINE_SCRIPT" "$MANIFEST" ...

# After: rc=0 is not enough — verify state=published first
bash "$PUBLISH_SCRIPT" "$MANIFEST" ...
post_publish_state="$(read_field state)"
if [[ "$post_publish_state" != "published" ]]; then
  update_manifest state publish_failed reason "rc=0 but state=$post_publish_state"
  exit 1
fi
bash "$QUARANTINE_SCRIPT" "$MANIFEST" ...
```

**Test pattern note.** The regression test for finding #1 introduced `ABM4B_FAKE_SSH_FAIL=1` in the fake ssh stub so the same fault class the fix guards against (ssh exits non-zero) is reproducible in tests without needing a real unreachable host. This is the corollary of the rule: **if your test shim only models the happy path, your tests will keep passing through the exact class of failure you just fixed.** The fake must be able to emit every distinct signal the real transport can emit. Prior fakes in this skill (`ABM4B_FAKE_LOAD`, `ABM4B_SKIP_REMOTE`) only modeled successful ssh — part of why Finding #1 wasn't caught earlier (session history).

**Related failure modes observed in this skill's history** (session history): during the initial build of the remote probe script (`probe_sources.sh`), the `ssh titan bash -s <<'HEREDOC'` + `printf '$blob' | python3 - <<'PYEOF'` pattern also produced silent empty results — the heredoc stole stdin from the pipe. This was debugged for four rounds before being switched to a temp-file-based approach. Same pattern family as Finding #1: a transport-layer quirk (stdin hijacking) surfaced as "empty output, parser blames the data." Splitting transport concerns from content concerns early would have narrowed the diagnosis faster.

## Related

- [`docs/solutions/best-practices/supabase-functions-invoke-silent-success-guard-2026-04-22.md`](./supabase-functions-invoke-silent-success-guard-2026-04-22.md) — **Sibling pattern in a different transport.** Same underlying axiom ("transport success is not application success"): HTTP 200 from `supabase.functions.invoke` does not mean the function body succeeded; its body-error-guard rule is the HTTP analogue of the `read_field state` post-condition check here. Cross-reference for authors working in either shell or client JS.
- [`docs/solutions/best-practices/fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md`](./fail-closed-destructive-migrations-with-session-scoped-guc-2026-04-19.md) — Shares the fail-closed mindset for destructive steps (SQL migrations rather than shell pipelines).
