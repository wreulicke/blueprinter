#!/usr/bin/env node

process.title = "blueprinter"

require("../lib/bin").run(null, function(err) {
  if (err) {
    process.exit(1)
  }
})
