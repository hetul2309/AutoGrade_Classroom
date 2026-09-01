"""
Tests for backend/app/grading.py

Uses unittest.mock to patch the Anthropic client — no real API key needed.

Run with:
    cd backend
    uv run pytest tests/test_grading.py -v
"""

from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
import sys
import anthropic

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.grading import (
    GradeResult,
    GradingAPIError,
    GradingParseError,
    GradingTimeoutError,
    grade_submission,
    _build_user_prompt,
    _extract_tool_input,
    _parse_grade_result,
)
from app.similarity import SimilarityFlag, CellMatch


# ── Shared test data ──────────────────────────────────────────────────────────

RUBRIC = (
    "Grading breakdown (100 marks total):\n"
    "1. Gradient descent implemented correctly (30 marks)\n"
    "2. MSE loss computed correctly (20 marks)\n"
    "3. Training loop runs without errors (15 marks)\n"
    "4. Loss curve plotted (15 marks)\n"
    "5. Test set evaluation reported (10 marks)\n"
    "6. Code quality (10 marks)\n"
)

TASK = (
    "Implement linear regression from scratch using NumPy. "
    "Use gradient descent to minimise MSE loss. "
    "Plot the training loss curve and evaluate on a held-out test set."
)

NOTEBOOK_TEXT = (
    "=== NOTEBOOK SUBMISSION ===\n"
    "Total cells: 3\n\n"
    "### Cell 1 [markdown] ###\n"
    "# Linear Regression Assignment\n\n"
    "### Cell 2 [code] ###\n"
    "import numpy as np\n\n"
    "def train(X, y, lr=0.01, epochs=1000):\n"
    "    w = np.zeros(X.shape[1])\n"
    "    b = 0.0\n"
    "    for _ in range(epochs):\n"
    "        pred = X @ w + b\n"
    "        mse = np.mean((pred - y) ** 2)\n"
    "        w -= lr * X.T @ (pred - y) / len(y)\n"
    "        b -= lr * (pred - y).mean()\n"
    "    return w, b\n"
    "--- output ---\n"
    "w=[2.98], b=2.01\n\n"
    "### Cell 3 [code] ###\n"
    "test_mse = np.mean((w * X_test + b - y_test) ** 2)\n"
    "print(f'Test MSE: {test_mse:.4f}')\n"
    "--- output ---\n"
    "Test MSE: 0.2701\n"
)

SAMPLE_FLAG = SimilarityFlag(
    student_id_a=1,
    student_id_b=2,
    submission_id_a=101,
    submission_id_b=102,
    overall_score=0.92,
    matched_cells=[
        CellMatch(cell_index_a=2, cell_index_b=2,
                  token_score=0.95, ast_score=0.97, combined_score=0.97)
    ],
    explanation=(
        "Submissions 101 and 102 are 92.0% similar overall. "
        "1 cell pair(s) matched above threshold: Cell 2↔2 (97.0%)."
    ),
)


# ── Mock factory ──────────────────────────────────────────────────────────────

def _make_mock_response(
    marks: float = 78.0,
    max_marks: float = 100.0,
    reasoning: str = "Good implementation of gradient descent.",
    flagged: bool = False,
    flag_reason: str | None = None,
    input_tokens: int = 500,
    output_tokens: int = 120,
) -> MagicMock:
    """Build a fake Anthropic API response mimicking tool use."""
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.name = "submit_grade"
    tool_block.input = {
        "marks": marks,
        "max_marks": max_marks,
        "reasoning": reasoning,
        "flagged": flagged,
        "flag_reason": flag_reason,
    }

    usage = MagicMock()
    usage.input_tokens = input_tokens
    usage.output_tokens = output_tokens

    response = MagicMock()
    response.content = [tool_block]
    response.usage = usage
    return response


# ══════════════════════════════════════════════════════════════════════════════
# 1. Prompt construction
# ══════════════════════════════════════════════════════════════════════════════

