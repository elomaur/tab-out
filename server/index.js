// server/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Main entry point for the Tab Out server.
//
// Think of this file as the "front door" of the whole app. It:
//   1. Creates the web server (Express)
//   2. Teaches it to understand JSON requests
//   3. Serves the dashboard HTML/CSS/JS files to your browser
//   4. Hooks up all the API routes (defined in routes.js)
//   5. Starts listening for connections on the configured port
//   6. Kicks off the first browsing history analysis (if it's been a while)
//   7. Schedules regular re-analysis so missions stay fresh automatically
//
// Express is like a restaurant: the app is the building, middleware (like
// express.json) are the prep kitchen steps, and routes are the menu items
// that map incoming requests to specific actions.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const path    = require('path');

// Our own modules — config for settings, db for database access,
// routes for the API, and clustering for analysis logic.
const config                    = require('./config');
const { getMeta }               = require('./db');
const { analyzeBrowsingHistory } = require('./clustering');

// ─────────────────────────────────────────────────────────────────────────────
// Create the Express app
//
// express() returns an "application" object — the core of our web server.
// It doesn't listen for requests yet; that happens at app.listen() below.
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: parse incoming JSON bodies
//
// When the browser (or extension) sends a POST request with a JSON body,
// Express needs to know how to read it. express.json() is a "middleware"
// function that intercepts every incoming request and, if the body is JSON,
// parses it and makes it available as req.body.
//
// Without this, req.body would always be undefined on POST routes.
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: serve static files for the dashboard
//
// express.static() is like a file server — it looks in the given directory
// for files matching the URL path. If you visit http://localhost:3456/,
// Express looks for dashboard/index.html and sends it back.
//
// path.join(__dirname, '..', 'dashboard') resolves to:
//   /path/to/tab-mission-control/dashboard
// (__dirname is the directory of THIS file, i.e. server/)
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ─────────────────────────────────────────────────────────────────────────────
// Mount API routes
//
// All routes defined in routes.js will be available under the /api prefix.
// For example, a route defined as router.get('/missions', ...) in routes.js
// becomes accessible at http://localhost:3456/api/missions.
//
// Note: routes.js is being created in parallel. It will be present by the
// time the server actually runs.
// ─────────────────────────────────────────────────────────────────────────────
const apiRouter = require('./routes');
app.use('/api', apiRouter);

// ─────────────────────────────────────────────────────────────────────────────
// checkAndRunAnalysis — smart startup logic
//
// On startup, we don't want to blindly re-run analysis if it was just done
// recently (e.g. you restart the server within the refresh window). So we:
//
//   1. Look up the 'last_analysis' timestamp in the meta table
//   2. Calculate how many minutes have passed since that timestamp
//   3. Only run analysis if more time has passed than refreshIntervalMinutes
//
// This is like checking if you've eaten lunch recently before making a sandwich.
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndRunAnalysis() {
  try {
    // getMeta is a prepared statement: .get({ key }) returns { value } or undefined
    const row = getMeta.get({ key: 'last_analysis' });

    if (row && row.value) {
      // We have a timestamp from the last analysis. Calculate how old it is.
      const lastAnalysisTime = new Date(row.value).getTime();
      const nowTime          = Date.now();
      const minutesElapsed   = (nowTime - lastAnalysisTime) / (1000 * 60);

      if (minutesElapsed < config.refreshIntervalMinutes) {
        // Analysis was done recently enough — no need to run again.
        const minutesUntilNext = Math.ceil(config.refreshIntervalMinutes - minutesElapsed);
        console.log(`[analysis] Last analysis was ${Math.floor(minutesElapsed)}m ago. Next run in ~${minutesUntilNext}m.`);
        return;
      }
    }

    // Either no previous analysis exists, or it's overdue. Run it now.
    console.log('[analysis] Running initial browsing history analysis...');
    await analyzeBrowsingHistory();
    console.log('[analysis] Initial analysis complete.');

  } catch (err) {
    // Don't crash the server if analysis fails on startup — the dashboard
    // can still load, it'll just show empty missions until the next run.
    console.error('[analysis] Startup analysis failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Start the server
//
// app.listen(port, callback) tells Express to start accepting connections.
// The callback runs once the server is successfully bound to the port.
//
// Inside the callback:
//   - We log a startup message so you know the server is ready
//   - We run the initial analysis check
//   - We schedule periodic re-analysis using setInterval
//
// setInterval(fn, ms) runs `fn` every `ms` milliseconds forever.
// config.refreshIntervalMinutes * 60 * 1000 converts minutes → milliseconds.
// ─────────────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`Tab Out running at http://localhost:${config.port}`);

  // Run analysis check immediately on startup (non-blocking — we don't await
  // it here so the server is responsive right away even if analysis takes time)
  checkAndRunAnalysis();

  // Schedule periodic re-analysis. Every refreshIntervalMinutes, re-read
  // Chrome history and re-cluster it so missions stay fresh.
  const intervalMs = config.refreshIntervalMinutes * 60 * 1000;
  setInterval(async () => {
    console.log('[analysis] Running scheduled re-analysis...');
    try {
      await analyzeBrowsingHistory();
      console.log('[analysis] Scheduled re-analysis complete.');
    } catch (err) {
      console.error('[analysis] Scheduled re-analysis failed:', err.message);
    }
  }, intervalMs);

  console.log(`[scheduler] Re-analysis scheduled every ${config.refreshIntervalMinutes} minutes.`);
});
