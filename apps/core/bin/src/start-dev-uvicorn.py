#!/usr/bin/env python

import uvicorn
import os
import sys
from eave.dev_tooling.constants import EAVE_HOME

from eave.dev_tooling.dotenv_loader import load_dotenv

sys.path.append(".")

load_dotenv("develop/shared/share.env", override=True)
load_dotenv(".env", override=True)

os.environ["GAE_SERVICE"] = "api"

if __name__ == "__main__":
    uvicorn.run(
        app="eave.core.app:app",
        port=5100,
        reload=True,
        reload_includes=[
            "eave",
            f"{EAVE_HOME}/libs/eave-stdlib-py/src/eave",
        ],
        reload_excludes=[
            "**/build/",
            ".*",
            "**/__pycache__",
            "*.egg-info",
            "**/node_modules",
        ],
    )