class TestPromptConstruction:
    def test_rubric_in_prompt(self):
        prompt = _build_user_prompt(TASK, RUBRIC, NOTEBOOK_TEXT, 100.0, None)
        assert "Gradient descent" in prompt
        assert "MSE loss" in prompt

    def test_task_in_prompt(self):
        prompt = _build_user_prompt(TASK, RUBRIC, NOTEBOOK_TEXT, 100.0, None)
        assert "linear regression" in prompt.lower()

    def test_notebook_text_in_prompt(self):
        prompt = _build_user_prompt(TASK, RUBRIC, NOTEBOOK_TEXT, 100.0, None)
        assert "NOTEBOOK SUBMISSION" in prompt
        assert "import numpy" in prompt

    def test_no_flag_section_when_none(self):
        prompt = _build_user_prompt(TASK, RUBRIC, NOTEBOOK_TEXT, 100.0, None)
        assert "No similarity flag" in prompt
        assert "flagged=false" in prompt

    def test_flag_section_included_when_present(self):
        prompt = _build_user_prompt(TASK, RUBRIC, NOTEBOOK_TEXT, 100.0, SAMPLE_FLAG)
        assert "Similarity Flag" in prompt
        assert "92.0%" in prompt
        assert "flagged=true" in prompt

    def test_max_marks_in_prompt(self):
        prompt = _build_user_prompt(TASK, RUBRIC, NOTEBOOK_TEXT, 50.0, None)
        assert "50" in prompt


# ══════════════════════════════════════════════════════════════════════════════
# 2. Tool input extraction
# ══════════════════════════════════════════════════════════════════════════════

class TestExtractToolInput:
    def test_extracts_tool_input(self):
        response = _make_mock_response()
        result = _extract_tool_input(response)
        assert result["marks"] == 78.0
        assert result["reasoning"] == "Good implementation of gradient descent."

    def test_raises_parse_error_when_no_tool_call(self):
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Here is my assessment..."

        response = MagicMock()
        response.content = [text_block]

        with pytest.raises(GradingParseError, match="submit_grade"):
            _extract_tool_input(response)

    def test_skips_wrong_tool_name(self):
        wrong_block = MagicMock()
        wrong_block.type = "tool_use"
        wrong_block.name = "some_other_tool"

        response = MagicMock()
        response.content = [wrong_block]
        response.content[0].text = ""

        with pytest.raises(GradingParseError):
            _extract_tool_input(response)


# ══════════════════════════════════════════════════════════════════════════════
# 3. Parse and validate GradeResult
# ══════════════════════════════════════════════════════════════════════════════

class TestParseGradeResult:
    def _usage(self):
        u = MagicMock()
        u.input_tokens = 400
        u.output_tokens = 100
        return u

    def test_valid_result_parsed(self):
        tool_input = {
            "marks": 85.0,
            "max_marks": 100.0,
            "reasoning": "Excellent work.",
            "flagged": False,
            "flag_reason": None,
        }
        result = _parse_grade_result(tool_input, 100.0, "claude-test",
                                     self._usage(), None)
        assert isinstance(result, GradeResult)
        assert result.marks == 85.0
        assert result.max_marks == 100.0
        assert result.flagged is False
        assert result.flag_reason is None

    def test_marks_clamped_to_max(self):
        tool_input = {
            "marks": 999.0,  # exceeds max
            "max_marks": 100.0,
            "reasoning": "Over-counted.",
            "flagged": False,
            "flag_reason": None,
        }
        result = _parse_grade_result(tool_input, 100.0, "claude-test",
                                     self._usage(), None)
        assert result.marks == 100.0

    def test_marks_clamped_to_zero(self):
        tool_input = {
            "marks": -10.0,  # negative
            "max_marks": 100.0,
            "reasoning": "Invalid.",
            "flagged": False,
            "flag_reason": None,
        }
        result = _parse_grade_result(tool_input, 100.0, "claude-test",
                                     self._usage(), None)
        assert result.marks == 0.0

    def test_flag_enforced_when_similarity_flag_provided(self):
        """If model forgets to set flagged=true, we enforce it."""
        tool_input = {
            "marks": 70.0,
            "max_marks": 100.0,
            "reasoning": "Good work.",
            "flagged": False,   # model forgot!
            "flag_reason": None,
        }
        result = _parse_grade_result(tool_input, 100.0, "claude-test",
                                     self._usage(), SAMPLE_FLAG)
        assert result.flagged is True
        assert result.flag_reason is not None

    def test_raises_parse_error_on_missing_field(self):
        tool_input = {"marks": 80.0}  # missing required fields
        with pytest.raises(GradingParseError):
            _parse_grade_result(tool_input, 100.0, "claude-test",
                                self._usage(), None)

    def test_token_counts_populated(self):
        tool_input = {
            "marks": 75.0, "max_marks": 100.0,
            "reasoning": "OK.", "flagged": False, "flag_reason": None,
        }
        result = _parse_grade_result(tool_input, 100.0, "claude-test",
                                     self._usage(), None)
        assert result.input_tokens == 400
        assert result.output_tokens == 100

    def test_percentage_property(self):
        tool_input = {
            "marks": 80.0, "max_marks": 100.0,
            "reasoning": "Good.", "flagged": False, "flag_reason": None,
        }
        result = _parse_grade_result(tool_input, 100.0, "claude-test",
                                     self._usage(), None)
        assert result.percentage == 80.0


