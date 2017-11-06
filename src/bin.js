/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const aglio = require("./main")
const chokidar = require("chokidar")
const clc = require("cli-color")
const fs = require("fs")
const http = require("http")
const path = require("path")
const PrettyError = require("pretty-error")
const serveStatic = require("serve-static")
const parser = require("yargs")
  .usage("Usage: $0 [options] -i infile [-o outfile -s]")
  .example("$0 -i example.apib -o output.html", "Render to HTML")
  .example("$0 -i example.apib -s", "Start preview server")
  .example("$0 --theme-variables flatly -i example.apib -s", "Theme colors")
  .example("$0 --no-theme-condense-nav -i example.apib -s", "Disable options")
  .options("i", { alias: "input", describe: "Input file" })
  .options("o", { alias: "output", describe: "Output file" })
  .options("t", {
    alias: "theme",
    describe: "Theme name or layout file",
    default: "olio",
  })
  .options("f", {
    alias: "filter",
    boolean: true,
    describe: "Sanitize input from Windows",
    default: true,
  })
  .options("s", {
    alias: "server",
    describe: "Start a local live preview server",
  })
  .options("h", {
    alias: "host",
    describe: "Address to bind local preview server to",
    default: "127.0.0.1",
  })
  .options("p", {
    alias: "port",
    describe: "Port for local preview server",
    default: 3000,
  })
  .options("v", {
    alias: "version",
    describe: "Display version number",
    default: false,
  })
  .options("c", {
    alias: "compile",
    describe: "Compile the blueprint file",
    default: false,
  })
  .options("n", {
    alias: "include-path",
    describe: "Base directory for relative includes",
  })
  .options("verbose", {
    describe: "Show verbose information and stack traces",
    default: false,
  })
  .epilog(
    "See https://github.com/danielgtaylor/aglio#readme for more information"
  )

// Console color settings for error/warnings
const cErr = clc.white.bgRed
const cWarn = clc.xterm(214).bgXterm(235)

// Get the context from an error if possible
const getErrContext = function(input, lineNo) {
  const inputLines = input.split("\n")
  const context = inputLines.slice(lineNo - 5, lineNo + 5)
  return context.map(function(line, index) {
    if (index === 4) {
      return cWarn(`>>>>   ${line}`)
    } else {
      return `       ${line}`
    }
  })
}

// Get a line number from an error if possible
const getLineNo = function(input, err) {
  if (err.location && err.location.length) {
    return input.substr(0, err.location[0].index).split("\n").length
  }
}

// Output warning info
const logWarnings = warnings => {
  for (const warning of Array.from(warnings || [])) {
    const lineNo = getLineNo(warnings.input, warning) || 0
    const errContext = getErrContext(warnings.input, lineNo)
    console.error(
      `${cWarn(
        `>> Line ${lineNo}:`
      )} ${warning.message} (warning code ${warning.code})`
    )
    console.error(cWarn(">> Context"))
    console.error(`       ...\n ${errContext.join("\n")} \n       ...`)
  }
}

// Output an error message
const logError = function(err, verbose) {
  if (verbose) {
    const pe = new PrettyError()
    pe.setMaxItems(5)
    console.error(pe.render(err))
  } else {
    console.error(cErr(">>"), err)
  }
}

exports.run = function(argv, done) {
  let theme
  if (argv == null) {
    argv = parser.argv
  }
  if (done == null) {
    done = function() {}
  }
  let _html = null
  const getHtml = function(cb) {
    if (_html) {
      cb && cb(null, _html)
    } else {
      fs.readFile(argv.i, "utf-8", function(err, blueprint) {
        console.log(`Rendering ${argv.i}`)
        aglio.render(blueprint, argv, function(err, html, warnings) {
          logWarnings(warnings)
          if (err) {
            logError(err, argv.verbose)
            cb && cb(err)
          } else {
            _html = html
            cb && cb(null, _html)
          }
        })
      })
    }
  }

  if (argv.version) {
    console.log(`aglio ${require("../package.json").version}`)
    console.log(`olio ${require("aglio-theme-olio/package.json").version}`)
    done()
    return
  }

  // Backward-compatible support for -t /path/to/layout.jade
  if (fs.existsSync(argv.theme)) {
    argv.themeTemplate = argv.theme
    argv.theme = "olio"
  }

  // Add theme options to the help output
  if (argv.verbose) {
    console.log(`Loading theme ${argv.theme}`)
  }
  try {
    theme = aglio.getTheme(argv.theme)
  } catch (error) {
    const err = error
    err.message = `Could not load theme: ${err.message}`
    logError(err, argv.verbose)
    done(err)
    return
  }

  const config = theme.getConfig()
  for (const entry of Array.from(config.options)) {
    parser.options(`theme-${entry.name}`, entry)
  }

  if (argv.s) {
    if (!argv.i) {
      parser.showHelp()
      done("Invalid arguments")
      return
    }

    argv.locals = { livePreview: true }

    // Set where to include files from before generating HTML
    if (argv.i !== "-") {
      argv.includePath = path.dirname(argv.i)
    }

    getHtml()
    const server = http
      .createServer(function(req, res) {
        if (req.url !== "/") {
          const serve = serveStatic(path.dirname(argv.i))
          serve(req, res, () => res.end())
          return
        }

        getHtml(function(err, html) {
          res.writeHead(200, { "Content-Type": "text/html" })

          res.end(err ? err.toString() : html)
        })
      })
      .listen(argv.p, argv.h, () =>
        console.log(`Server started on http://${argv.h}:${argv.p}/`)
      )

    const sendHtml = socket =>
      getHtml(function(err, html) {
        if (!err) {
          console.log("Refresh web page in browser")
          const re = /<body.*?>[^]*<\/body>/gi
          html = html.match(re)[0]
          socket.emit("refresh", html)
        }
      })

    const io = require("socket.io")(server)
    io.on("connection", function(socket) {
      console.log("Socket connected")
      socket.on("request-refresh", () => sendHtml(socket))
    })

    const paths = aglio.collectPathsSync(
      fs.readFileSync(argv.i, "utf-8"),
      path.dirname(argv.i)
    )

    const watcher = chokidar.watch([argv.i].concat(paths))
    watcher.on("change", function(path) {
      console.log(`Updated ${path}`)
      _html = null
      sendHtml(io)
    })

    done()
  } else {
    // Render or Compile API Blueprint, requires input/output files
    if (!argv.i || !argv.o) {
      parser.showHelp()
      done("Invalid arguments")
      return
    }

    if (
      argv.c ||
      (typeof argv.o === "string" &&
        argv.o.match(/\.apib$/ || argv.o.match(/\.md$/)))
    ) {
      aglio.compileFile(argv.i, argv.o, function(err) {
        if (err) {
          logError(err, argv.verbose)
          done(err)
          return
        }

        done()
      })
    } else {
      aglio.renderFile(argv.i, argv.o, argv, function(err, warnings) {
        if (err) {
          const lineNo = getLineNo(err.input, err)
          if (lineNo != null) {
            console.error(
              `${cErr(
                `>> Line ${lineNo}:`
              )} ${err.message} (error code ${err.code})`
            )
          } else {
            logError(err, argv.verbose)
          }

          done(err)
          return
        }

        logWarnings(warnings)

        done()
      })
    }
  }
}
