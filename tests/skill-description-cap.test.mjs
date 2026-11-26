/**
 * Skill description cap. Claude Code injects every skill's name + description into
 * context on every turn, cut mid-word at 1,536 chars. Trigger phrases past the cut
 * are dead. Runs the gate vendored from wan-huiyan/context-police (via publish-skill).
 * Fails, never skips, when python3 is missing.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARKETPLACE = JSON.parse(readFileSync(resolve(ROOT, ".claude-plugin/marketplace.json"), "utf-8"));
const SRC = MARKETPLACE.plugins[0].source.replace(/^\.\//, "");
const GATE_REL = `${SRC}/scripts/check_skill_descriptions.py`;
const GATE = resolve(ROOT, GATE_REL);

function runGate() {
  assert.ok(existsSync(GATE), `the gate must ship inside the plugin source dir: ${GATE_REL}`);
  for (const bin of ["python3", "python"]) {
    const res = spawnSync(bin, [GATE, ROOT, "--json"], { encoding: "utf-8" });
    if (res.error) continue;
    assert.notEqual(res.status, 2, `gate failed to run: ${res.stderr}`);
    return { data: JSON.parse(res.stdout), status: res.status };
  }
  assert.fail(`python3 is required to run ${GATE_REL}`);
}

describe("skill description cap", () => {
  let gate;
  before(() => { gate = runGate(); });
  it("finds the skill", () => assert.ok(gate.data.counts.model_invocable > 0));
  it("no description is over the cap", () => assert.equal(gate.data.skills.filter((s) => s.over).length, 0));
  it("no trigger phrase is lost to truncation", () =>
    assert.equal(gate.data.skills.filter((s) => s.lost_triggers.length).length, 0));
  it("no hyphenated token is split by a line wrap", () =>
    assert.equal(gate.data.skills.filter((s) => s.wrap_corruption.length).length, 0));
  it("keeps at least 20 chars of headroom", () => {
    for (const s of gate.data.skills) assert.ok(gate.data.cap - s.desc_chars >= 20, `${s.name}: too close to the cap`);
  });
  it("gate exits 0", () => assert.equal(gate.status, 0));
  it("CI runs the gate at the same path", () => {
    const wf = readFileSync(resolve(ROOT, ".github/workflows/test.yml"), "utf-8");
    assert.ok(wf.includes(`python3 ${GATE_REL} . --no-color --triggers`));
  });
});
