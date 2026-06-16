from pathlib import Path

from django.conf import settings


def static_versions(request):
    dashboard_js = Path(settings.BASE_DIR) / 'dashboard' / 'static' / 'dashboard' / 'dashboard.js'
    try:
        dashboard_js_version = str(dashboard_js.stat().st_mtime_ns)
    except OSError:
        dashboard_js_version = 'dev'

    return {
        'dashboard_js_version': dashboard_js_version,
    }
