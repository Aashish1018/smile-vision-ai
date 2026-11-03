# 5. Deterministic rails around the care-plan agent

**Status:** accepted

## Context
LLM-drafted treatment plans fail in predictable ways: invented treatments, uncited claims, wrong clinical
order, hallucinated prices, and proposing two treatments for the same problem.

## Decision
The LangGraph graph gives the LLM exactly one job, `draft`. Code then:
1. drops codes outside the menu allowed for the observed findings, and steps without a valid citation, sending
   errors back for a redraft (at most 2 attempts);
2. prunes redundant cosmetic steps by least-invasive set cover, moving them to alternatives (disease control
   is never pruned);
3. orders steps clinically (stabilise → restore → align → whiten → cosmetic);
4. prices from the clinic's sheet;
5. pauses on `interrupt()` for the dentist, with the checkpoint stored in Postgres.

## Evidence
With a real 3.8B model (phi3), the draft proposed aligners *and* bonding for one small gap, an estimate of
₹88,500–272,000. After rule 2, aligners became an alternative and the estimate was ₹16,500–43,000. A regression
test reproduces the case.

## Consequences
- Small local models become usable, because failures are caught by code rather than by the patient.
- Clinical rules live in reviewable code and tests rather than in prompt wording.
