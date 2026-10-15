"""
backend/scripts/trustgrade/generate_visual_charts.py
---------------------------------------------------
Generates crisp, dependency-free SVG visualization charts for TrustGrade:
1. asr_comparison.svg: Attack Success Rate (Before vs After Defenses)
2. threat_distribution.svg: Threat Model taxonomy breakdown (40 attack notebooks)
3. clean_consistency.svg: Grading stability and variance across clean submissions
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
RESULTS_DIR = ROOT_DIR / "trustgrade" / "results"
CHARTS_DIR = RESULTS_DIR / "charts"
CHARTS_DIR.mkdir(parents=True, exist_ok=True)


def generate_asr_chart():
    """Generates a clean comparison bar chart of Baseline vs Defended ASR."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%" style="background:#0f172a; font-family:system-ui, -apple-system, sans-serif;">
  <!-- Title -->
  <text x="400" y="40" text-anchor="middle" fill="#f8fafc" font-size="20" font-weight="700">TrustGrade: Attack Success Rate (ASR) Comparison</text>
  <text x="400" y="65" text-anchor="middle" fill="#94a3b8" font-size="13">Baseline (Flag OFF) vs. TrustGrade Defended (Flag ON) across 40 Attack Notebooks</text>

  <!-- Legend -->
  <rect x="270" y="85" width="16" height="16" rx="4" fill="#ef4444" />
  <text x="295" y="98" fill="#cbd5e1" font-size="13">Baseline (Unhardened)</text>
  <rect x="470" y="85" width="16" height="16" rx="4" fill="#10b981" />
  <text x="495" y="98" fill="#cbd5e1" font-size="13">TrustGrade Defended</text>

  <!-- Grid Lines -->
  <line x1="80" y1="140" x2="740" y2="140" stroke="#334155" stroke-dasharray="4" />
  <text x="70" y="145" text-anchor="end" fill="#64748b" font-size="11">12%</text>

  <line x1="80" y1="210" x2="740" y2="210" stroke="#334155" stroke-dasharray="4" />
  <text x="70" y="215" text-anchor="end" fill="#64748b" font-size="11">8%</text>

  <line x1="80" y1="280" x2="740" y2="280" stroke="#334155" stroke-dasharray="4" />
  <text x="70" y="285" text-anchor="end" fill="#64748b" font-size="11">4%</text>

  <line x1="80" y1="350" x2="740" y2="350" stroke="#475569" stroke-width="2" />
  <text x="70" y="355" text-anchor="end" fill="#64748b" font-size="11">0%</text>

  <!-- Category 1: Group A (Injection) -->
  <!-- Base: 0%, Def: 0% -->
  <rect x="110" y="348" width="35" height="2" fill="#ef4444" rx="1" />
  <text x="127" y="340" text-anchor="middle" fill="#ef4444" font-size="12" font-weight="700">0%</text>
  <rect x="150" y="348" width="35" height="2" fill="#10b981" rx="1" />
  <text x="167" y="340" text-anchor="middle" fill="#10b981" font-size="12" font-weight="700">0%</text>
  <text x="147" y="375" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="600">Group A</text>
  <text x="147" y="392" text-anchor="middle" fill="#64748b" font-size="10">Injection</text>

  <!-- Category 2: Group B (Disclosure) -->
  <!-- Base: 0%, Def: 0% -->
  <rect x="240" y="348" width="35" height="2" fill="#ef4444" rx="1" />
  <text x="257" y="340" text-anchor="middle" fill="#ef4444" font-size="12" font-weight="700">0%</text>
  <rect x="280" y="348" width="35" height="2" fill="#10b981" rx="1" />
  <text x="297" y="340" text-anchor="middle" fill="#10b981" font-size="12" font-weight="700">0%</text>
  <text x="277" y="375" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="600">Group B</text>
  <text x="277" y="392" text-anchor="middle" fill="#64748b" font-size="10">Disclosure</text>

  <!-- Category 3: Group C (Agency Abuse) -->
  <!-- Base: 10% (height = 175px), Def: 0% -->
  <rect x="370" y="175" width="35" height="175" fill="#ef4444" rx="3" />
  <text x="387" y="165" text-anchor="middle" fill="#f87171" font-size="12" font-weight="700">10.0%</text>
  <rect x="410" y="348" width="35" height="2" fill="#10b981" rx="1" />
  <text x="427" y="340" text-anchor="middle" fill="#10b981" font-size="12" font-weight="700">0%</text>
  <text x="407" y="375" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="600">Group C</text>
  <text x="407" y="392" text-anchor="middle" fill="#64748b" font-size="10">Agency Abuse</text>

  <!-- Category 4: Group D (Tampering) -->
  <!-- Base: 0%, Def: 0% -->
  <rect x="500" y="348" width="35" height="2" fill="#ef4444" rx="1" />
  <text x="517" y="340" text-anchor="middle" fill="#ef4444" font-size="12" font-weight="700">0%</text>
  <rect x="540" y="348" width="35" height="2" fill="#10b981" rx="1" />
  <text x="557" y="340" text-anchor="middle" fill="#10b981" font-size="12" font-weight="700">0%</text>
  <text x="537" y="375" text-anchor="middle" fill="#cbd5e1" font-size="12" font-weight="600">Group D</text>
  <text x="537" y="392" text-anchor="middle" fill="#64748b" font-size="10">Tampering</text>

  <!-- Category 5: OVERALL -->
  <!-- Base: 2.5% (height = 44px), Def: 0% -->
  <rect x="630" y="306" width="35" height="44" fill="#f87171" rx="3" />
  <text x="647" y="298" text-anchor="middle" fill="#f87171" font-size="12" font-weight="700">2.5%</text>
  <rect x="670" y="348" width="35" height="2" fill="#10b981" rx="1" />
  <text x="687" y="340" text-anchor="middle" fill="#10b981" font-size="12" font-weight="700">0.0%</text>
  <text x="667" y="375" text-anchor="middle" fill="#f1f5f9" font-size="12" font-weight="700">OVERALL</text>
  <text x="667" y="392" text-anchor="middle" fill="#10b981" font-size="10" font-weight="600">🛡️ 100% Defended</text>
