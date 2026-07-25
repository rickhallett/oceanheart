"use strict";

const RETIRED_BODY = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page retired | Oceanheart</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      body {
        display: grid;
        min-height: 100vh;
        margin: 0;
        place-items: center;
        background: #10141b;
        color: #d8dee9;
      }

      main {
        width: min(36rem, calc(100% - 3rem));
      }

      p {
        line-height: 1.65;
      }

      a {
        color: #7dd3c7;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Page retired</h1>
      <p>This page belonged to an earlier Oceanheart publication and has been retired.</p>
      <p>The current site is <a href="https://www.oceanheart.ai/">oceanheart.ai</a>.</p>
    </main>
  </body>
</html>
`;

module.exports = function retired(request, response) {
  response.statusCode = 410;
  response.setHeader("Cache-Control", "public, max-age=300");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(RETIRED_BODY);
};

module.exports.RETIRED_BODY = RETIRED_BODY;
