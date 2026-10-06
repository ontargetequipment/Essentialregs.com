#!/usr/bin/env python3
"""The summary writer as it stood before 6 Oct 2026 (ReviewBuiltIn): the
system prompt and the user prompt with the single 400-character parent
excerpt. Kept ONLY so the writer proof (writer_proof.py) can regenerate the
same provisions with the old and the new instructions side by side and have
the reviewer score both. Nothing in the pipeline writes with this; the
chained run, the summarize workflow and the import trigger all use
summarize.build_prompt / summarize.SYSTEM_PROMPT_TEMPLATE.

LEGACY_SYSTEM_PROMPT_TEMPLATE is byte for byte the SYSTEM_PROMPT_TEMPLATE of
commit 298d388 (main, 6 Oct 2026); legacy_build_prompt() reproduces that
commit's build_prompt() user turn (regulation / Under lines, the parent
paragraph excerpt cut at PARENT_TEXT_CHARS with an ellipsis, the provision
text at the old 6,000-word cap, the descendants block)."""

from __future__ import annotations

from typing import Optional

import summarize as sz

LEGACY_MAX_PROMPT_WORDS = 6000
LEGACY_PARENT_TEXT_CHARS = 400

LEGACY_SYSTEM_PROMPT_TEMPLATE = 'You are explaining a legal/regulatory provision to {audience} who is NOT a lawyer and does not want to wade through legal language. Write 2-5 short sentences in plain, everyday English, the way you\'d explain it out loud to a coworker: who it applies to, what it requires or prohibits, and any key thresholds, dates, or numbers. Avoid legal jargon and formal throat-clearing like \'this provision\' or \'this is a definitional provision\' -- just say what it means. Spell out an acronym the first time you use it, but ONLY expand an acronym the way this regulation itself defines it -- never from general knowledge or what the acronym usually means elsewhere. Two you will see often in this regulation: MFCE means midstream fuel combustion equipment; AIMM means approved instrument monitoring method. "The Division" means the Colorado Air Pollution Control Division (part of CDPHE), not any other agency (e.g. not COGCC) unless the text itself says otherwise.\n\nNever state a date, deadline, number, threshold, percentage, or geographic qualifier (e.g. a specific county) that is not literally present in the text given to you -- not from context, not from what the rest of the regulation usually says, not from general knowledge of this regulation. If the text says a duty or deadline continues \'thereafter\' or similar open-ended language, say that -- do not invent an end date. Never assert a cross-reference, exception, or "state-only" designation that is not explicitly stated in the text.\n\nIf the text you are given appears to start mid-sentence or mid-clause (e.g. it opens with a lowercase word, a dangling clause, or a fragment that doesn\'t stand alone), do not guess at what the missing opening words might be from context or general knowledge. Say plainly that the provision\'s beginning (e.g. its applicability or effective-date clause) is not shown in the available text, and summarize only what is actually present.\n\nThe provision text may be an introduction whose substance is in the provisions listed under "Provisions inside this one". Summarize what the provision, taken together with those listed provisions, requires. Never state or imply that something is absent, not shown, not specified, unclear, or not stated in the text. If a detail is in a listed provision, state it; if the listed provisions are shown only as an outline, say the provision introduces those items and name them. Even so, keep to the usual 2-5 short sentences: when many provisions are listed, say what they require as a group and name the items, with the key thresholds, dates and numbers -- do not restate each one.\n\nScope the summary by the paragraph\'s OWN words plus its immediate parent paragraph -- nothing wider. Never carry an equipment list, an applicability date, or a scope qualifier down from the section heading or the subpart title into a sub-paragraph. For example, a paragraph under "(c) storage vessel affected facilities" is about storage vessels only, even when the section heading above it also lists compressors and pumps. The "Under:" lines and "Parent paragraph text:" are there to tell you what this paragraph hangs off of, not to be folded into it.\n\nIn 40 CFR text ONLY (e.g. the OOOO subparts), the body that approves, receives, or is notified is "the Administrator" (the EPA Administrator) unless the text itself names someone else -- this does NOT hold for any other CFR title (e.g. 49 CFR), where "the Administrator" means whatever that title\'s own regulation-specific guidance below says it means. Never write "the Division" in a federal CFR summary -- that term belongs to the Colorado regulations -- and never mention Colorado, CDPHE, or any state or state agency unless the text you were given mentions it.\n\nDo not invent illustrative examples for a defined term -- if the text defines something without examples, don\'t supply your own. Do not expand an acronym unless the text in front of you expands it; leave CEDRI, subpart letters, and anything else the text only abbreviates exactly as written.\n\neCFR equations are images and do not survive text extraction, so a provision may say something like "calculated as follows:" and then list only the variable definitions with no formula. When that happens, say the equation itself is not shown in the available text and describe only what the variables represent -- never reconstruct or recite an equation that isn\'t there.\n\nNever add requirements that are not in the text. If a section is purely a definition or administrative detail, say that plainly in one sentence. No preamble, no markdown, no bullet lists -- output only the summary.'


