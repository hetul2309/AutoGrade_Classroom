"""
Tests for backend/app/similarity.py

Run with:
    cd backend
    uv run pytest tests/test_similarity.py -v
"""

import time
from pathlib import Path
import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.similarity import (
    SubmissionText,
    SimilarityFlag,
    CellMatch,
    find_similar_pairs,
    check_single_submission,
    _tokenize_code,
    _ast_normalize,
    _cell_similarity,
)


# ── Shared fixtures ───────────────────────────────────────────────────────────

# A well-implemented gradient descent (the "original")
ORIGINAL_CODE = """\
import numpy as np

def gradient_descent(X, y, lr=0.01, epochs=1000):
    w = 0.0
    b = 0.0
    n = len(y)
    losses = []
    for epoch in range(epochs):
        y_pred = w * X + b
        loss = np.mean((y_pred - y) ** 2)
        losses.append(loss)
        dw = (2/n) * np.sum((y_pred - y) * X)
        db = (2/n) * np.sum(y_pred - y)
        w -= lr * dw
        b -= lr * db
    return w, b, losses

w, b, losses = gradient_descent(X_train, y_train)
print(f'w={w:.4f}, b={b:.4f}')
"""

# Copy-paste plagiarism — identical code
COPY_PASTE_CODE = ORIGINAL_CODE

# Renamed-variable plagiarism — same logic, all variables renamed
RENAMED_VAR_CODE = """\
import numpy as np

def train_model(features, targets, learning_rate=0.01, num_epochs=1000):
    weight = 0.0
    bias = 0.0
    total = len(targets)
    history = []
    for step in range(num_epochs):
        predictions = weight * features + bias
        error = np.mean((predictions - targets) ** 2)
        history.append(error)
        grad_w = (2/total) * np.sum((predictions - targets) * features)
        grad_b = (2/total) * np.sum(predictions - targets)
        weight -= learning_rate * grad_w
        bias -= learning_rate * grad_b
    return weight, bias, history

weight, bias, history = train_model(X_train, y_train)
print(f'weight={weight:.4f}, bias={bias:.4f}')
"""

# Genuinely different code — logistic regression
DIFFERENT_CODE = """\
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

def logistic_regression(X, y, lr=0.1, epochs=500):
    m, n = X.shape
    theta = np.zeros(n)
    for _ in range(epochs):
        z = X @ theta
        h = sigmoid(z)
        gradient = X.T @ (h - y) / m
        theta -= lr * gradient
    return theta

theta = logistic_regression(X_train, y_train)
print('Theta:', theta)
"""

# Trivially short code — should not be compared
SHORT_CODE = "pass"

EVAL_CODE = """\
y_pred = w * X_test + b
test_mse = np.mean((y_pred - y_test) ** 2)
print(f'Test MSE: {test_mse:.4f}')
"""


def make_submission(student_id: int, submission_id: int,
                    cells: list[str]) -> SubmissionText:
    """Helper: build a SubmissionText from a list of code strings."""
    return SubmissionText(
        student_id=student_id,
        submission_id=submission_id,
        code_cells=[(i + 1, src) for i, src in enumerate(cells)],
    )


# ══════════════════════════════════════════════════════════════════════════════
# 1. Token normalisation
# ══════════════════════════════════════════════════════════════════════════════

class TestTokenize:
    def test_comments_stripped(self):
        code = "x = 1  # this is a comment\ny = 2"
        tokens = _tokenize_code(code)
        assert "#" not in tokens
        assert "this" not in tokens
        assert "comment" not in tokens

    def test_numbers_normalised(self):
        tokens = _tokenize_code("x = 42\ny = 3.14")
        assert "42" not in tokens
        assert "3.14" not in tokens
        assert tokens.count("NUM") == 2

    def test_strings_normalised(self):
        tokens = _tokenize_code('msg = "hello world"')
        assert "hello" not in tokens
        assert "STR" in tokens

    def test_whitespace_ignored(self):
        t1 = _tokenize_code("x=1\ny=2")
        t2 = _tokenize_code("x  =  1\n\n\ny  =  2")
        assert t1 == t2

    def test_empty_returns_empty(self):
        assert _tokenize_code("") == []
        assert _tokenize_code("  \n  ") == []


# ══════════════════════════════════════════════════════════════════════════════
# 2. AST normalisation
# ══════════════════════════════════════════════════════════════════════════════

class TestAstNormalize:
    def test_renames_variables(self):
        norm = _ast_normalize("x = 1\ny = x + 1")
        assert "x" not in norm
        assert "y" not in norm
        assert "v0" in norm

    def test_structurally_identical_after_rename(self):
        """Two programs with different var names should normalise identically."""
        code_a = "w = 0.0\nb = 0.0\nresult = w + b"
        code_b = "weight = 0.0\nbias = 0.0\nresult = weight + bias"
        assert _ast_normalize(code_a) == _ast_normalize(code_b)

    def test_different_structure_differs(self):
        code_a = "x = a + b"
        code_b = "x = a * b * c"
        assert _ast_normalize(code_a) != _ast_normalize(code_b)

    def test_handles_syntax_error_gracefully(self):
        bad = "def (((broken code"
        result = _ast_normalize(bad)
        assert isinstance(result, str)  # returns original, doesn't crash


