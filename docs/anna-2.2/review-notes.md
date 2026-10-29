# Qingheng AI Anna Edition2.2.0-rc.1 — review update

Review candidate: 2.2.0-rc.1. Prepared for the Anna review team.

This update addresses the four issues from the previous review:

1. **First-use setup:** a new user must enter a valid profile and receive confirmed storage success before food logging becomes available. Valid existing Anna profiles are retained.
2. **Save feedback:** profile, food and weight saves show progress and success/failure. Failed saves preserve input and the previous committed records; repeat clicks do not create duplicate entries.
3. **Weight visualization:**7/30/90-day line charts use actual dated measurements, with an average, first-to-last change, BMI and an optional target-weight line. Empty or single-point periods do not invent a trend.
4. **Meaningful AI workflows:** Anna's real model extracts editable foods from text or an optional photo. Portion edits scale known nutrients, and records are saved only after confirmation. Separate opt-in nutrition analysis uses the selected day's actual journal, profile and starting targets, with incomplete-record limits.

Validation includes23 passing automated tests, official manifest validation, mobile layout checks and real hosted acceptance using fictional data in isolated app739. The test version has the identical frozen bundle as app731's candidate1778. Hosted tests covered profile setup, actual photo/text inference, review/edit/save, reopening with records preserved, date-specific nutrition insights and all three weight periods. The photo fixture is public CC0; no private photograph was used. Photo weight/nutrition estimates were not validated against measured ground truth.

Suggested review: start with a fresh installation, complete setup, analyze a meal after opt-in, edit its serving, confirm/save, reopen, then inspect Trends and nutrition insights. Photos and raw AI responses are not saved in the journal. The original private Qingheng service is separate and untouched.

Known acceptance observation: some earlier first-open/reload attempts stalled before the app UI rendered; subsequent recovery preserved the records. The cause remains unconfirmed. This is retained in the release checklist for assessment, not represented as eliminated.