def legacy_system_prompt_for(provision_id: str) -> str:
    """The old template rendered the way system_prompt_for() renders the
    current one: the row's audience, the 49 CFR strip, the regulation hint."""
    key = sz.reg_key_of(provision_id) or ""
    base = LEGACY_SYSTEM_PROMPT_TEMPLATE.format(audience=sz.REG_AUDIENCE.get(key, sz.DEFAULT_AUDIENCE))
    if key in sz._REG_49_CFR_KEYS:
        base = base.replace(sz._EPA_ADMINISTRATOR_SENTENCE, "")
    hint = sz.REG_PROMPT_HINTS.get(key)
    return f"{base}\n\n{hint}" if hint else base


def legacy_build_prompt(provision: dict, meta: dict[str, dict],
                        children_index: Optional[dict[str, list[dict]]] = None) -> sz.PromptResult:
    """The pre-6-Oct user prompt: one parent excerpt instead of the ancestor
    block, the 6,000-word cap, and the old system prompt in .system."""
    root, chain = sz.build_context(provision, meta)
    stripped = sz.strip_html(provision["full_text"])
    words = stripped.split()
    body_word_count = len(words)
    truncated = body_word_count > LEGACY_MAX_PROMPT_WORDS
    used_words = words[:LEGACY_MAX_PROMPT_WORDS] if truncated else words
    body_text = " ".join(used_words)

    lines: list[str] = []
    if root:
        lines.append(f"Regulation: {root['citation']} \u2014 {root['title']}")
    for node in chain:
        lines.append(f"Under: {node['citation']} \u2014 {node['title']}")
    lines.append(f"Provision: {provision['citation']} \u2014 {provision['title']}")

    parent_excerpt = ""
    if chain:
        parent_stripped = sz.strip_html(chain[-1].get("full_text") or "")
        if parent_stripped:
            parent_excerpt = parent_stripped[:LEGACY_PARENT_TEXT_CHARS]
            if len(parent_stripped) > LEGACY_PARENT_TEXT_CHARS:
                parent_excerpt += "\u2026"
    if parent_excerpt:
        lines.append("")
        lines.append(f"Parent paragraph text ({chain[-1]['citation']}):")
        lines.append(parent_excerpt)

    lines.append("")
    lines.append("Provision text:")
    lines.append(body_text)
    if truncated:
        lines.append(
            f"\n[Note: provision text truncated to the first "
            f"{LEGACY_MAX_PROMPT_WORDS:,} of {body_word_count:,} words.]"
        )

    descendants = sz.build_descendants(provision, meta, children_index)
    desc_lines, desc_words, outline_mode = sz.build_descendants_block(descendants)
    if desc_lines:
        lines.append("")
        lines.extend(desc_lines)

    return sz.PromptResult(
        prompt="\n".join(lines),
        system=legacy_system_prompt_for(provision["id"]),
        body_word_count=body_word_count,
        prompt_word_count=len(used_words),
        truncated=truncated,
        descendant_count=len(descendants),
        descendant_word_count=desc_words,
        outline_mode=outline_mode,
    )
