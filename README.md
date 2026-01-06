# SensiPlan PWA

Fertility tracking app based on the SensiPlan sympto-thermal method.

## Features

- ✅ **Offline-first** - Works without internet connection
- ✅ **Installable PWA** - Install on iPhone, Android, desktop
- ✅ **Bilingual** - French and English
- ✅ **SensiPlan rule engine** - 42 unit tests
- ✅ **Temperature chart** - Cycle visualization
- ✅ **Export/Import** - Backup your data

## Demo

👉 **[Open the app](https://[USERNAME].github.io/sensiplan-pwa/)**

## Local Installation

```bash
git clone https://github.com/[USERNAME]/sensiplan-pwa.git
cd sensiplan-pwa
npm install
npm run dev
```

## Tests

```bash
cd packages/rule-engine
npm test
```

## SensiPlan Method

This app implements the SensiPlan sympto-thermal method rules, including:

- Temperature rules (coverline, 3 high readings, exceptions)
- Cervical mucus rules (peak, P+1+2+3)
- Fertile start rules (5-day, Minus-8, Minus-20)
- Double-check for post-ovulatory infertile phase

## License

MIT

---

*SensiPlan® is a registered trademark of Malteser Arbeitsgruppe NFP*
