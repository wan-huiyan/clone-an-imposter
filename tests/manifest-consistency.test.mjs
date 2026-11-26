/**
 * Manifest consistency, Pattern B (multi-skill plugin) layout.
 * Assertive checks: a missing manifest at the canonical path is a FAILURE, not a skip.
 * Adapted from wan-huiyan/promptback tests/manifest-consistency.test.mjs.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = "clone-an-imposter";

const marketplaceJsonPath = resolve(ROOT, ".claude-plugin/marketplace.json");
const pluginJsonPath = resolve(ROOT, `plugins/${PLUGIN}/.claude-plugin/plugin.json`);
const skillMdPath = resolve(ROOT, `plugins/${PLUGIN}/skills/${PLUGIN}/SKILL.md`);

function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^"|"$/g, "");
  }
  return out;
}

describe("layout", () => {
  it("marketplace.json exists at .claude-plugin/marketplace.json", () => {
    assert.ok(existsSync(marketplaceJsonPath), `missing: ${marketplaceJsonPath}`);
  });
  it("plugin.json exists inside plugins/<name>/.claude-plugin/", () => {
    assert.ok(existsSync(pluginJsonPath), `missing: ${pluginJsonPath}`);
  });
  it("SKILL.md exists at plugins/<plugin>/skills/<skill>/SKILL.md", () => {
    assert.ok(existsSync(skillMdPath), `missing: ${skillMdPath}`);
  });
  it("no stale root-level SKILL.md", () => {
    assert.ok(!existsSync(resolve(ROOT, "SKILL.md")));
  });
});

const marketplace = JSON.parse(readFileSync(marketplaceJsonPath, "utf-8"));
const plugin = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
const skillMd = readFileSync(skillMdPath, "utf-8");
const fm = frontmatter(skillMd);
const readme = readFileSync(resolve(ROOT, "README.md"), "utf-8");

describe("marketplace.json", () => {
  it("has exactly one plugin entry", () => assert.equal(marketplace.plugins.length, 1));
  it("plugins[0].name matches plugin.json name", () => assert.equal(marketplace.plugins[0].name, plugin.name));
  it("plugins[0].source is ./plugins/<name> and exists", () => {
    assert.equal(marketplace.plugins[0].source, `./plugins/${plugin.name}`);
    assert.ok(existsSync(resolve(ROOT, marketplace.plugins[0].source)));
  });
  it("marketplace name is owner-prefixed and differs from the plugin name", () => {
    assert.notEqual(marketplace.name, plugin.name);
    assert.ok(marketplace.name.endsWith(plugin.name));
  });
});

describe("the version agrees everywhere it is recorded", () => {
  const v = plugin.version;
  it("marketplace entry", () => assert.equal(marketplace.plugins[0].version, v));
  it("SKILL.md frontmatter", () => assert.equal(fm.version, v));
  it("package.json", () => assert.equal(JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")).version, v));
  it("VERSION file", () => assert.equal(readFileSync(resolve(ROOT, "VERSION"), "utf-8").trim(), v));
  it("README version history", () => assert.ok(readme.includes(`- **${v}** (`), `README has no '- **${v}** (' line`));
});

describe("SKILL.md", () => {
  it("name matches the plugin name", () => assert.equal(fm.name, plugin.name));
  it("description is a block scalar", () => assert.match(skillMd, /description:\s*\|/));
});

describe("README", () => {
  it("never mentions a fake install command", () => {
    assert.ok(!/claude\s+install[- ]skill|claude\s+skill\s+install/.test(readme));
  });
  it("the plugin install line uses <plugin>@<marketplace>", () => {
    assert.ok(readme.includes(`claude plugin install ${plugin.name}@${marketplace.name}`));
  });
  it("every repo path in the manual-copy block exists", () => {
    const paths = [...readme.matchAll(/\/tmp\/clone-an-imposter\/(\S+)/g)].map((m) => m[1]);
    assert.ok(paths.length, "the install block should name the skill directory to copy");
    for (const p of paths) assert.ok(existsSync(resolve(ROOT, p)), `README names a missing path: ${p}`);
  });
});

describe("anonymity of the shared skill", () => {
  // The pilot was built for a real colleague on a real client. Nothing that names them, the client or
  // their systems may reach the shared copy. The banned words are stored as truncated SHA-256 hashes so
  // this public test does not itself name them. EXACT: whole words; PREFIX: ids that start with the word.
  // To add a word: node -e 'console.log(require("crypto").createHash("sha256").update("word").digest("hex").slice(0,16))'
  const EXACT = new Set(["5a9cea259640cac7", "5d7f15f2fce8ddb2", "a076593bdd9cd3cc", "76e2a85a7e58be28", "3ccbd9105a45d8fc", "a179f4a8f6f43995", "764a51ba6de8ebf2", "321006198f6bfd71", "5a7b2e919d9eb13c", "40cafc18e93464f8", "d979885447a413ab", "a9010fd21a93c687", "b0b23803279f82a2", "1e313d3d03fe7e3d", "632ac42cebea65ef", "5ef68465886fa04d", "10b05c446ea776cd", "64120c0959d0d46d"]);
  const PREFIX = new Set(["5d81f2ffd4308efa", "b61055cf81822da6", "15fd25ef919af05f"]);
  const h = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  function hits(text) {
    const out = [];
    for (const tok of text.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []) {
      for (const t of new Set([tok, ...tok.split("-")])) {
        if (EXACT.has(h(t))) out.push(t);
        for (let n = 4; n <= Math.min(6, t.length); n++) if (PREFIX.has(h(t.slice(0, n)))) out.push(t);
      }
    }
    return out;
  }
  for (const [label, text] of [["SKILL.md", skillMd], ["README.md", readme]]) {
    it(`${label} names no real person, client or client system`, () => {
      const found = hits(text.replace(/^author:.*$/m, ""));
      assert.deepEqual(found, [], `banned word(s) in ${label}: ${found.join(", ")}`);
    });
  }
  it("the guard can fire (negative control, on a canary word)", () => {
    assert.deepEqual(hits("a stand-in for Zzcanary on the project"), ["zzcanary"]);
  });
});
