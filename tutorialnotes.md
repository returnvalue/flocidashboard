# Tutorial Notes

## About Floci IAM Reasoning

The old "About Floci IAM" section was accurate, but it read like a short service note. IAM is important enough that the note needed to do more than define the local emulator. It needed to teach a user how to think through IAM work inside Floci.

The updated format follows this reasoning:

1. Start with the mental model.
   IAM is the control layer for local AWS work. Before naming buttons or APIs, the note explains that IAM answers who is making a request, which credentials they are using, and whether policy allows the action.

2. Turn the model into an ordered workflow.
   The section uses an ordered list because IAM learning is sequential. Users should inspect principals first, create identities intentionally, attach permissions in small pieces, separate role trust from role permissions, test with real credentials, then clean up.

3. Keep the language tied to the workbench.
   Each tutorial step maps to something visible in the Floci IAM page: principal tabs, create buttons, attached and inline policy views, trust templates, `Use this user`, temporary role credentials, policy simulation, and cleanup actions.

4. Teach the important AWS distinction, not every IAM feature.
   The section calls out the distinctions that cause real debugging pain: users versus groups versus roles, managed versus inline policies, trust policies versus permission policies, and allowed paths versus denied paths.

5. Connect free exploration to guided labs.
   The workbench is best for exploring and debugging. The labs are best for walking through a known-good sequence. The note explicitly tells users when to use each surface.

6. Keep local Floci boundaries visible.
   The section includes Floci-specific behavior, such as assumed-role credential routing, and names common local test cases so users know what is useful to verify in the emulator.

7. Assume the Docker-first quickstart has already handled startup.
   Service tutorials should teach the service workflow, not repeat container setup. Mention Docker or endpoints only when the service behavior depends on them.

This tutorial format is now the target for high-value service notes:

- explain the service's mental model,
- provide an ordered local workflow,
- point to concrete workbench actions,
- describe what to test,
- name local Floci limits or behavior differences,
- connect the workbench to labs when the service has them.
- avoid repeating Docker setup unless runtime topology affects the lesson.
