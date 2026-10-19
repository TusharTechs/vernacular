# Vernacular

The spell-checker for culture. Paste any copy, pick who it is for, and every cultural reference is scored by how well that audience knows and loves it on Qloo's taste graph. Weak references are swapped for verified equivalents, and every claim links to the Qloo call behind it.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/). Status: in development. The agent runs end to end from the terminal (`npm run check -- coffee`); the web interface is next.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your QLOO_API_KEY
npm run qloo:smoke           # live check against https://hackathon.api.qloo.com
```

## Checks

```bash
npm run typecheck && npm run lint && npm test
```

Raw Qloo responses are written to `.cache/` and are git-ignored: Qloo data must not be committed to a public repository.

## License

MIT
