#!/usr/bin/env python3
"""ai_tell_scan.py - quick heuristic scan for common AI-writing tells (English + German).

Usage:
    python3 ai_tell_scan.py draft.txt
    cat draft.txt | python3 ai_tell_scan.py

Heuristics only. A clean scan proves nothing, a dirty one shows where to look.
"""
import re
import statistics
import sys

text = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
low = text.lower()
words = re.findall(r"[A-Za-zÄÖÜäöüß'-]+", text)
n_words = max(len(words), 1)

EM, EN = "—", "–"

# rough language guess
de_hits = len(re.findall(r"\b(und|der|die|das|nicht|ist|ich|mit|auch|sich|dass)\b", low))
en_hits = len(re.findall(r"\b(and|the|is|not|with|that|this|you|it|of)\b", low))
lang = "de" if de_hits > en_hits else "en"

# ---------- word lists (stems, matched at word start) ----------
WORDS_EN = """delv tapestr testament intricat meticulous pivotal realm showcas underscor
crucial vital landscape navigat foster leverag robust seamless holistic multifaceted
nuanc comprehensive elevat empower unlock harness embark bustling vibrant commendable
notabl additionally furthermore moreover boast garner resonat interplay enhanc streamlin
cutting-edge game-chang paramount noteworthy invaluable ever-evolving synerg spearhead
bolster captivat profound beacon myriad plethora enduring nestled renowned transformative
groundbreaking unwavering endeavo facilitat utiliz insightful intricacies align
revolutioniz dynamic innovative essential""".split()

WORDS_DE = """maßgeblich vielfältig nahtlos ganzheitlich facettenreich meilenstein unterstreich
unterstrich bereicherung mehrwert essenziell essentiell zudem somit letztendlich gewährleist
herausforderung potenzial innovativ spannend zeugnis eintauchen revolutionier dynamisch
vielseitig fördert förderung ermöglicht nachhaltig zukunftsweisend wegweisend""".split()

D = "[.,;:" + EM + EN + "-]"  # sentence-internal breaks incl. dashes

