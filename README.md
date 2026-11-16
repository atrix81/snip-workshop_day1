# Snip backend

A zero-dependency Bun URL shortener. Links are kept in memory and are cleared
when the server restarts.

## Run

```sh
bun start
```

The server listens on port `3000` by default. Configure `PORT` to change it,
`BASE_URL` to set the origin used for generated short links, or
`RAILWAY_PUBLIC_DOMAIN` to use `https://<domain>` when `BASE_URL` is unset.
Set `PUBLIC_DIR` to serve static files from a directory; `/` serves its
`index.html`, and existing files take precedence over short codes.

## API

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/links` | Create a link from `{ "url": "https://example.com" }` |
| `GET` | `/api/links` | List all links |
| `GET` | `/:code` | Redirect to the original URL and increment its hit count |

Creation returns `201` with `{ code, url, shortUrl, hits, createdAt }`.
Invalid JSON or a non-HTTP(S) URL returns `400`; an unknown code returns `404`.
CORS is enabled for browser clients.
