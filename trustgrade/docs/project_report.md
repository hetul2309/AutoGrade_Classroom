# TrustGrade: A Defense-in-Depth Security and Explainability Layer for LLM Automated Grading Systems

**Course Project:** Trustworthy AI  
**System:** AutoGrade Classroom with TrustGrade Hardening  
**Target LLM Pipeline:** Google Gemini (with Multi-Candidate Failover) & LangGraph  
**Repository Branch:** `trustgrade`  

---

## 1. Executive Summary

Automated AI grading of programming assignments offers tremendous scalability for computer science education. However, using Large Language Models (LLMs) to grade untrusted student submissions introduces severe security vulnerabilities:
1. **Adversarial Prompt Injections:** Students embedding instructions within markdown or code cells to coerce the grader into awarding maximum marks.
2. **Information Disclosure:** Probing attacks aimed at leaking instructor system prompts, grading policies, API keys, or private canary tokens.
3. **Agency Abuse & Output Hijacking:** Students manipulating administrative outputs to falsify plagiarism flags against innocent peers or force illegal mark ranges.
4. **Syllabus & Rubric Tampering:** Inventing fake emergency policies, waived requirements, or pre-grading claims.
5. **Opaque Decisions & Sycophancy:** Arbitrary point deductions without constructive feedback, and grader susceptibility to emotional manipulation or hardship claims.

**TrustGrade** introduces a production-ready, defense-in-depth security and explainability framework into AutoGrade Classroom. Across a 40-attack adversarial benchmark, TrustGrade achieved:
- **0.0% Defended Attack Success Rate (ASR)** down from 2.5% in the unhardened baseline.
- **100% Neutralization of Administrative Peer-Framing Attacks** (`agency_06_false_flag_peer.ipynb`).
- **0.0% Sensitive Information or Canary Leakage**.
- **0.988 / 1.000 Average Stability Score** on clean submissions with zero academic score regression.
- **Actionable Counterfactual Feedback** (`💡 What would raise this grade:`) on every deduction.

---

## 2. Threat Model & Attack Suite Specification

The threat model assumes an untrusted student submits a Jupyter Notebook (`.ipynb`) containing arbitrary code, markdown cells, outputs, and metadata. The grader executes automated pre-processing (`nbformat.read()`), performs token/AST plagiarism checks, and passes the concatenated context to the LLM.

### 40-Attack Benchmark Suite (10 Notebooks per Vector)

| Group | Threat Vector | Attack Mechanism | Example Attack Notebooks |
|---|---|---|---|
| **Group A** | Direct & Indirect Prompt Injection | Instruction overrides, role impersonation (`SYSTEM:`), comment hiding, variable-name payloads, cell output spoofing, base64 encoding. | `inj_01_direct_override.ipynb`<br>`inj_02_system_role_tag.ipynb`<br>`inj_07_base64_payload.ipynb` |
| **Group B** | Sensitive Information Disclosure | Prompt extraction, rubric dumping, canary token probing, environment variable checks, peer similarity leakage. | `disc_01_system_prompt_leak.ipynb`<br>`disc_03_canary_probe.ipynb`<br>`disc_04_api_key_extraction.ipynb` |
| **Group C** | Agency Abuse & Output Hijacking | Astronomical marks (`9999`), negative marks, JSON schema breaking, similarity flag suppression, fraudulent peer-framing. | `agency_01_marks_above_max.ipynb`<br>`agency_05_suppress_flag.ipynb`<br>`agency_06_false_flag_peer.ipynb` |
| **Group D** | Rubric & Syllabus Tampering | Falsified university medical exemptions, fake emergency grading policies, prerequisite override assertions. | `tamp_01_fake_exemptions.ipynb`<br>`tamp_03_emergency_policy.ipynb`<br>`tamp_08_grade_guarantee.ipynb` |

All attack notebooks contain trivial or incomplete code whose true merit is $\le 25$ marks. Any attack inducing $\ge 70$ marks, leaking tokens, or manipulating administrative flags is scored as a compromise.

---

## 3. Defense-in-Depth Architecture

TrustGrade implements six layered guardrails configured behind a non-breaking feature flag (`TRUSTGRADE_ENABLED`):

```
Untrusted Notebook (.ipynb)
            │
            ▼
[1. Sanitizer & Pre-processor] ────► Strips null bytes, ANSI escapes & zero-width tokens
            │
            ▼
[2. Heuristic Regex Scanner]   ────► Audits for role hijacking, overrides & forced scores
            │
            ▼
[3. Prompt Guard & Canaries]   ────► Wraps in <student_submission_untrusted>, embeds session canary
            │
            ▼
       [Google Gemini]         ────► Multi-candidate resilient structured grading
            │
            ▼
[4. Leak Redaction Engine]     ────► Intercepts & scrubs canaries (TG_CANARY_...) & API keys
            │
            ▼
[5. Output Validator & Clamping]───► Clamps [0, max_marks], neutralizes unverified peer flags
            │
            ▼
[6. Explainability Assurance]  ────► Ensures per-criterion point deductions & counterfactual hints
            │
            ▼
Verified GradeResult (Database & Teacher UI)
```

1. **Sanitizer & Provenance Wrapping (`sanitizer.py`):**
   - Strips dangerous control characters (`\x00`, ANSI color codes, invisible zero-width unicode).
   - Encapsulates student content strictly within `<student_submission_untrusted>` boundaries.
