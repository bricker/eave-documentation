import os
import dotenv
from eave.dev_tooling.constants import EAVE_HOME

_deprecated_file = os.path.join(EAVE_HOME, ".env.test")
if os.path.isfile(_deprecated_file):
    print("To standardize env filenames, .env.test is deprecated; rename to .test.env")
    dotenv.load_dotenv(dotenv_path=os.path.join(EAVE_HOME, ".env.test"), override=True)

dotenv.load_dotenv(dotenv_path=os.path.join(EAVE_HOME, ".test.env"), override=True)

# ruff: noqa: E402

import json
import uuid
import eave.stdlib.time
import eave.stdlib.util

eave.stdlib.time.set_utc()

os.environ["EAVE_MONITORING_DISABLED"] = "1"
os.environ["EAVE_ANALYTICS_DISABLED"] = "1"

os.environ["EAVE_API_BASE_PUBLIC"] = "https://api.eave.tests"
os.environ["EAVE_APPS_BASE_PUBLIC"] = "https://apps.eave.tests"
os.environ["EAVE_WWW_BASE_PUBLIC"] = "https://www.eave.tests"
os.environ["EAVE_COOKIE_DOMAIN"] = ".eave.tests"

os.environ["EAVE_GOOGLE_OAUTH_CLIENT_CREDENTIALS_JSON"] = json.dumps(
    {
        "web": {
            "client_id": str(uuid.uuid4()),
            "project_id": "eavefyi-tests",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": str(uuid.uuid4()),
            "redirect_uris": ["https://api.eave.tests/oauth/google/callback"],
        }
    }
)
