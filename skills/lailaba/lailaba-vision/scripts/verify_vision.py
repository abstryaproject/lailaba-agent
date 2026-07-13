#!/usr/bin/env python3
"""Probe whether Lailaba's vision_analyze backend resolves a client + backends.

Run with the hermes venv python:
    cd ~/.hermes/hermes-agent && venv/bin/python <path>/verify_vision.py

Exit code 0 = a vision client resolved (tool will load).
Exit code 1 = no client resolved (tool stays gated).
Prints provider/model and the available vision backends (auto-selection order).
"""
import sys

sys.path.insert(0, "~/.hermes/hermes-agent")


def main() -> int:
    from agent.auxiliary_client import (  # noqa: E402
        resolve_vision_provider_client,
        get_available_vision_backends,
    )

    provider, client, model = resolve_vision_provider_client()
    print("provider:", provider)
    print("model   :", model)
    print("client_ok:", client is not None)
    backends = get_available_vision_backends()
    print("backends:", backends)
    return 0 if client is not None else 1


if __name__ == "__main__":
    sys.exit(main())
