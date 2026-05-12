from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Clears supported runtime resources. Currently supports: cache"

    def add_arguments(self, parser):
        parser.add_argument(
            "target",
            help="Resource to clear. Supported values: cache",
        )

    def handle(self, *args, **options):
        target = options["target"].strip().lower()

        if target != "cache":
            raise CommandError(
                f"Unsupported clear target '{target}'. Try: python3 manage.py clear cache"
            )

        cache.clear()
        self.stdout.write(self.style.SUCCESS("Cache cleared."))
