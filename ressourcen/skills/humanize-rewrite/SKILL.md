---
name: humanize-rewrite
description: Rewrite AI-generated or AI-sounding text (English or German) so it reads like a real person wrote it. Keeps the facts, rebuilds structure, rhythm and wording.
---

<!-- mango-facharbeit:verwaltet – unverändert übernommen aus dem Skill „humanize-rewrite“ des Pakets (human-voice, humanize-rewrite, ai-tell-audit) -->

# Humanize rewrite

Use this when the user hands over existing text (from ChatGPT, Claude, a template, a stiff draft) and wants it to sound like a person wrote it. If the human-voice skill is available, its rules apply too. This skill is the rewrite procedure.

## The one rule that matters most

Don't edit sentence by sentence. Line edits keep the AI skeleton: the same paragraph template, the triplets, the parallel structure, the intro and outro. Synonym swapping alone makes it worse (thesaurus text reads strange, and in the RAID benchmark some detectors actually got more accurate after synonym swaps). Pull the content out, throw the shape away, rebuild.

## Steps

### 0. Settle the target
- Whose voice? The user's (use their voice profile or samples if given), a persona, or a channel default (see table at the end).
- What must survive: facts, required terms, length limits, assignment requirements.
- Language: English or German. Don't translate unless asked.

### 1. Strip to content
Make a plain list of what the text actually says. Mark each point:
- **real**: a fact, number, name, example, opinion, instruction
- **padding**: significance claims, generic statements, "it's important to note", recaps, future-looks-bright
Padding gets deleted, not rephrased. AI text is often 30–50% padding.

### 2. Find the gaps
Where the content is generic ("it improves collaboration"), the human version needs a specific: which tool, what happened, how much time it saved. Ask the user for those details, or keep the claim smaller and plainer. Never invent anecdotes, numbers, quotes or sources.

### 3. Rebuild
Write it fresh from the list, in the target voice:
- Lead with the most concrete or interesting point, not a warm-up.
- New order, new paragraph breaks, uneven paragraph sizes.
- Lists of three become two or four, or a sentence.
- Headings and bullets go unless the channel really uses them.
- Stop after the last real point.

### 4. Passes
**Sentences**
- Vary length on purpose: some under 6 words, some over 25.
- Kill participle tails (", highlighting X" → new sentence or cut).
- Kill "not X but Y" constructions. Just say Y.
- Passive → active. Nominalizations → verbs ("the implementation of" → "we built").
- Kill reveal tricks ("The result?") and "This + verb" openers.

**Words**, use the swap table below. Default to the plainest option or cut the word.

**Formatting**
- Em dashes → comma, period, colon, parentheses (German: spaced – if the writer uses dashes).
- Remove bold, emoji bullets, Title Case, markdown in plain-text channels.
- German: „…“ quotes.

### 5. Check
- Run the ai-tell-audit skill (or its checklist) on the result.
- Compare length. Human versions usually come out 10–30% shorter. Keep required lengths, though.
- Read it as the target person. Anything they'd never say gets rewritten.

## Swap table

| AI word / phrase | Say instead |
|---|---|
| delve into | look at, get into, go through |
| utilize / leverage | use |
| facilitate / enable | help, let, make possible |
| enhance / elevate | improve, make better (or say how) |
| crucial / vital / pivotal / paramount | important, key, or just cut it |
| showcase / highlight / underscore | show |
| foster | build, help, encourage |
| robust / comprehensive | solid, full (or say what it covers) |
| seamless(ly) | smooth(ly), without problems (or cut) |
| navigate (a challenge) | deal with, handle, get through |
| landscape / realm | field, area, market, scene |
| myriad / plethora | lots of, many, a bunch of |
| embark on a journey | start |
| additionally / furthermore / moreover | also, and, plus (or new sentence) |
| in order to | to |
| it is important to note that | (cut) |
| plays a crucial role in | matters for, drives, affects |
| stands as a testament to | shows |
| in today's fast-paced world | (cut) |
| in conclusion / overall | (cut, or just end) |
| maßgeblich | stark, vor allem |
| vielfältig / facettenreich | unterschiedlich, viele Arten von (oder konkret aufzählen) |
| nahtlos | reibungslos, ohne Probleme (oder streichen) |
| ganzheitlich | (streichen oder konkret sagen was alles) |
| Mehrwert | Vorteil, bringt ... |
| essenziell | wichtig, nötig |
| gewährleisten | sicherstellen, sorgen für |
| ermöglichen | lässt, hilft, geht damit |
| darüber hinaus / des Weiteren / zudem | außerdem, auch, und |
| spielt eine entscheidende Rolle | ist wichtig für, bestimmt |
| unterstreicht / verdeutlicht | zeigt |
| zusammenfassend lässt sich sagen | (streichen) |
| in der heutigen (digitalen) Welt | (streichen) |
| spannend | (konkret sagen, was daran interessant ist, oder streichen) |

## What NOT to do (common "humanizer" tricks)

- Random typos, swapped letters, homoglyphs (Cyrillic "а" for Latin "a"), zero-width characters. They make text look broken, and they're easy to catch: in RAID, GPTZero lost only 0.3% accuracy to homoglyphs.
- Forced slang or fake casualness in a formal channel.
- Making every text casual. A cover letter stays a cover letter.
- Wiping structure from texts that need it. A how-to can keep numbered steps.
- Stacking rhetorical questions to fake personality.

## Channel defaults

| Channel | Feel |
|---|---|
| Chat (WhatsApp, Discord) | short, lowercase ok, fragments, no sign-off |
| Email | greeting, point in the first two lines, 2–4 short paragraphs, plain sign-off |
| School essay | full sentences, own examples, clear argument, no buzzwords, conclusion adds a thought |
| LinkedIn / portfolio | first person, one concrete detail beats three adjectives |
| Forum / Reddit | direct, experience first, no intro |
| Product / gig text | what you get, how fast, one proof point, no hype |

## Output

Give the rewrite. Below it, at most three short lines: what you cut, and which spots would be stronger with a real detail from the user (as a question, not as a placeholder inside the text).