PHRASES = [
    # (label, regex)
    ("negative parallelism: 'not just X but Y'", r"\bnot (just|only|merely|simply)\b[^.?!\n]{0,90}\bbut\b"),
    ("negative parallelism: 'it's not X, it's Y'", r"\b(it'?s|this is|that'?s|it is|this isn'?t|it isn'?t)\s+not\b[^.?!\n]{0,70}" + D + r"\s*(it'?s|it is|this is|that'?s)\b"),
    ("negative parallelism: 'isn't X. It's Y'", r"\bisn'?t (just |only |about |merely )?[^.?!\n]{0,60}" + D + r"\s*(it'?s|it is)\b"),
    ("DE: 'nicht nur ... sondern auch'", r"\bnicht nur\b[^.?!\n]{0,110}\bsondern\b"),
    ("DE: 'es geht nicht um X, es geht um Y'", r"\bes geht nicht (nur )?(um|darum)\b[^.?!\n]{0,80}[.,;]\s*(es geht|sondern)\b"),
    ("participle tail (', highlighting ...')", r",\s+(highlighting|underscoring|reflecting|showcasing|emphasi[sz]ing|ensuring|contributing|fostering|demonstrating|illustrating|signal+ing|cementing|solidifying|paving|marking|making it|allowing|enabling|creating a)\b"),
    ("significance inflation", r"\b(stands? as a|serves? as a|a testament to|plays? an? (crucial|vital|pivotal|key|significant|important|central) role|marks? a (significant|pivotal|major)|leaves? a lasting|indelible|rich (history|heritage|tapestry|culture)|deeply rooted|cannot be overstated)\b"),
    ("DE significance inflation", r"\b(spielt eine (entscheidende|zentrale|wichtige|wesentliche|bedeutende) rolle|ein (wichtiger )?meilenstein|ein zeugnis (für|von)|nicht zu unterschätzen|von zentraler bedeutung)\b"),
    ("'important to note' hedge", r"\b(it'?s|it is) (important|worth|crucial|essential) to (note|remember|mention|consider)|\bworth noting\b|es ist (wichtig|erwähnenswert|wichtig zu beachten)|es sei (darauf hingewiesen|erwähnt)"),
    ("warm-up opener / signposting", r"\b(in today'?s|in an era|in the ever-|when it comes to|in the realm of|in the world of|imagine a|picture this|let'?s (dive|delve|explore|break)|here'?s the (thing|kicker|catch|deal)|here'?s (why|what|how)|the truth is|the reality is|buckle up|in der heutigen|in einer welt|tauchen wir|lass(t)? uns (eintauchen|einen blick)|wenn es um)\b"),
    ("summary / moral ending", r"\b(in conclusion|in summary|to sum up|all in all|at the end of the day|ultimately,|overall,|the future (looks|is) (bright|promising)|only time will tell|remains to be seen|whether you'?re a|zusammenfassend|abschließend|alles in allem|insgesamt lässt sich|am ende des tages)\b"),
    ("chatbot leftovers", r"(\bcertainly!|\babsolutely!|\bgreat question|\bas an ai\b|as of my (last|knowledge)|\bi'?d be happy to|\bi hope this helps|\blet me know if|\bfeel free to|\bhappy to help|\bgerne helfe ich|\bich hoffe, das hilft|\[(your|insert|name|company|dein|ihr)[^\]]*\])"),
    ("vague attribution", r"\b(experts (say|agree|believe|suggest)|studies (show|suggest)|research (shows|suggests)|some (critics|people|argue)|it is (widely|generally) (believed|accepted)|many (believe|argue)|experten (sagen|sind sich einig)|studien zeigen)\b"),
    ("colon / question reveal", r"\b(the (result|answer|catch|kicker|twist|best part|problem|secret|truth|reason|takeaway|bottom line))[?:]|\bdas ergebnis[?:]|\bder clou[?:]"),
    ("false range 'from X to Y'", r"\bfrom (?![^,.;\n]*\d)[a-z][^,.;\n]{2,40} to [a-z][^,.;\n]{2,40}"),
    ("stock transition", r"\b(darüber hinaus|des weiteren|in diesem zusammenhang|im folgenden|nicht zuletzt|in addition to this|on top of that|that being said|with that in mind)\b"),
    ("'This + verb' sentence opener", r"(^|[.!?]\s+)(this|dies) (highlights|underscores|shows|demonstrates|ensures|allows|means|makes|reflects|zeigt|unterstreicht|verdeutlicht|ermöglicht|sorgt)\b"),
]

hits = []
for stem in WORDS_EN + WORDS_DE:
    for m in re.finditer(r"\b" + re.escape(stem) + r"[\wäöüß-]*", low):
        hits.append(("style word", m.group(0)))
for label, rx in PHRASES:
    for m in re.finditer(rx, text, flags=re.IGNORECASE | re.MULTILINE):
        hits.append((label, m.group(0).strip()[:80]))

# ---------- rule of three ----------
triplets = re.findall(r"\b[\wäöüß-]+(?: [\wäöüß-]+)?, [\wäöüß-]+(?: [\wäöüß-]+)?,? (?:and|or|und|oder) [\wäöüß-]+", text)

# ---------- formatting ----------
em = text.count(EM)
spaced_en = text.count(" " + EN + " ")
bold = len(re.findall(r"\*\*[^*]+\*\*", text))
bold_label_bullets = len(re.findall(r"^\s*(?:[-*•]|\d+\.)\s+\*\*[^*]+:?\*\*:?", text, flags=re.M))
headings = len(re.findall(r"^#{1,6} ", text, flags=re.M))
emoji = len(re.findall("[\U0001F300-\U0001FAFF☀-➿]", text))
curly = text.count("“") + text.count("”")
german_quotes = text.count("„")