# ══════════════════════════════════════════════════════════════════════════════
# 4. grade_submission — full integration (mocked API)
# ══════════════════════════════════════════════════════════════════════════════

class TestGradeSubmission:

    @patch("app.grading.anthropic.Anthropic")
    def test_returns_grade_result(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response(marks=78.0)

        result = grade_submission(
            rubric=RUBRIC,
            task_description=TASK,
            notebook_text=NOTEBOOK_TEXT,
            api_key="test-key-123",
        )

        assert isinstance(result, GradeResult)
        assert result.marks == 78.0
        assert result.max_marks == 100.0
        assert result.flagged is False
        assert len(result.reasoning) > 0

    @patch("app.grading.anthropic.Anthropic")
    def test_passes_flag_in_prompt(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response(
            flagged=True, flag_reason=SAMPLE_FLAG.explanation
        )

        result = grade_submission(
            rubric=RUBRIC,
            task_description=TASK,
            notebook_text=NOTEBOOK_TEXT,
            similarity_flag=SAMPLE_FLAG,
            api_key="test-key-123",
        )

        # Check that the flag info appeared in the prompt
        call_kwargs = mock_client.messages.create.call_args
        messages = call_kwargs.kwargs["messages"]
        user_content = messages[0]["content"]
        assert "92.0%" in user_content
        assert result.flagged is True

    @patch("app.grading.anthropic.Anthropic")
    def test_uses_tool_choice_any(self, mock_anthropic_cls):
        """Verify we force tool use (not optional)."""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response()

        grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT, api_key="test-key")

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["tool_choice"] == {"type": "any"}
        assert any(t["name"] == "submit_grade" for t in call_kwargs["tools"])

    def test_raises_api_error_when_no_key(self):
        with pytest.raises(GradingAPIError, match="ANTHROPIC_API_KEY"):
            grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT, api_key="")

    @patch("app.grading.anthropic.Anthropic")
    def test_raises_api_error_on_auth_failure(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic.AuthenticationError(
            message="Invalid key", response=MagicMock(), body={}
        )

        with pytest.raises(GradingAPIError, match="Invalid API key"):
            grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT, api_key="bad-key")

    @patch("app.grading.anthropic.Anthropic")
    def test_raises_timeout_error(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic.APITimeoutError(
            request=MagicMock()
        )

        with pytest.raises(GradingTimeoutError):
            grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT, api_key="test-key")

    @patch("app.grading.anthropic.Anthropic")
    def test_raises_parse_error_on_no_tool_call(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        # Return text content instead of a tool call
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Here are my thoughts..."
        bad_response = MagicMock()
        bad_response.content = [text_block]
        bad_response.usage = MagicMock()
        mock_client.messages.create.return_value = bad_response

        with pytest.raises(GradingParseError):
            grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT, api_key="test-key")

    @patch("app.grading.anthropic.Anthropic")
    def test_custom_model_passed_to_api(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response()

        grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT,
                         model="claude-haiku-4-5", api_key="test-key")

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == "claude-haiku-4-5"

    @patch("app.grading.anthropic.Anthropic")
    def test_custom_max_marks(self, mock_anthropic_cls):
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response(
            marks=40.0, max_marks=50.0
        )

        result = grade_submission(RUBRIC, TASK, NOTEBOOK_TEXT,
                                  max_marks=50.0, api_key="test-key")
        assert result.max_marks == 50.0
        assert result.percentage == 80.0
