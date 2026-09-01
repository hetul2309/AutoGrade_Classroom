"""
demo_grade.py
-------------
Grades one of the fixture notebooks end-to-end against a sample rubric.
Use this to check real grading quality before running the full pipeline.

Usage:
    cd backend
    uv run python scripts/demo_grade.py

Requires:
    - ANTHROPIC_API_KEY set in ../.env
    - Fixture notebook at tests/fixtures/lab1_normal.ipynb
"""

import sys
import os
from pathlib import Path

# Make app importable
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from app.notebook_processing import process_notebook
from app.grading import grade_submission, GradingError

FIXTURE = Path(__file__).parent.parent / "tests" / "fixtures" / "lab1_normal.ipynb"

RUBRIC = """\
Grading breakdown (100 marks total):
1. Correct gradient descent implementation (30 marks):
   - Weights and bias updated correctly each epoch using dw/db gradients.
   - Uses mean squared error as the loss function.
2. MSE loss computed correctly (20 marks):
   - Loss = mean((y_pred - y)^2).
3. Training loop runs without errors (15 marks):
   - All cells execute top-to-bottom without exceptions.
4. Loss curve plotted (15 marks):
   - Matplotlib or equivalent plot showing loss over epochs.
5. Test set evaluation reported (10 marks):
   - MSE or another metric computed on a held-out test set.
6. Code quality and comments (10 marks):
   - Readable variable names.
   - At least one comment per major step.

Deduct 20 marks if any critical cell is empty or the notebook does not
run top-to-bottom without errors.
"""

TASK = """\
Implement linear regression from scratch using NumPy.
Your implementation must:
- Generate or load a dataset
- Implement gradient descent to minimise MSE loss
- Plot the training loss curve over epochs
- Evaluate your model on a test set and report the MSE
You may NOT use scikit-learn's LinearRegression or similar high-level APIs.
"""


def main():
    print("=" * 60)
    print("Notebook Grading System — Demo")
    print("=" * 60)

    # Step 1: Preprocess the notebook
    print(f"\n[1/3] Preprocessing: {FIXTURE.name}")
    result = process_notebook(FIXTURE)
    print(f"      Cells: {result.cell_count} | "
          f"Tokens: {result.raw_tokens} -> {result.clean_tokens} "
          f"({result.token_savings_pct}% savings)")
    print("\n--- Cleaned notebook text ---")
    print(result.text[:800] + "\n... (truncated for display)")

    # Step 2: Grade with LLM
    print("\n[2/3] Calling Anthropic API...")
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set in .env — cannot run demo.")
        print("Set it and re-run: uv run python scripts/demo_grade.py")
        sys.exit(1)

    try:
        grade = grade_submission(
            rubric=RUBRIC,
            task_description=TASK,
            notebook_text=result.text,
            similarity_flag=None,
            max_marks=100.0,
            api_key=api_key,
        )
    except GradingError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    # Step 3: Show results
    print("\n[3/3] Grading result:")
    print("=" * 60)
    print(f"  Marks     : {grade.marks} / {grade.max_marks}  ({grade.percentage}%)")
    print(f"  Flagged   : {grade.flagged}")
    print(f"  Model     : {grade.model}")
    print(f"  Tokens    : {grade.input_tokens} in / {grade.output_tokens} out")
    print(f"\n  Reasoning :\n")
    for line in grade.reasoning.split(". "):
        if line.strip():
            print(f"    {line.strip()}.")
    print("=" * 60)


if __name__ == "__main__":
    main()
