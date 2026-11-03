"""Print the OpenAPI spec: `uv run python -m smileos.openapi > ../../apps/web/openapi.json`."""

import json

from smileos.core.config import Settings
from smileos.main import create_app

if __name__ == "__main__":
    print(json.dumps(create_app(Settings(env="test")).openapi(), indent=1))
