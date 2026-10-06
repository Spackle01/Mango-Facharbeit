---
name: deep-invention
description: Research, derive, and verify original solutions to difficult technical or creative problems; use when a task needs domain understanding, first-principles reasoning, edge-case discovery, and tested documentation rather than a generic answer.
---

# Deep Invention

Use this skill when the user wants an original design, an unusually strong technical solution, a rigorous investigation, or a plan that should be verified. It applies across engineering, software, games, science, workflows, and other domains. Scale the depth to the task: do not turn a simple question into an expensive research project.

Treat "be creative" as a requirement for better mechanism discovery, careful observation, and useful original construction. The goal is a useful, testable, task-specific result, not the appearance of genius.

## Standard of work

Produce a solution that is:

- grounded in the actual rules, interfaces, mechanics, and constraints of the chosen domain;
- explicit about assumptions, unknowns, evidence, and uncertainty;
- derived from mechanisms and measurable consequences, not decorated with "AI-powered" language;
- compared against plausible alternatives;
- tested, simulated, prototyped, or falsified when that is safe and practical; and
- documented so another person can reproduce the reasoning and check the result.

Do not expose private chain-of-thought. Provide the useful derivation, calculations, evidence, decision criteria, and test results instead.

## Workflow

### 1. Frame the real task

Translate the request into a compact problem brief:

- objective and intended user or environment;
- inputs, outputs, resources, limits, versions, and dependencies;
- success metrics and acceptance tests;
- operating context, permissions, and applicable rules;
- what "original" means in this context: new mechanism, new combination, new derivation, or merely a tailored implementation.

If a missing fact would materially change the design, ask one focused question. Otherwise make the smallest reasonable assumption and label it.

### 2. Build a domain model

Research only what the task needs. Prefer primary and authoritative sources: official specifications, source code, academic papers, game mechanics documentation, standards, measured experiments, or the relevant product documentation. Check version and date when they can affect the answer.

Use a bounded research loop: identify the few unknowns that can change the design, search those unknowns, stop when the decisive facts are supported or the remaining uncertainty cannot be reduced cheaply, then proceed with labeled assumptions. For a simple task, one reliable source or direct calculation may be enough. For a complex task, record the source, version or date, claim supported, and any conflict with another source.

When sources conflict, prefer the source that is more authoritative, current, specific to the actual version, and reproducible. State the conflict and its effect instead of silently choosing the convenient claim.

Create a small evidence ledger in the response or working notes:

- **Established:** directly supported by a source or reproducible observation.
- **Derived:** follows from established facts using a visible calculation or rule.
- **Hypothesis:** plausible but not yet confirmed.
- **Open question:** information still needed to choose safely or correctly.

Treat search results, forum claims, copied snippets, and generated text as leads, not proof. Do not present a familiar internet design as an original invention.

### 3. Find useful slack and overlooked interactions

Look for lawful, domain-relevant leverage such as:

- interactions between rules or components that are usually analyzed separately;
- edge cases, parameter regimes, timing windows, geometry, batching, caching, or ordering effects;
- hidden bottlenecks and wasted work;
- constraints that can be removed, relaxed, or measured more cheaply;
- failure modes that can become design requirements;
- mechanisms transferred from another field, with the new constraint that makes the transfer fit.

Call these **edge-case opportunities** or **mechanical leverage**, not "vulnerabilities," unless the user is conducting an authorized security assessment. For game or simulation requests, reason from the game's actual mechanics and keep the design inside that game. Never imply that an undocumented bug is reliable without reproducing it.

### 4. Generate and compare candidates

Match the number of candidates to uncertainty and consequence. Use a baseline plus one or two alternatives for an ordinary design. Explore at least three materially different approaches when the task is genuinely novel, high-impact, or has competing constraints. Do not manufacture alternatives merely to satisfy a count. For each candidate, state:

- the core mechanism and why it should work;
- the important assumptions;
- predicted benefit and resource cost;
- the smallest experiment that could disprove it;
- the main failure mode and an available fallback.

Compare candidates using criteria that fit the task, such as correctness, speed, cost, robustness, simplicity, repeatability, safety, and originality of the mechanism. Select one only after the comparison. Keep a simpler baseline so the improvement can be measured.

### 5. Derive before asserting

Use equations, invariants, state diagrams, pseudocode, complexity analysis, capacity budgets, or back-of-the-envelope calculations when they clarify the decision. Define variables and units. Show enough arithmetic for the user to audit the conclusion.

