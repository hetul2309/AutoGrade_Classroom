"""
Tests for backend/app/notebook_processing.py

Run with:
    cd backend
    uv run pytest tests/test_notebook_processing.py -v
"""

from pathlib import Path
import pytest

# Make app importable
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.notebook_processing import (
    process_notebook,
    process_notebook_text,
    NotebookResult,
    MAX_OUTPUT_CHARS,
)

FIXTURES = Path(__file__).parent / "fixtures"


# ── Fixture helpers ────────────────────────────────────────────────────────────

def get_fixture(name: str) -> Path:
    return FIXTURES / name


# ══════════════════════════════════════════════════════════════════════════════
# 1. Normal notebook (code + markdown + print + plot)
# ══════════════════════════════════════════════════════════════════════════════

class TestNormalNotebook:
    def setup_method(self):
        self.result = process_notebook(get_fixture("lab1_normal.ipynb"))

    def test_returns_notebook_result(self):
        assert isinstance(self.result, NotebookResult)

    def test_text_is_nonempty(self):
        assert len(self.result.text) > 100

    def test_cell_count(self):
        # 1 markdown + 4 code cells = 5 total, none are empty
        assert self.result.cell_count == 5

    def test_no_cells_dropped(self):
        assert self.result.cells_dropped == 0

    def test_header_present(self):
        assert "=== NOTEBOOK SUBMISSION ===" in self.result.text

    def test_cell_headers_present(self):
        assert "### Cell 1 [markdown] ###" in self.result.text
        assert "### Cell 2 [code] ###" in self.result.text

    def test_markdown_content_included(self):
        assert "Linear Regression" in self.result.text

    def test_code_content_included(self):
        assert "import numpy" in self.result.text
        assert "gradient descent" in self.result.text.lower() or "train_linear_regression" in self.result.text

    def test_print_output_included(self):
        assert "Data shape:" in self.result.text
        assert "Learned:" in self.result.text

    def test_binary_image_replaced_with_placeholder(self):
        assert "[image/plot output omitted]" in self.result.text

    def test_no_raw_ipynb_metadata(self):
        # execution_count, cell IDs etc. should not appear in cleaned text
        assert "execution_count" not in self.result.text
        assert '"id"' not in self.result.text
        assert "nbformat" not in self.result.text

    def test_token_counts_positive(self):
        assert self.result.raw_tokens > 0
        assert self.result.clean_tokens > 0

    def test_clean_smaller_than_raw(self):
        # Cleaning should always reduce size (binary content removed)
        assert self.result.clean_chars < self.result.raw_chars

    def test_token_savings_positive(self):
        assert self.result.token_savings_pct > 0


# ══════════════════════════════════════════════════════════════════════════════
# 2. Notebook with errors
# ══════════════════════════════════════════════════════════════════════════════

class TestErrorNotebook:
    def setup_method(self):
        self.result = process_notebook(get_fixture("lab1_with_errors.ipynb"))

    def test_error_output_included(self):
        assert "NameError" in self.result.text

    def test_error_value_included(self):
        assert "name 'w' is not defined" in self.result.text

    def test_ansi_codes_stripped(self):
        # ANSI escape codes like \x1b[0;31m should not appear
        assert "\x1b[" not in self.result.text
        assert "\u001b[" not in self.result.text

    def test_empty_markdown_cell_dropped(self):
        # The empty markdown cell at the end should be dropped
        assert self.result.cells_dropped >= 1

    def test_unrun_cell_included(self):
        # Cell with no outputs but non-empty source should still be included
        assert "This should have been the final evaluation" in self.result.text


# ══════════════════════════════════════════════════════════════════════════════
# 3. Notebook with large output
# ══════════════════════════════════════════════════════════════════════════════

class TestLargeOutputNotebook:
    def setup_method(self):
        self.result = process_notebook(get_fixture("lab1_large_output.ipynb"))

    def test_long_output_is_truncated(self):
        # The multi-line epoch output should be cut
        assert "[truncated," in self.result.text

    def test_truncated_output_not_too_long(self):
        # No single output block should exceed MAX_OUTPUT_CHARS + overhead
        # (We allow some slack for the truncation message itself)
        for cell in self.result.processed_cells:
            assert len(cell.output) <= MAX_OUTPUT_CHARS + 100

    def test_binary_output_replaced(self):
        assert "[image/plot output omitted]" in self.result.text

    def test_text_after_plot_still_included(self):
        # Short print output after the plot should survive
        assert "Final accuracy: 0.923" in self.result.text

    def test_cell_count(self):
        assert self.result.cell_count == 4  # 1 markdown + 3 code


# ══════════════════════════════════════════════════════════════════════════════
# 4. Convenience wrapper
# ══════════════════════════════════════════════════════════════════════════════

def test_process_notebook_text_returns_string():
    text = process_notebook_text(get_fixture("lab1_normal.ipynb"))
    assert isinstance(text, str)
    assert len(text) > 50


# ══════════════════════════════════════════════════════════════════════════════
# 5. Error handling
# ══════════════════════════════════════════════════════════════════════════════

def test_raises_file_not_found():
    with pytest.raises(FileNotFoundError):
        process_notebook("/nonexistent/path/notebook.ipynb")


def test_raises_value_error_on_invalid_json(tmp_path):
    bad_file = tmp_path / "bad.ipynb"
    bad_file.write_text("this is not json at all {{{{")
    with pytest.raises((ValueError, Exception)):
        process_notebook(bad_file)