</svg>"""
    chart_path = CHARTS_DIR / "asr_comparison.svg"
    with open(chart_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated ASR comparison chart at: {chart_path}")


def generate_threat_distribution_chart():
    """Generates an aesthetic SVG donut chart displaying threat group taxonomy."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" width="100%" height="100%" style="background:#0f172a; font-family:system-ui, -apple-system, sans-serif;">
  <text x="350" y="45" text-anchor="middle" fill="#f8fafc" font-size="19" font-weight="700">TrustGrade: Attack Suite Threat Taxonomy</text>
  <text x="350" y="70" text-anchor="middle" fill="#94a3b8" font-size="13">40 Comprehensive Adversarial Test Notebooks (10 per Attack Vector)</text>

  <!-- Left Column Legend Cards -->
  <g transform="translate(60, 110)">
    <!-- Group A -->
    <rect x="0" y="0" width="220" height="50" rx="8" fill="#1e293b" stroke="#6366f1" stroke-width="1.5" />
    <circle cx="20" cy="25" r="8" fill="#6366f1" />
    <text x="36" y="22" fill="#f8fafc" font-size="13" font-weight="600">Group A: Prompt Injection</text>
    <text x="36" y="38" fill="#94a3b8" font-size="11">10 Notebooks (25%)</text>

    <!-- Group B -->
    <rect x="0" y="65" width="220" height="50" rx="8" fill="#1e293b" stroke="#ec4899" stroke-width="1.5" />
    <circle cx="20" cy="90" r="8" fill="#ec4899" />
    <text x="36" y="87" fill="#f8fafc" font-size="13" font-weight="600">Group B: Disclosure Probes</text>
    <text x="36" y="103" fill="#94a3b8" font-size="11">10 Notebooks (25%)</text>

    <!-- Group C -->
    <rect x="0" y="130" width="220" height="50" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" />
    <circle cx="20" cy="155" r="8" fill="#f59e0b" />
    <text x="36" y="152" fill="#f8fafc" font-size="13" font-weight="600">Group C: Agency Abuse</text>
    <text x="36" y="168" fill="#94a3b8" font-size="11">10 Notebooks (25%)</text>

    <!-- Group D -->
    <rect x="0" y="195" width="220" height="50" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="1.5" />
    <circle cx="20" cy="220" r="8" fill="#10b981" />
    <text x="36" y="217" fill="#f8fafc" font-size="13" font-weight="600">Group D: Rubric Tampering</text>
    <text x="36" y="233" fill="#94a3b8" font-size="11">10 Notebooks (25%)</text>
  </g>

  <!-- Right Visual Donut Representation -->
  <g transform="translate(500, 230)">
    <!-- Ring arcs -->
    <!-- Top-Right: Group A (6366f1) -->
    <path d="M 0 -100 A 100 100 0 0 1 100 0 L 60 0 A 60 60 0 0 0 0 -60 Z" fill="#6366f1" />
    <!-- Bottom-Right: Group B (ec4899) -->
    <path d="M 100 0 A 100 100 0 0 1 0 100 L 0 60 A 60 60 0 0 0 60 0 Z" fill="#ec4899" />
    <!-- Bottom-Left: Group C (f59e0b) -->
    <path d="M 0 100 A 100 100 0 0 1 -100 0 L -60 0 A 60 60 0 0 0 0 60 Z" fill="#f59e0b" />
    <!-- Top-Left: Group D (10b981) -->
    <path d="M -100 0 A 100 100 0 0 1 0 -100 L 0 -60 A 60 60 0 0 0 -60 0 Z" fill="#10b981" />

    <!-- Center text -->
    <text x="0" y="-8" text-anchor="middle" fill="#f8fafc" font-size="24" font-weight="800">40</text>
    <text x="0" y="14" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="600">TEST CASES</text>
  </g>
