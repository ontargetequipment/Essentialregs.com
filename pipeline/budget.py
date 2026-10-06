#!/usr/bin/env python3
"""The standing spending rule, enforced in code.

Owner decision (Brody, 5 Oct 2026): the pipeline may spend up to
STANDING_BUDGET_USD per regulation per run on summaries, review and embedding
combined without asking. If the dry-run estimate for a regulation is above
that, the run makes no paid call and stops with a message asking for owner
approval. The only override is a workflow input `approved_budget`, which the
run prints at the top of its report.

This module is the one place the number lives. summarize.py, review.py,
embed.py and run_chain.py all take a Budget and:

  * add every stage's pre-submit estimate per regulation (`estimate`), then
    ask `over_estimate()` before the first paid call -- a non-empty answer
    means stop, nothing submitted;
  * record actual spend per regulation as results come back (`spend`), and
    ask `exceeded()` after each batch -- a non-empty answer means stop, the
    remaining batches are cancelled and the remaining rows stay pending.

Costs are attributed to the regulation of the provision they were spent on
(`summarize.reg_key_of`), so a run that spans several regulations holds each
to its own budget."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

STANDING_BUDGET_USD = 10.0
STANDING_RULE = ("Standing rule (Brody, 5 Oct 2026): up to $10 per regulation per run on summaries, "
                 "review and embedding combined; above that the run stops and asks.")
STAGES = ("summarize", "review", "embed")


class BudgetStop(Exception):
    """Raised where a caller prefers an exception to a check; carries the
    message the run prints."""


@dataclass
class Budget:
    usd_per_reg: float = STANDING_BUDGET_USD
    source: str = "standing rule"               # or "approved_budget workflow input"
    estimates: dict = field(default_factory=dict)   # reg -> stage -> usd
    spent: dict = field(default_factory=dict)       # reg -> stage -> usd
    stopped: Optional[str] = None               # the message when the budget stopped the run

    # -- estimates -----------------------------------------------------------
    def estimate(self, reg: str, stage: str, usd: float) -> None:
        self.estimates.setdefault(reg or "?", {})[stage] = self.estimates.get(reg or "?", {}).get(stage, 0.0) + usd

    def estimated(self, reg: str) -> float:
        return sum(self.estimates.get(reg, {}).values())

    def over_estimate(self) -> list[tuple[str, float]]:
        """Regulations whose estimated total exceeds the budget."""
        return [(reg, self.estimated(reg)) for reg in sorted(self.estimates)
                if self.estimated(reg) > self.usd_per_reg + 1e-9]

    # -- actual spend --------------------------------------------------------
    def spend(self, reg: str, stage: str, usd: float) -> None:
        bucket = self.spent.setdefault(reg or "?", {})
        bucket[stage] = bucket.get(stage, 0.0) + usd

    def set_spent(self, reg: str, stage: str, usd: float) -> None:
        """Replace a stage's running total (for stages that report a
        cumulative figure rather than increments)."""
        self.spent.setdefault(reg or "?", {})[stage] = usd

    def spent_total(self, reg: str) -> float:
        return sum(self.spent.get(reg, {}).values())

    def exceeded(self) -> list[tuple[str, float]]:
        """Regulations whose actual spend has passed the budget."""
        return [(reg, self.spent_total(reg)) for reg in sorted(self.spent)
                if self.spent_total(reg) > self.usd_per_reg + 1e-9]

    def total_spent(self) -> float:
        return sum(self.spent_total(r) for r in self.spent)

    def total_estimated(self) -> float:
        return sum(self.estimated(r) for r in self.estimates)

    # -- messages ------------------------------------------------------------
    def stop_message_estimate(self, over: list[tuple[str, float]]) -> str:
        parts = ", ".join(f"{reg}: ${usd:,.2f}" for reg, usd in over)
        return (f"STOP: the dry-run estimate exceeds the budget of ${self.usd_per_reg:,.2f} per regulation "
                f"({self.source}) for {parts}. No paid call was made and nothing was written. "
                f"To run it anyway, re-run with the approved_budget input set to an amount the owner has "
                f"approved for this run.")

    def stop_message_spend(self, over: list[tuple[str, float]]) -> str:
        parts = ", ".join(f"{reg}: ${usd:,.2f}" for reg, usd in over)
        return (f"STOP: actual spend passed the budget of ${self.usd_per_reg:,.2f} per regulation "
                f"({self.source}) for {parts}. The remaining batches were cancelled and the remaining "
                f"rows stay pending; re-run with an approved_budget the owner has approved.")

    def header_lines(self) -> list[str]:
        """The lines a report prints at its top."""
        return [f"- Budget: ${self.usd_per_reg:,.2f} per regulation per run across summarize, review and embed "
                f"({self.source}). {STANDING_RULE}"]

    def table_lines(self) -> list[str]:
        regs = sorted(set(self.estimates) | set(self.spent))
        lines = ["| regulation | estimate | " + " | ".join(f"spent: {s}" for s in STAGES) + " | spent total | budget |",
                 "|---|---:|" + "---:|" * len(STAGES) + "---:|---:|"]
        for reg in regs:
            cells = [f"${self.spent.get(reg, {}).get(s, 0.0):,.4f}" for s in STAGES]
            lines.append(f"| {reg} | ${self.estimated(reg):,.2f} | " + " | ".join(cells)
                         + f" | ${self.spent_total(reg):,.4f} | ${self.usd_per_reg:,.2f} |")
        return lines


def budget_from_args(approved: Optional[float]) -> Budget:
    """The run's budget: the standing rule unless an approved_budget was
    given, in which case that figure (and its source) is used."""
    if approved is None:
        return Budget()
    return Budget(usd_per_reg=float(approved), source="approved_budget workflow input")
