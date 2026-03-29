# Teeth Simulator API

## Setup

1. Add `HF_API_TOKEN` in your `.env`.
2. Start the API:

```bash
npm run dev:api
```

## Endpoints

- `GET /health`
- `POST /api/teeth/simulate` (multipart/form-data with `image`)
  - Streams `progress` + `complete` events via SSE.
  - `complete` now includes:
    - `simulatedImage`, `originalImage`
    - `issuesList`, `idealDescription`
    - `scores`, `jaw`, `recommendation`
    - `modelMeta` (segment confidence + image stats)

## Local pipeline test

Run the full model chain against a sample image and print a JSON summary:

```bash
npm run test:pipeline -- images/center-smile.jpg
```
