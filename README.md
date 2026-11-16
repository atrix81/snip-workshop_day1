# Snip CLI

A zero-dependency Node.js command-line client for the Snip URL shortener API.
Requires Node.js 20 or later. Set `SNIP_API` to the backend URL; it defaults
to `http://localhost:3000`.

```sh
node cli.js add https://example.com
node cli.js ls
node cli.js open ABC123
```

The `snip`, `snip.cmd`, and `snip.ps1` wrappers run `cli.js` on POSIX shells,
Command Prompt, and PowerShell respectively.
