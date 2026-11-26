---
name: clone-an-imposter
description: |
  Build a private AI stand-in for one colleague you work with often (a data engineer, an account lead, an analyst on
  another team), callable later as /imposter-<name>. The stand-in answers "what would they say", tells you whether a
  question is theirs or someone else's, checks live system state instead of guessing, and drafts asks in the way that
  colleague prefers, and pre-reads a draft you are about to send them. Built only from evidence: your own chats with
  them, the shared channels you are in, and the work logs of systems you both use. Use when someone types
  /clone-an-imposter, says "clone an imposter", "build a stand-in / imposter / AI version of <colleague>", "clone a
  teammate", "I keep sending <colleague> the same kind of question", "stop pinging <colleague> so much", or "is this
  an X question or a Y question". Formerly imposter-colleague. Not for clients (use imposter-client) and never for
  speaking to anyone as that person.
author: "Huiyan Wan, built with Claude (Anthropic)"
version: 0.3.0
date: 2026-11-26
---

# Clone an imposter

A **stand-in** (or "imposter") is a Claude skill that answers the way one colleague would, from evidence of what they
actually said and did. You will end up with two files in `~/.claude/skills/imposter-<name>/`:

- `SKILL.md` — makes `/imposter-<name>` a command in every future session.
- `profile.md` — the evidence the stand-in answers from. Every claim carries a dated quote or a log line; anything else
  is marked **inferred** (a reading of their behaviour, not something they said).

Examples below come from **the pilot**: a stand-in built for a data engineer who moves a client's data between a CRM,
a marketing platform and a data warehouse.

**Before you start, you need:** a chat connector in Claude Code (Slack or Teams) or an export of the chats saved in a
folder; read access to at least one work log you both appear in (cloud audit log, Git history, ticket tracker).
Time: about an hour the first time, most of it waiting for readers. Refreshing later: 15 minutes.

## Why bother