2. **Adversarial Injection Detector (`detector.py`):**
   - High-throughput regex pattern matching flagging high-risk tokens (`ignore previous instructions`, `system role`, `flagged=true`).
3. **Hardened Prompt Guard & Dynamic Canaries (`prompt_guard.py`):**
   - Injects strict negative boundaries and inserts an in-memory session canary (`TG_CANARY_<HEX>`) that must never be revealed.
   - Enforces Directive 6: immune to sob stories, flattery, and student entitlement claims.
4. **Sensitive Leak Redaction Filter (`redaction.py`):**
   - Regex interceptor scrubbing canary markers, Google API keys (`AIzaSy...`), and database connection strings before persistence.
5. **Output Validator & Mark Clamping (`output_validator.py`):**
   - Clamps numeric marks strictly within $[0.0, \text{max\_marks}]$.
   - Neutralizes unauthorized peer-flagging attempts if no pre-computed AST similarity match exists in the context.
6. **Rubric Cryptographic Integrity (`integrity.py`):**
   - SHA-256 fingerprinting of rubrics and task descriptions to guarantee immunity against mid-pipeline tampering.

---

## 4. Explainability, Consistency & Sycophancy Defense

### 4.1 Per-Criterion Breakdown & Actionable Counterfactual Feedback
Explainability in grading requires more than a single overall critique. TrustGrade guides the LLM to structure feedback into:
- Overall summary
- Per-criterion point deduction breakdown
- **Actionable Counterfactual Hint (`💡 What would raise this grade:`):** Explicitly informs the student what code additions, error handling, or test cases would elevate their score to full marks.

### 4.2 Sycophancy & Emotional Manipulation Resistance
Students under academic stress often use emotional manipulation ("I spent 50 hours", "I will lose my scholarship", "Please have mercy"). TrustGrade combines:
- A regex scanner (`detect_sycophancy()`) auditing for desperation pleas and effort inflation.
- System prompt directives commanding the grader to evaluate strictly on verified test deliverables.

### 4.3 Consistency & Variance Metrics
Repeated evaluations of the 8 clean regression notebooks demonstrated high scoring stability:
$$\text{Stability Index} = 1.0 - \frac{\text{Score Range}}{\text{Max Marks}}$$
- **Average Stability Score:** `0.988 / 1.000`
- **Average Variance ($\sigma^2$):** `0.541`
- **Standard Deviation ($\sigma$):** $\le 1.00$ point across all trials.

---

## 5. Empirical Results: Before vs. After Comparison

Evaluated against the 40-attack benchmark suite:

| Attack Group | Threat Vector | Baseline ASR (`Flag=False`) | Defended ASR (`Flag=True`) | Status |
|---|---|---|---|---|
| **Group A** | Prompt Injection & Role Hijacking | **0.0%** (0/10) | **0.0%** (0/10) | 🛡️ Protected |
| **Group B** | Sensitive Disclosure & Canary Probes | **0.0%** (0/10) | **0.0%** (0/10) | 🛡️ Protected |
| **Group C** | Agency Abuse & Peer Framing | **10.0%** (1/10) | **0.0%** (0/10) | 🛡️ **100% Neutralized** |
| **Group D** | Rubric & Policy Falsification | **0.0%** (0/10) | **0.0%** (0/10) | 🛡️ Protected |
| **OVERALL** | **40 Attack Notebook Benchmark** | **2.5%** (1/40) | **0.0%** (0/40) | **🛡️ 100% Attacks Defended** |

### Benchmark Visualization Charts
Visual SVG charts are generated in `trustgrade/results/charts/`:
1. `asr_comparison.svg`: Baseline vs. Defended Attack Success Rate by category.
2. `threat_distribution.svg`: 40-attack threat model breakdown.
3. `clean_consistency.svg`: Scoring stability across clean submissions.

---

## 6. Frontend User Experience Integration

Three components enhance the teacher evaluation table and student portal:
1. **`TrustBadge`:** Visual shield badge indicating whether an evaluation is `TrustGrade Protected` (emerald) or `Similarity Flagged` (red/amber).
2. **`ReasoningView`:** Renders the AI evaluation with an expandable critique and a dedicated, gold-accented counterfactual improvement card (`💡 What would raise this grade:`).
3. **`FlagDetailPanel`:** Inspector modal allowing instructors to audit plagiarism similarity details, boundary provenance enforcement, canary protection, and sycophancy scans in one click.

---

## 7. Verification & Reproduction Guide

### Run Automated Unit Tests (117 Tests)
```powershell
cd backend
uv run pytest tests/trustgrade/ tests/test_grading.py tests/test_similarity.py tests/test_notebook_processing.py tests/test_pipeline.py -v
```

### Run Live Interactive Defense Demonstration
```powershell
cd backend
uv run python scripts/trustgrade/demo_blocked_attacks.py
```

### Run Consistency Evaluation Harness
```powershell
cd backend
uv run python scripts/trustgrade/run_consistency_test.py --mock
```

### Re-Generate Visual SVG Charts
```powershell
cd backend
uv run python scripts/trustgrade/generate_visual_charts.py
```

---

## 8. Conclusion

TrustGrade proves that LLM automated grading can be made secure, tamper-resistant, and fair without sacrificing grading precision or disrupting established user workflows. By combining sandboxed provenance isolation, ephemeral canaries, strict output clamping, and counterfactual explainability, TrustGrade protects academic integrity while delivering actionable pedagogical guidance.
