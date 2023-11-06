import os
import sys
from eave.dev_tooling.constants import EAVE_HOME
from eave.dev_tooling.dotenv_loader import load_dotenv

sys.path.append(".")

load_dotenv("develop/shared/share.env", override=True)
load_dotenv(".env", override=True)

os.environ["GAE_SERVICE"] = "www"

from eave.marketing.app import app  # noqa: E402

if __name__ == "__main__":
    app.run(
        port=5000,
        use_debugger=False,
        use_reloader=True,
        extra_files=[
            os.path.join(EAVE_HOME, "libs/eave-stdlib-py"),
        ],
        exclude_patterns=[
            ".*",
            "**/build/",
            "**/__pycache__",
            "*.egg-info",
            "**/node_modules",
        ],
    )
