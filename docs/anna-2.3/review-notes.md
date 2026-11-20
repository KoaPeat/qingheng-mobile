# Qingheng AI 2.3.0-rc.3 review notes

This candidate addresses the Anna Developer Team's November 17, 2026 request for an English app name and an English-language experience.

The app name is **Qingheng AI – Calorie & Nutrition Tracker**. A new installation opens in English even when the device or host language is Chinese. Users can explicitly select English or Simplified Chinese in Goals & data; that choice survives reopening and does not rewrite their journal.

## Changes

- English navigation, onboarding, forms, goal explanations, help, validation, storage errors and AI failure messages use shared language resources.
- AI meal names, serving notes and daily nutrition insights follow the selected app language. Users review and edit estimates before saving.
- Language changes discard stale AI replies while preserving typed input, selected photos and reviewed nutrient values.
- Preference writes keep the last explicit choice across connection waits and delayed saves. A failed current preference has a visible retry action; a superseded failure does not leave an incorrect warning.
- Page identity and the Anna window title use the English app name. English text wraps on narrow layouts.
- Existing version 1 records, nutrition calculations and storage keys remain compatible. This Anna edition does not connect to the original private Qingheng Cloudflare service.

## Validation on November 20, 2026

- 67 automated tests, strict Anna manifest validation, seven review scenarios and three independent timing scenarios passed.
- Six real Anna model checks passed in the official development harness connected to the isolated test application: text meals, the same public meal photo and selected-day nutrition insights in both English and Chinese. These were real model responses, not fixtures.
- A real APS write/read probe passed with an isolated integration-test key. The UI uses the same confirmed candidate bundle.
- The local preview screenshots use fictional records. The editable-review screenshot shows manual entry and is not represented as an AI recognition result.
- No physical iPhone or Android device was available for this validation. Narrow-width Chrome checks are not presented as physical-device tests. The previously observed intermittent hosted-window loading delay remains disclosed; no root cause or permanent fix is claimed.

Nutrition and portion values are estimates, not a validation of nutritional accuracy or medical advice.

## Reviewer steps

1. Install this candidate in a fresh Anna test environment without changing the device language. Confirm the English name and English first-use screen.
2. Complete a fictional adult profile. Analyze an English description or an optional public food photo after opting in. Review names and values, change grams and confirm proportional scaling, then save.
3. Close and reopen the app to verify that confirmed records and language preference are restored.
4. Switch to Simplified Chinese and repeat an analysis. Switch during a pending analysis and confirm the old-language response is discarded without clearing input. Switch back to English.
5. Review the selected day's nutrition insights, record weights and inspect the 7, 30 and 90-day trend options. No missing measurements are invented.
6. Export and import a version 1 backup if needed; this does not change the independent language preference.

Support: https://github.com/KoaPeat/qingheng-mobile/issues
