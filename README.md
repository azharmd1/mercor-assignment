# Mercor Assignment — Local Runner

This workspace contains a lightweight local runner for the Mercor re-ranking assignment. It is intended for development and offline testing. It does not require access to the remote TPUF service, but can optionally call the evaluation endpoint when enabled.

Quick commands

- Install (if needed): `npm i`
- Run the pipeline once (original index):
  ```bash
  node index.js
  ```
- Run the test runner (multiple profiles):
  ```bash
  npm run test:run
  ```
- Build submissions for all 10 configs (writes to `output/submissions`):
  ```bash
  npm run submit
  ```

Remote evaluation

To enable remote evaluation (POST to the provided evaluation endpoint), set the following environment variables in your shell:

```bash
export EVAL_REMOTE=true
export AUTH_EMAIL="your.email@example.com"
# then run
npm run submit
```

Notes
- The project includes `tpuf_sample.json` (small local sample). Replace with a real export or adapt `services/retriever.js` to query your TPUF if you have credentials.
- `services/evaluator.js` is a local job-aware evaluator stub. It will be used by the pipeline for local scoring. The submission script will call the remote evaluator only when `EVAL_REMOTE=true`.

