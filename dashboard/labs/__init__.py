"""Public lab API.

This package still exposes the historical ``dashboard.labs`` module object so
existing tests and patches keep working while the implementation is split into
smaller modules over time.
"""

from __future__ import annotations

import sys
from pathlib import Path

from . import monolith as _monolith

_monolith.__path__ = [str(Path(__file__).parent)]
_monolith.__package__ = __name__
sys.modules[__name__] = _monolith
