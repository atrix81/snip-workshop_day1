#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');

const DEFAULT_API = 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 10000;
const USAGE = `Usage:
  snip add <url>    Create a short link
  snip ls           List all links
  snip open <code>  Open a short link in the default browser
  snip help         Show this help

Set SNIP_API to change the backend URL (default: ${DEFAULT_API}).`;

function fail(message) {
  throw new Error(message);
}

function getApiBase() {
  const value = (process.env.SNIP_API || DEFAULT_API).replace(/\/+$/, '');
  let url;

  try {
    url = new URL(value);
  } catch {
    fail('SNIP_API must be a valid http(s) URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('SNIP_API must be a valid http(s) URL.');
  }

  return value;
}

function parseHttpUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    fail('URL must be a valid http(s) URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('URL must be a valid http(s) URL.');
  }

  return url.href;
}

async function request(path, options = {}) {
  const apiBase = getApiBase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(path, `${apiBase}/`), {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error.name === 'AbortError') {
      fail(`Request to ${apiBase} timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }

    fail(`Could not reach API at ${apiBase}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function responseJson({ response, text }) {
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    fail(`Backend returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    fail(data && typeof data.error === 'string'
      ? data.error
      : `Backend returned HTTP ${response.status}.`);
  }

  return data;
}

async function add(url) {
  const result = await request('api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: parseHttpUrl(url) }),
  });
  const link = responseJson(result);

  if (!link || typeof link.shortUrl !== 'string') {
    fail('Backend response is missing shortUrl.');
  }

  console.log(link.shortUrl);
}

async function listLinks() {
  const links = responseJson(await request('api/links'));

  if (!Array.isArray(links)) {
    fail('Backend response must be an array of links.');
  }

  if (links.length === 0) {
    console.log('No links yet.');
    return;
  }

  for (const link of links) {
    if (!link || typeof link.code !== 'string' || typeof link.url !== 'string'
      || !Number.isFinite(Number(link.hits))) {
      fail('Backend response contains an invalid link.');
    }
  }

  const rows = links.map(link => [link.code, String(link.hits), link.url]);
  const widths = [0, 1, 2].map(column => Math.max(
    ['CODE', 'HITS', 'URL'][column].length,
    ...rows.map(row => row[column].length),
  ));
  const formatRow = row => `${row[0].padEnd(widths[0])}  ${row[1].padStart(widths[1])}  ${row[2]}`;

  console.log(formatRow(['CODE', 'HITS', 'URL']));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function openInBrowser(target) {
  let command;
  let args;

  if (process.platform === 'win32') {
    command = 'rundll32.exe';
    args = ['url.dll,FileProtocolHandler', target];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [target];
  } else {
    command = 'xdg-open';
    args = [target];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function open(code) {
  if (!/^[a-zA-Z0-9]{6}$/.test(code)) {
    fail('Code must be exactly six base62 characters.');
  }

  const { response } = await request(encodeURIComponent(code), { redirect: 'manual' });

  if (response.status === 404) {
    fail(`Unknown link: ${code}`);
  }
  if (response.status < 300 || response.status >= 400) {
    fail(`Backend returned HTTP ${response.status} instead of a redirect.`);
  }

  const location = response.headers.get('location');
  if (!location) {
    fail('Backend redirect is missing its Location header.');
  }

  const target = parseHttpUrl(new URL(location, response.url).href);
  try {
    await openInBrowser(target);
  } catch (error) {
    fail(`Could not open the browser: ${error.message}`);
  }

  console.log(`Opened ${target}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  if (command === 'add') {
    if (args.length !== 1) {
      fail('Usage: snip add <url>');
    }
    await add(args[0]);
    return;
  }

  if (command === 'ls') {
    if (args.length !== 0) {
      fail('Usage: snip ls');
    }
    await listLinks();
    return;
  }

  if (command === 'open') {
    if (args.length !== 1) {
      fail('Usage: snip open <code>');
    }
    await open(args[0]);
    return;
  }

  fail(`Unknown command: ${command}\n${USAGE}`);
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