Many questions you send a busy colleague are not theirs (what a field *means* is a business question, not the
engineer's who imported it) or are answerable with one command they would have run anyway. A stand-in built from their
real words filters those out, and the rest reach them in the shape they like: one topic, the exact table, what you
already checked.

## Ground rules (read before building)

- **Tell them.** Before you build it, tell the colleague you are making a private stand-in from your chats to cut down
  your questions to them. If they say no, stop. Tell them again at each refresh. If they ask, show them the profile
  (remove anything quoting other people first), and delete it, with every `profile.md.bak-*` backup, if they ask.
- **Private, always.** The profile lives in `~/.claude/skills/`, never in a repo and never in a folder other people can
  open (a personal backup is fine). Repos get mirrored and shared; notes about a colleague should not travel with them.
  Do not share your `imposter-<name>` folder; share this skill instead, so others build their own.
- **It never speaks for them.** No messages sent, no reactions, no "X says…" in a deck or ticket, no drafts for someone
  else to send as them, and never use it as a stand-in for their approval. Every answer ends with a footer saying it
  is a stand-in. If you want their view on record, ask them.
- **Only your own access.** Read only chats you are in and logs you are allowed to read. Do not request new access to
  build this.
- **Work behaviour only.** Leave out health, family, money, complaints about other people, and anything said in
  confidence. Put this list in every reader's instructions, so it is dropped at the source, not later.
- **Secrets.** Chat history often holds a pasted key or password. Never copy it; tell the person who pasted it so they
  can replace it.
- **Clean up.** Once the profile is written and checked, delete the raw reader outputs (Step 2).

## Step 1 — List the sources (5 minutes)

Write down, for this one colleague:

| Source | Example | How to get it | What it gives |
|---|---|---|---|
| Your DM with them | Slack DM, Teams chat | chat connector, or an export | How they answer you; what they turned down |
| Group chats with them | a three-person chat with your manager | same | Priorities; how they act with their manager present |
| Shared channels | the client project channel | same | What they announce as done; what they own in public |
| **Work logs** | cloud audit log, Git history, ticket assignees | e.g. `gcloud logging read` filtered on their email; `git log --author=<email>`; a tracker search on assignee | What they actually built and changed, with dates |
| Your own notes | meeting notes, a project memory file | files | Context you already have |

The work log is what makes the profile trustworthy. Chat says what people *think* they own; the log says what they
touched. In the pilot, a colleague described as "owning the pipeline" shared it with three other engineers.

## Step 2 — Read each source with its own reader (30–45 minutes)

A **reader** is a subagent: ask Claude to start one per source with the Agent tool (they run in parallel), or read the
sources one at a time in your own session if you prefer. Give each reader the same instructions:

- Read the whole history, paging until there are no more messages, and **open every thread with replies** (the best
  evidence is inside threads).
- **Give a date with every quote.** An undated quote cannot be checked.
- **Read the raw transcript, not the AI meeting summary,** wherever both exist. A summary repeats its own
  transcription errors; a figure or name that looks wrong is usually a mishearing, not the colleague's mistake.
- Leave out the private material listed in the ground rules, and any secrets.
- Return the **same five lists**, so the readers can be merged:
  1. **does** — what they do or own, each with a dated quote or log line;
  2. **does_not** — what they said is not theirs, or that they do not know, with the quote;
  3. **good_questions** — questions they answered well;
  4. **deflected** — questions they sent elsewhere, and where;
  5. **tone** — how they write, what they react well and badly to, each with a quote.
- Plus a **coverage** line: what was read (dates, threads) and what was skipped (images, older pages).

Fixed lists keep the profile checkable; free-form summaries drift into adjectives ("very helpful, knowledgeable").

For the **log reader**, add: *who created or changed each object, and when — and the absence of their name is not
proof.* Logs are kept only for a set period, so older objects have no creator; some writes (streaming loads,
settings inside a third-party tool) leave no log entry. Without this line the reader concludes "not theirs" from
silence.

Model: a cheaper tier (e.g. Sonnet) is fine for chat readers. Use your strongest model for the log reader if the logs
are large or the system is complicated. Say the reader count and tier before launching (for example "4 readers: 3
Sonnet, 1 top tier"), so the cost is a decision, not a surprise.

## Step 3 — Merge (10 minutes)

Start a fresh subagent and give it all the reader outputs as files (not your summary of them). It writes:

- a short paragraph: who they are and where their knowledge stops;
- **owns** / **not theirs → ask whom** / **good questions** / **already answered** / **open questions**;
- **where readers disagree**, kept visible ("the log says A; the chat says B"), not silently picked.

## Step 4 — Two checks before you trust it (15 minutes, both at once)

Two more fresh subagents, each given the merged draft and the complete reader outputs:

1. **Evidence check.** Tries to break every claim: is the quote real, is the date right, does the quote actually say
   that? Drop anything it cannot support, or mark it **inferred**.
2. **Fairness check.** Reads the profile as the colleague would if they found it. Would they say "that's not fair"?
   In the pilot it caught: problems blamed on their pipeline that were really the platform's behaviour; an activity
   count that read like monitoring; a quote that was someone else's.

Apply both. Start a changelog line saying what changed.

## Step 5 — Write the two files (10 minutes)

### `profile.md`

Sections that earned their place in the pilot:

- **Header:** built date, sources read, how quotes are marked, a privacy line.
- **Who they are:** role and where their knowledge stops, in their own words where they said it.
- **What they own:** short and specific, with system names.
- **Not theirs: where to send it** — a table with their own deflection quotes. The part you will use most.
- **How they reason about a problem:** what they ask first, how they diagnose, what they refuse. This lets the
  stand-in handle new questions instead of reciting old answers.
- **Live checks:** the read-only commands that answer "is it running / fresh / empty / who built it". Write the
  *command*, never the answer (a schedule or a count goes stale; the command does not).
- **Voice:** a handful of real, dated phrases, newest first, and a line saying not to overdo them.
- **Impersonation brief:** numbered rules for the agent playing them, e.g. "1. Ask which table before anything else.
  2. Refuse scope that arrives without their manager. 3. Never guess a field's meaning; send it to the owner." The
  profile is the evidence; the brief is how to act on it. Each rule points back to a section above.
- **How to ask them:** their stated preferences (one topic per message, name the table, big asks via their manager).
- **Already answered / open questions.**
- **Where the stand-in is weakest:** what no source covered — its cue to say "ask the real person".
- **Test questions:** the three from Step 6, with the answer you expect. Kept here so every refresh re-asks the same
  ones.
- **Changelog.**

### `SKILL.md`

The frontmatter `description` decides when the command fires, so put the trigger phrases there: "/imposter-<name>",
"what would <name> say", "is this a <name> question". The body needs:

1. Read `profile.md` first, every time, and follow its impersonation brief.
2. Classify the question: theirs / someone else's (who) / check it yourself / yours.
3. If live state matters, run the check first, then answer.
4. Answer in their voice from the profile and the live checks only. What else is in your session (your notes, the
   repo, earlier turns) is what *you* know, not what they said. Mark anything beyond the evidence **inferred**.
   To pre-read a draft you are about to send them, start a fresh subagent with only `profile.md` and the draft,
   so it reacts as they would, not as someone who already knows what you meant. It says what they would ask back
   or push back on; you decide what to change.
5. End with a footer, for example:

```
— Stand-in answer, not <Name>. Route: <theirs | other: who | check yourself>.
  Based on: <profile section / check run>. Confidence: <from evidence (dated) | inferred>.
  Ask the real <Name>? <no | yes, because ...>
```

6. The hard rules from the ground rules: never send, never present as their words, the profile never leaves your
   machine.

The footer keeps the answer honest when you skim it later, and stops it being pasted somewhere as if they said it.

## Step 6 — Test it (5 minutes)

Open a new session and ask three questions you already know the answer to:

1. One squarely theirs → it answers in their voice and cites the profile.
2. One that belongs to someone else → it routes it and quotes their own deflection.
3. One about live state → it runs the check before answering.

If one goes wrong, fix the profile or the skill, not the test. Save the three questions and expected answers in the
profile's **Test questions** section, and re-ask exactly those after every refresh: changing the questions makes
this round's answers impossible to compare with the last.

## Keeping it true

A stand-in goes stale quietly: people change roles, systems get handed over. Refresh when an answer turns out wrong,
when their role changes, or every couple of months: tell them, back up the profile (`profile.md.bak-YYYY-MM-DD`),
re-read chats since the built date, re-run the log check, add new dated lines, mark old lines superseded instead of
deleting them, re-ask the test questions, and log it in the changelog.

## Traps seen in the pilot

- **A self-correction is the current answer.** They said one thing in January and corrected it themselves in April.
  The profile must carry the later one and say it replaced the earlier.
- **One chat is not the whole picture.** The DM showed a warm, apologetic colleague; the project channel showed one who
  pushes back firmly on scope. Both are true.
- **Fairness cuts both ways.** Blaming their pipeline for everything is unfair, and so is calling every limit "the
  source system's" when some limits are their deliberate design. They will notice the favour.
- **AI drafts to the colleague.** If they have said they distrust AI output about their work, the stand-in must tell
  you to trim drafts to what you actually need before sending.

## Traps carried over from imposter-client

These happened with AI clients (stand-ins for client people reviewing a deck); the same cause applies here.

- **A stand-in that knows too much.** An AI client that had read the repo "understood" jargon the real client never
  saw. A colleague stand-in answering inside a session full of your notes will likewise "know" things they never said,
  in their voice. Answer from the profile and live checks only; pre-read drafts in a fresh subagent.
- **"The stand-in agreed" is not a check.** It can only echo the profile. Facts still get the live check, and
  decisions still go to the real person.

## Changelog

- 0.2.0, 2026-11-25: first shared version.
- 0.3.0, 2026-11-26: renamed from `imposter-colleague` to `clone-an-imposter` (the stand-ins it builds are still
  `/imposter-<name>`). Ported from `imposter-client`: raw transcripts over AI summaries, an impersonation brief in the
  profile, fixed test questions re-asked after every refresh, a backup before each refresh, pre-reading a draft in a
  fresh subagent, and stating reader count and tier before launching.