# ---------- rhythm ----------
sentences = [s for s in re.split(r"(?<=[.!?])\s+|\n+", text) if len(re.findall(r"\w+", s)) >= 1]
lens = [len(re.findall(r"[\wäöüß'-]+", s)) for s in sentences]
paras = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
plens = [len(re.findall(r"\w+", p)) for p in paras]

def cv(xs):
    return statistics.pstdev(xs) / statistics.mean(xs) if len(xs) > 1 and statistics.mean(xs) else 0.0

starts = {}
for s in sentences:
    w = re.findall(r"[\wäöüß']+", s.lower())
    if w:
        starts[w[0]] = starts.get(w[0], 0) + 1
rep_starts = {k: v for k, v in starts.items() if v >= 3 and v / max(len(sentences), 1) > 0.15}

# ---------- report ----------
per100 = len(hits) / n_words * 100
print(f"Words: {n_words} | sentences: {len(sentences)} | paragraphs: {len(paras)} | language guess: {lang}")
print()
print("RHYTHM")
if lens:
    print(f"  sentence length: mean {statistics.mean(lens):.1f}, min {min(lens)}, max {max(lens)}, variation (CV) {cv(lens):.2f}")
    short = sum(1 for x in lens if x <= 6) / len(lens) * 100
    long_ = sum(1 for x in lens if x >= 25) / len(lens) * 100
    print(f"  short (<=6 words): {short:.0f}% | long (>=25 words): {long_:.0f}%")
    if len(lens) >= 5 and cv(lens) < 0.40:
        print("  !! flat rhythm: sentences are too similar in length (CV under 0.40)")
if len(plens) >= 3:
    print(f"  paragraph length variation (CV): {cv(plens):.2f}" + ("  !! paragraphs too uniform" if len(plens) >= 4 and cv(plens) < 0.30 else ""))
if rep_starts:
    print(f"  !! repeated sentence openers: {rep_starts}")
print()
print("FORMATTING")
print(f"  em dashes: {em} ({em / n_words * 1000:.1f} per 1000 words)" + ("  !! cut these" if em else ""))
if lang == "en" and spaced_en:
    print(f"  spaced en dashes used as em dashes: {spaced_en}")
if bold:
    print(f"  bold spans: {bold}")
if bold_label_bullets:
    print(f"  !! bold-label bullets ('- **Label:** text'): {bold_label_bullets}")
if headings:
    print(f"  markdown headings: {headings}  (fine in a doc, a tell in a message/email/essay)")
if emoji:
    print(f"  emoji: {emoji}")
if lang == "de" and curly and not german_quotes:
    print("  !! English-style curly quotes in German text (expected „...“)")
if lang == "de" and em:
    print("  !! unspaced em dash in German text (German writers use a spaced en dash)")
print()
print(f"RULE OF THREE: {len(triplets)} 'X, Y and Z' lists ({len(triplets) / n_words * 1000:.1f} per 1000 words)")
for t in triplets[:6]:
    print(f"  - {t}")
print()
print(f"PATTERN HITS: {len(hits)} ({per100:.1f} per 100 words)")
grouped = {}
for label, frag in hits:
    grouped.setdefault(label, []).append(frag)
for label, frags in sorted(grouped.items(), key=lambda kv: -len(kv[1])):
    uniq = list(dict.fromkeys(frags))
    print(f"  [{len(frags)}] {label}: " + " | ".join(uniq[:8]))
print()
flags = per100 + (2 if lens and len(lens) >= 5 and cv(lens) < 0.40 else 0) + em / n_words * 100 + bold_label_bullets
verdict = "reads clean (by these heuristics)" if flags < 1 else "a few tells, fix the flagged spots" if flags < 3 else "reads as AI, rewrite rather than patch"
print(f"VERDICT: {verdict}")