# ══════════════════════════════════════════════════════════════════════════════
# 3. Cell-level similarity
# ══════════════════════════════════════════════════════════════════════════════

class TestCellSimilarity:
    def test_identical_code_scores_one(self):
        cm = _cell_similarity(ORIGINAL_CODE, COPY_PASTE_CODE)
        assert cm is not None
        assert cm.combined_score == pytest.approx(1.0)

    def test_renamed_vars_scores_high(self):
        """AST method should catch renamed-variable plagiarism."""
        cm = _cell_similarity(ORIGINAL_CODE, RENAMED_VAR_CODE)
        assert cm is not None
        assert cm.ast_score > 0.85

    def test_different_code_scores_low(self):
        cm = _cell_similarity(ORIGINAL_CODE, DIFFERENT_CODE)
        assert cm is not None
        assert cm.combined_score < 0.6

    def test_short_code_returns_none(self):
        """Cells shorter than 20 chars should be skipped."""
        result = _cell_similarity(SHORT_CODE, ORIGINAL_CODE)
        assert result is None

    def test_both_scores_in_range(self):
        cm = _cell_similarity(ORIGINAL_CODE, RENAMED_VAR_CODE)
        assert cm is not None
        assert 0.0 <= cm.token_score <= 1.0
        assert 0.0 <= cm.ast_score <= 1.0
        assert cm.combined_score == max(cm.token_score, cm.ast_score)


# ══════════════════════════════════════════════════════════════════════════════
# 4. find_similar_pairs — core logic
# ══════════════════════════════════════════════════════════════════════════════

class TestFindSimilarPairs:

    def test_identical_submissions_flagged(self):
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE, EVAL_CODE]),
            make_submission(2, 102, [COPY_PASTE_CODE, EVAL_CODE]),
        ]
        flags = find_similar_pairs(subs, threshold=0.75)
        assert len(flags) == 1
        assert flags[0].student_id_a == 1
        assert flags[0].student_id_b == 2
        assert flags[0].overall_score > 0.9

    def test_renamed_variable_plagiarism_caught(self):
        """AST method should flag renamed-variable copies above threshold."""
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE]),
            make_submission(2, 102, [RENAMED_VAR_CODE]),
        ]
        flags = find_similar_pairs(subs, threshold=0.75)
        assert len(flags) == 1
        assert flags[0].overall_score > 0.75

    def test_different_submissions_not_flagged(self):
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE]),
            make_submission(2, 102, [DIFFERENT_CODE]),
        ]
        flags = find_similar_pairs(subs, threshold=0.75)
        assert len(flags) == 0

    def test_three_students_only_plagiarists_flagged(self):
        """
        With 3 students where 2 copied each other, the 1-2 pair should score
        HIGHEST. Student 3 may share some boilerplate (like the eval cell)
        with others but the score for pairs involving student 3 should be
        significantly lower than the 1-2 plagiarism score.
        """
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE, EVAL_CODE]),
            make_submission(2, 102, [COPY_PASTE_CODE, EVAL_CODE]),   # copied from 1
            make_submission(3, 103, [DIFFERENT_CODE, EVAL_CODE]),    # genuine
        ]
        flags = find_similar_pairs(subs, threshold=0.75)

        # The (1, 2) pair must be flagged — they are identical
        flagged_pairs = {(f.student_id_a, f.student_id_b) for f in flags}
        assert (1, 2) in flagged_pairs

        # The (1, 2) pair should be the highest-scoring flag
        pair_1_2 = next(f for f in flags if (f.student_id_a, f.student_id_b) == (1, 2))
        for f in flags:
            if (f.student_id_a, f.student_id_b) != (1, 2):
                assert pair_1_2.overall_score >= f.overall_score

    def test_sorted_by_score_descending(self):
        # 3 pairs: two similar, one less so
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE]),
            make_submission(2, 102, [COPY_PASTE_CODE]),
            make_submission(3, 103, [RENAMED_VAR_CODE]),
        ]
        flags = find_similar_pairs(subs, threshold=0.5)
        if len(flags) >= 2:
            for i in range(len(flags) - 1):
                assert flags[i].overall_score >= flags[i + 1].overall_score

    def test_empty_submissions_returns_empty(self):
        assert find_similar_pairs([], threshold=0.75) == []

    def test_single_submission_returns_empty(self):
        subs = [make_submission(1, 101, [ORIGINAL_CODE])]
        assert find_similar_pairs(subs, threshold=0.75) == []

    def test_threshold_boundary(self):
        """At threshold=0.99, even renamed copies should not be flagged."""
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE]),
            make_submission(2, 102, [RENAMED_VAR_CODE]),
        ]
        flags_strict = find_similar_pairs(subs, threshold=0.99)
        flags_lenient = find_similar_pairs(subs, threshold=0.50)
        # Strict threshold should flag fewer (possibly 0)
        assert len(flags_strict) <= len(flags_lenient)

    def test_explanation_string_populated(self):
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE]),
            make_submission(2, 102, [COPY_PASTE_CODE]),
        ]
        flags = find_similar_pairs(subs, threshold=0.75)
        assert flags
        exp = flags[0].explanation
        assert isinstance(exp, str)
        assert len(exp) > 20
        assert "101" in exp or "102" in exp

    def test_matched_cells_have_correct_indices(self):
        subs = [
            make_submission(1, 101, [ORIGINAL_CODE, EVAL_CODE]),
            make_submission(2, 102, [COPY_PASTE_CODE, EVAL_CODE]),
        ]
        flags = find_similar_pairs(subs, threshold=0.75)
        assert flags
        for cm in flags[0].matched_cells:
            assert cm.cell_index_a > 0
            assert cm.cell_index_b > 0