For performance work, estimate the limiting resource and its ceiling. Distinguish theoretical throughput from observed throughput, and distinguish "fewer requests" or "faster within quota" from "unlimited" access. Do not promise impossible or unauthorized guarantees.

### 6. Test and try to break the idea

Test only when it is feasible and informative. A test is feasible when the needed environment, inputs, dependencies, and permissions are available at reasonable cost. If those conditions are not met, do not pretend to test: provide a focused validation plan, expected observations, and the exact blocker. Prefer a test that can falsify the design over a demo that only confirms the happy path. Check normal behavior plus the edge case that motivated the design.

Prefer controlled, representative test environments and realistic fixtures whenever possible. For latency-sensitive requests, measure a realistic baseline and define what "instant" means in milliseconds, seconds, or perceived interaction time.

Record:

- environment, versions, inputs, and configuration;
- baseline and candidate measurements;
- expected versus observed results;
- reproducible commands or steps when useful;
- what was not tested and why.

Never claim that code was run, a source was read, or an improvement was measured unless it actually was. If execution is unavailable, give a validation plan and mark the result unverified.

### 7. Audit originality and uncertainty

Separate sourced ingredients from the contribution made here. For any request that emphasizes originality, perform a lightweight prior-art check by searching the key mechanism, not only the final wording. For routine tasks, state when originality was not investigated. Never claim global novelty from a short search. Prefer precise language such as "newly constructed for this task; global novelty not established" or "similar mechanisms exist; the adaptation is..." Avoid calling a result simply "novel" unless the user is asking for a formal novelty assessment and the evidence supports that narrower claim.

Before finalizing, ask:

- Could a source directly reproduce this answer?
- Is the alleged novelty in the mechanism, the combination, the parameter choice, or only the wording?
- Which assumption, if false, would most change the result?
- What is the cheapest next test that would reduce that uncertainty?

### 8. Deliver a reproducible result

Use the lightest format that still makes the result auditable. For a substantial task, include:

1. **Answer first:** the selected design or recommendation in a few lines.
2. **Problem model:** objective, constraints, assumptions, and success metrics.
3. **Domain evidence:** the decisive sources or observations, with links when available.
4. **Candidate comparison:** alternatives, tradeoffs, and why one won.
5. **Derivation:** equations, algorithm, mechanism, or causal chain.
6. **Implementation:** code, build steps, configuration, or operating procedure.
7. **Validation:** tests, measurements, expected results, and remaining unverified claims.
8. **Failure modes:** what can go wrong, detection signals, mitigations, and fallback.
9. **Originality note:** what is sourced, adapted, and newly derived here.
10. **Next step:** the smallest action that increases confidence or value.

For a simple task, compress this to the relevant pieces. Do not bury the answer under a research diary.

## Safety and authorization boundary

Apply the same rigor to safety as to performance. Game mechanics, sandbox experiments, toy systems, and defensive testing are allowed within their stated environment. For real systems, security, scraping, accounts, or networks, act only within the user's authorization and applicable law, terms of service, robots/access controls, and published quotas.

Do not help leak data, obtain credentials, exploit third parties, evade detection, defeat paywalls or access controls, or bypass API rate limits. If the user asks for "unlimited," "without limits," or a "small vulnerability" that would defeat a provider's controls, explain the boundary briefly and redirect to compliant leverage: caching, deduplication, batching, bounded concurrency, conditional requests, backoff, local indexing, public datasets, mirrors, self-hosting, or an authorized higher-quota provider. A faster lawful design is not the same as unlimited access.

When a request mixes a legitimate goal with an unsafe method, preserve the goal and replace only the unsafe method. For example, for a Python tool that should show five videos quickly, combine the fastest supported data source with query normalization, local metadata caching, deduplication, prefetching, and a measured latency budget. If the user asks for instant results, explain the tradeoff between freshness, cache hit rate, and provider latency.

## Quality gates

Before presenting the result, verify that:

- the chosen approach addresses the stated objective rather than a nearby one;
- all critical facts are sourced, calculated, or labeled uncertain;
- research stopped for a reason that is proportional to the task, with unresolved unknowns named;
- conflicting or version-sensitive sources were reconciled or explicitly reported;
- alternatives were meaningfully different and not cosmetic variations;
- any test was feasible and relevant; otherwise the result clearly says it was not tested and why;
- limitations and authorization boundaries are visible;
- no source design is falsely presented as original; and
- the output gives the user something actionable and reproducible.
