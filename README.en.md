# Qingheng · 轻衡

**A local-first food and weight tracker for mobile browsers.**

[Fictional demo](https://koapeat.github.io/qingheng-mobile/web/?demo=1) · [Start with your own empty records](https://koapeat.github.io/qingheng-mobile/web/) · [中文](README.md)

<p><img src="docs/assets/overview.jpg" width="30%" alt="Overview with fictional records" /> <img src="docs/assets/food.jpg" width="30%" alt="Fictional meals" /> <img src="docs/assets/trends.jpg" width="30%" alt="Fictional weight trend" /></p>

Track meals, portions, known nutrients, morning weight and activity. Keep records in your current browser, export JSON backups, and optionally configure your own AI provider or personal sync service. No account is required for local tracking.

The demo contains fictional examples only. It disables AI requests and cloud sync. The public edition has separate storage keys and no default private sync endpoint.

## Quick start

Node.js 20+; no project dependency installation required:

```sh
git clone https://github.com/KoaPeat/qingheng-mobile.git
cd qingheng-mobile
npm start
```

Open `http://127.0.0.1:4173/`, or add `?demo=1` to explore examples. Use HTTP(S), not `file://`. Set your own profile before tracking: initial profile values are generic examples.

## Hosting

Deploy the entire `web/` directory to an HTTPS static host. A scoped service worker caches public app files after the initial online load; browser storage and offline behavior depend on your browser. Clearing site data removes local records, so keep backups.

Optional AI requires your own compatible endpoint, model and API key. The provider must allow browser requests. There is no bundled free AI service. Review recognition results before saving.

Optional personal sync uses the REST Worker template in `worker/`. Follow [the self-hosting guide](docs/self-hosting.md) to create your own KV namespace, exact-origin CORS configuration and separate read/write secrets. The template exposes `/health` and `/v1/events`, not `/mcp`. External chat integrations require a separately configured compatible connector.

AI keys remain in page memory. Sync credentials remain in the current tab session and are excluded from JSON data backups. Do not use the maintainer's personal service or publish credentials.

## Scope and limitations

- Web preview release; no APK, iOS app or native Android project is included.
- The browser edition has no standalone native speech recognition runtime; keyboard dictation and external text import can be used.
- KV sync is experimental for personal use: propagation delay, non-atomic concurrent writes and date/ID ordering mean conflict resolution is not guaranteed. See the deployment guide.
- Nutrition and expenditure are estimates for personal records, not medical diagnosis or treatment. Unknown nutrients stay unknown rather than becoming zero.
- Root and `phone/` entrypoints are legacy versions; use `web/` for new deployments.

Run `npm test` for checks and `npm run package` for an allow-listed release directory.

## Contribute

[Issues](https://github.com/KoaPeat/qingheng-mobile/issues/new/choose) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

Feedback on mobile compatibility, documentation, accessibility and nutrition sources is welcome. Remove personal records and credentials from public reports. If Qingheng is useful to you, a ⭐ Star helps people find it.

## License

Project code is [MIT licensed](LICENSE). Third-party nutrition sources, brands and trademarks are covered by the separate [notice](NOTICE.md).
