# Real chat-assistant answers

Answers that public chat assistants gave when asked, with the instructions from
"Copy instructions for your AI", to write a CV in the `enginecv.authoring/v1`
format. They are kept verbatim, including the prose, code fences and mistakes
around the JSON, because those mistakes are what `parseAuthoringText` has to
cope with.

- One file per answer: `<assistant>-<yyyy-mm-dd>-<n>.txt`.
- Personal data must be invented or from the QA notes, never a real person's CV.
- Each file is loaded by `parse-text.unit.test.ts`, which asserts that it parses
  and which repairs it needed.

Collected during the SC-002 trial (task T045).
