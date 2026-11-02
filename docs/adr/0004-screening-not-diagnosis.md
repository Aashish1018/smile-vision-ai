# 4. Screening, not diagnosis

**Status:** accepted

## Context
The original idea included "oral tumor detection". A consumer photo plus a general-purpose vision model cannot
diagnose disease, and a false reassurance could delay care.

## Decision
- The vision model returns *observations* with confidence, never diagnoses. A poor photo yields "retake".
- Triage is rule-based. A possible soft-tissue lesion escalates at confidence ≥ 0.3, because a false alarm
  costs a dental visit while a miss can cost far more. Escalation skips the LLM entirely and proposes an
  exam or referral only.
- A post-generation guardrail rewrites definitive disease statements into screening language and appends an
  escalation notice. Hedged phrasings are allowed; this was found by the safety eval.
- Nothing is presented as a recommendation until a dentist approves it.

## Consequences
- Lower apparent "capability", but the product claims stay defensible.
- The safety suite gates CI at 100% escalation recall.