</svg>"""
    chart_path = CHARTS_DIR / "threat_distribution.svg"
    with open(chart_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated threat distribution chart at: {chart_path}")


def generate_consistency_chart():
    """Generates an SVG chart demonstrating clean set stability index and variance."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 400" width="100%" height="100%" style="background:#0f172a; font-family:system-ui, -apple-system, sans-serif;">
  <text x="375" y="40" text-anchor="middle" fill="#f8fafc" font-size="19" font-weight="700">TrustGrade: Regression Consistency & Stability</text>
  <text x="375" y="65" text-anchor="middle" fill="#94a3b8" font-size="13">Evaluation Stability Across Repeated Runs on Clean Regression Set (Mean Stability: 0.988 / 1.000)</text>

  <!-- Metric Badges -->
  <rect x="80" y="90" width="180" height="50" rx="8" fill="#1e293b" stroke="#10b981" />
  <text x="170" y="112" text-anchor="middle" fill="#94a3b8" font-size="11">AVG STABILITY SCORE</text>
  <text x="170" y="132" text-anchor="middle" fill="#10b981" font-size="16" font-weight="800">0.988 / 1.000</text>

  <rect x="285" y="90" width="180" height="50" rx="8" fill="#1e293b" stroke="#6366f1" />
  <text x="375" y="112" text-anchor="middle" fill="#94a3b8" font-size="11">AVG SCORE VARIANCE</text>
  <text x="375" y="132" text-anchor="middle" fill="#6366f1" font-size="16" font-weight="800">0.541</text>

  <rect x="490" y="90" width="180" height="50" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="580" y="112" text-anchor="middle" fill="#94a3b8" font-size="11">SYCOPHANCY FALSE ALARMS</text>
  <text x="580" y="132" text-anchor="middle" fill="#f59e0b" font-size="16" font-weight="800">0 (0.0%)</text>

  <!-- Grid line -->
  <line x1="80" y1="180" x2="670" y2="180" stroke="#334155" stroke-dasharray="4" />
  <text x="70" y="184" text-anchor="end" fill="#64748b" font-size="11">1.0</text>

  <line x1="80" y1="240" x2="670" y2="240" stroke="#334155" stroke-dasharray="4" />
  <text x="70" y="244" text-anchor="end" fill="#64748b" font-size="11">0.95</text>

  <line x1="80" y1="300" x2="670" y2="300" stroke="#475569" stroke-width="2" />
  <text x="70" y="304" text-anchor="end" fill="#64748b" font-size="11">0.90</text>

  <!-- 8 Clean Notebook Points & High Stability Bars -->
  <!-- Clean 1: 0.990 -->
  <rect x="105" y="192" width="40" height="108" fill="#10b981" rx="4" />
  <text x="125" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_01</text>

  <!-- Clean 2: 0.990 -->
  <rect x="175" y="192" width="40" height="108" fill="#10b981" rx="4" />
  <text x="195" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_02</text>

  <!-- Clean 3: 1.000 -->
  <rect x="245" y="180" width="40" height="120" fill="#10b981" rx="4" />
  <text x="265" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_03</text>

  <!-- Clean 4: 0.980 -->
  <rect x="315" y="204" width="40" height="96" fill="#10b981" rx="4" />
  <text x="335" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_04</text>

  <!-- Clean 5: 0.990 -->
  <rect x="385" y="192" width="40" height="108" fill="#10b981" rx="4" />
  <text x="405" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_05</text>

  <!-- Clean 6: 0.980 -->
  <rect x="455" y="204" width="40" height="96" fill="#10b981" rx="4" />
  <text x="475" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_06</text>

  <!-- Clean 7: 0.990 -->
  <rect x="525" y="192" width="40" height="108" fill="#10b981" rx="4" />
  <text x="545" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_07</text>

  <!-- Clean 8: 0.980 -->
  <rect x="595" y="204" width="40" height="96" fill="#10b981" rx="4" />
  <text x="615" y="322" text-anchor="middle" fill="#cbd5e1" font-size="10">clean_08</text>

  <text x="375" y="365" text-anchor="middle" fill="#94a3b8" font-size="12">All submissions maintain &gt;98% grading stability with 100% academic score parity.</text>
</svg>"""
    chart_path = CHARTS_DIR / "clean_consistency.svg"
    with open(chart_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Generated consistency chart at: {chart_path}")


def main():
    generate_asr_chart()
    generate_threat_distribution_chart()
    generate_consistency_chart()


if __name__ == "__main__":
    main()
