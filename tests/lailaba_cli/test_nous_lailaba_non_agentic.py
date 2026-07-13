"""Tests for the Nous-Lailaba-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"lailaba"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``lailaba-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "lailaba" tag namespace.

``is_nous_lailaba_non_agentic`` should only match the actual Nous Research
Lailaba-3 / Lailaba-4 chat family.
"""

from __future__ import annotations

import pytest

from lailaba_cli.model_switch import (
    _LAILABA_MODEL_WARNING,
    _check_lailaba_model_warning,
    is_nous_lailaba_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "NousResearch/Lailaba-3-Llama-3.1-70B",
        "NousResearch/Lailaba-3-Llama-3.1-405B",
        "lailaba-3",
        "Lailaba-3",
        "lailaba-4",
        "lailaba-4-405b",
        "lailaba_4_70b",
        "openrouter/lailaba3:70b",
        "openrouter/nousresearch/lailaba-4-405b",
        "NousResearch/Lailaba3",
        "lailaba-3.1",
    ],
)
def test_matches_real_nous_lailaba_chat_models(model_name: str) -> None:
    assert is_nous_lailaba_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Lailaba 3/4"
    )
    assert _check_lailaba_model_warning(model_name) == _LAILABA_MODEL_WARNING


@pytest.mark.parametrize(
    "model_name",
    [
        # Kyle's local Modelfile — qwen3:14b under a custom tag
        "lailaba-brain:qwen3-14b-ctx16k",
        "lailaba-brain:qwen3-14b-ctx32k",
        "lailaba-honcho:qwen3-8b-ctx8k",
        # Plain unrelated models
        "qwen3:14b",
        "qwen3-coder:30b",
        "qwen2.5:14b",
        "claude-opus-4-6",
        "anthropic/claude-sonnet-4.5",
        "gpt-5",
        "openai/gpt-4o",
        "google/gemini-2.5-flash",
        "deepseek-chat",
        # Non-chat Lailaba models we don't warn about
        "lailaba-llm-2",
        "lailaba2-pro",
        "nous-lailaba-2-mistral",
        # Edge cases
        "",
        "lailaba",  # bare "lailaba" isn't the 3/4 family
        "lailaba-brain",
        "brain-lailaba-3-impostor",  # "3" not preceded by /: boundary
    ],
)
def test_does_not_match_unrelated_models(model_name: str) -> None:
    assert not is_nous_lailaba_non_agentic(model_name), (
        f"expected {model_name!r} NOT to be flagged as Nous Lailaba 3/4"
    )
    assert _check_lailaba_model_warning(model_name) == ""


def test_none_like_inputs_are_safe() -> None:
    assert is_nous_lailaba_non_agentic("") is False
    # Defensive: the helper shouldn't crash on None-ish falsy input either.
    assert _check_lailaba_model_warning("") == ""
