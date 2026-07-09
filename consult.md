# Consultation Notes

When updating dashboard features in this repository, consult the Floci source code at:

`/Users/chris/floci/floci`

Use that codebase as reference context for expected behavior, domain models, API shapes, and feature parity before making dashboard changes.

For any service build, update, or change:

1. First check the Floci source code for that specific service.
2. Then probe the live local endpoints, because dashboard development assumes a running dashboard and Floci backend.
3. After source review and endpoint probing, map out the actions to take and the code to write.