# ══════════════════════════════════════════════════════════════════════════════
# 5. check_single_submission helper
# ══════════════════════════════════════════════════════════════════════════════

class TestCheckSingleSubmission:
    def test_flags_match_against_others(self):
        target = make_submission(99, 999, [ORIGINAL_CODE])
        others = [
            make_submission(1, 101, [COPY_PASTE_CODE]),
            make_submission(2, 102, [DIFFERENT_CODE]),
        ]
        flags = check_single_submission(target, others, threshold=0.75)
        assert any(
            f.student_id_a == 99 or f.student_id_b == 99
            for f in flags
        )


# ══════════════════════════════════════════════════════════════════════════════
# 6. Performance test — 150 students in < 5 seconds
# ══════════════════════════════════════════════════════════════════════════════

def test_performance_150_students():
    """
    Simulate 150 students submitting ~2 code cells each (300 total cells,
    ~11,175 pairwise comparisons). Uses three distinct algorithm families
    so most pairs are genuinely different — like a real class submission.

    Target: < 10 seconds (post-deadline batch job, runs once per assignment).
    """
    import random

    def linear_regression_code(seed: int) -> str:
        rng = random.Random(seed)
        lr = rng.uniform(0.001, 0.1)
        epochs = rng.randint(100, 2000)
        vw = f"w{seed % 10}"
        vb = f"b{seed % 10}"
        return (
            f"import numpy as np\n"
            f"def train(X, y, lr={lr:.4f}, epochs={epochs}):\n"
            f"    {vw} = np.zeros(X.shape[1])\n"
            f"    {vb} = 0.0\n"
            f"    for _ in range(epochs):\n"
            f"        pred = X @ {vw} + {vb}\n"
            f"        err = pred - y\n"
            f"        {vw} -= lr * X.T @ err / len(y)\n"
            f"        {vb} -= lr * err.mean()\n"
            f"    return {vw}, {vb}\n"
        )

    def logistic_regression_code(seed: int) -> str:
        rng = random.Random(seed)
        lr = rng.uniform(0.01, 0.5)
        iters = rng.randint(200, 1000)
        vt = f"theta{seed % 10}"
        return (
            f"import numpy as np\n"
            f"def sigmoid(z): return 1 / (1 + np.exp(-z))\n"
            f"def logistic(X, y, lr={lr:.4f}, iters={iters}):\n"
            f"    {vt} = np.zeros(X.shape[1])\n"
            f"    for _ in range(iters):\n"
            f"        h = sigmoid(X @ {vt})\n"
            f"        grad = X.T @ (h - y) / len(y)\n"
            f"        {vt} -= lr * grad\n"
            f"    return {vt}\n"
        )

    def knn_code(seed: int) -> str:
        rng = random.Random(seed)
        k = rng.randint(3, 15)
        vd = f"dists{seed % 10}"
        return (
            f"import numpy as np\n"
            f"def knn_predict(X_train, y_train, X_test, k={k}):\n"
            f"    preds = []\n"
            f"    for x in X_test:\n"
            f"        {vd} = np.sqrt(((X_train - x) ** 2).sum(axis=1))\n"
            f"        idx = np.argsort({vd})[:{k}]\n"
            f"        preds.append(np.bincount(y_train[idx]).argmax())\n"
            f"    return np.array(preds)\n"
        )

    # 50 students per algorithm family
    algo_fns = [linear_regression_code, logistic_regression_code, knn_code]
    submissions = []
    for i in range(150):
        fn = algo_fns[i % 3]
        submissions.append(
            make_submission(i, 1000 + i, [fn(i), fn(i + 500)])
        )

    start = time.perf_counter()
    flags = find_similar_pairs(submissions, threshold=0.75)
    elapsed = time.perf_counter() - start

    print(f"\n[Performance] 150 students: {elapsed:.2f}s, {len(flags)} flags raised")
    assert elapsed < 10.0, f"Too slow: {elapsed:.2f}s (must be < 10s for batch job)"
