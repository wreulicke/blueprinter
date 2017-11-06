/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require("fs")
const path = require("path")
const drafter = require("drafter")

const INCLUDE = /( *)<!-- include\((.*)\) -->/gim

// Legacy template names
const LEGACY_TEMPLATES = [
  "default",
  "default-collapsed",
  "flatly",
  "flatly-collapsed",
  "slate",
  "slate-collapsed",
  "cyborg",
  "cyborg-collapsed",
]

// Utility for benchmarking
const benchmark = {
  start(message) {
    if (process.env.BENCHMARK) {
      return console.time(message)
    }
  },
  end(message) {
    if (process.env.BENCHMARK) {
      return console.timeEnd(message)
    }
  },
}

// Extend an error's message. Returns the modified error.
const errMsg = function(message, err) {
  err.message = `${message}: ${err.message}`
  return err
}

// Replace the include directive with the contents of the included
// file in the input.
const includeReplace = function(includePath, match, spaces, filename) {
  const fullPath = path.join(includePath, filename)
  const lines = fs
    .readFileSync(fullPath, "utf-8")
    .replace(/\r\n?/g, "\n")
    .split("\n")
  const content = spaces + lines.join(`\n${spaces}`)

  // The content can itself include other files, so check those
  // as well! Beware of circular includes!
  return includeDirective(path.dirname(fullPath), content)
}

// Handle the include directive, which inserts the contents of one
// file into another. We find the directive using a regular expression
// and replace it using the method above.
const includeDirective = function(includePath, input) {
  return input.replace(INCLUDE, includeReplace.bind(this, includePath))
}

// Get a list of all paths from included files. This *excludes* the
// input path itself.
exports.collectPathsSync = function(input, includePath) {
  let paths = []
  input.replace(INCLUDE, function(match, spaces, filename) {
    const fullPath = path.join(includePath, filename)
    paths.push(fullPath)

    const content = fs.readFileSync(fullPath, "utf-8")
    return (paths = paths.concat(
      exports.collectPathsSync(content, path.dirname(fullPath))
    ))
  })
  return paths
}

// Get the theme module for a given theme name
exports.getTheme = function(name) {
  if (!name || Array.from(LEGACY_TEMPLATES).includes(name)) {
    name = "olio"
  }
  return require(`aglio-theme-${name}`)
}

// Render an API Blueprint string using a given template
exports.render = function(input, options, done) {
  // Support a template name as the options argument
  if (typeof options === "string" || options instanceof String) {
    options = { theme: options }
  }

  // Defaults
  if (options.filterInput == null) {
    options.filterInput = true
  }
  if (options.includePath == null) {
    options.includePath = process.cwd()
  }
  if (options.theme == null) {
    options.theme = "default"
  }

  // For backward compatibility
  if (options.template) {
    options.theme = options.template
  }

  if (fs.existsSync(options.theme)) {
    console.log(`Setting theme to olio and layout to ${options.theme}`)
    options.themeLayout = options.theme
    options.theme = "olio"
  } else if (
    options.theme !== "default" &&
    Array.from(LEGACY_TEMPLATES).includes(options.theme)
  ) {
    const variables = options.theme.split("-")[0]
    console.log(`Setting theme to olio and variables to ${variables}`)
    options.themeVariables = variables
    options.theme = "olio"
  }

  // Handle custom directive(s)
  input = includeDirective(options.includePath, input)

  // Drafter does not support \r ot \t in the input, so
  // try to intelligently massage the input so that it works.
  // This is required to process files created on Windows.
  const filteredInput = !options.filterInput
    ? input
    : input.replace(/\r\n?/g, "\n").replace(/\t/g, "    ")

  benchmark.start("parse")

  drafter.parse(filteredInput, { type: "ast" }, function(err, res) {
    let theme
    benchmark.end("parse")
    if (err) {
      err.input = input
      return done(errMsg("Error parsing input", err))
    }

    try {
      theme = exports.getTheme(options.theme)
    } catch (error) {
      err = error
      return done(errMsg("Error getting theme", err))
    }

    // Setup default options if needed
    for (const option of Array.from(theme.getConfig().options || [])) {
      // Convert `foo-bar` into `themeFooBar`
      const words = Array.from(option.name.split("-")).map(
        f => f[0].toUpperCase() + f.slice(1)
      )
      const name = `theme${words.join("")}`
      if (options[name] == null) {
        options[name] = option.default
      }
    }

    benchmark.start("render-total")
    theme.render(res.ast, options, function(err, html) {
      benchmark.end("render-total")
      if (err) {
        return done(err)
      }

      // Add filtered input to warnings since we have no
      // error to return
      res.warnings.input = filteredInput

      done(null, html, res.warnings)
    })
  })
}

// Render from/to files
exports.renderFile = function(inputFile, outputFile, options, done) {
  const render = input =>
    exports.render(input, options, function(err, html, warnings) {
      if (err) {
        return done(err)
      }

      if (outputFile !== "-") {
        fs.writeFile(outputFile, html, err => done(err, warnings))
      } else {
        console.log(html)
        done(null, warnings)
      }
    })

  if (inputFile !== "-") {
    if (options.includePath == null) {
      options.includePath = path.dirname(inputFile)
    }
    fs.readFile(inputFile, { encoding: "utf-8" }, function(err, input) {
      if (err) {
        return done(errMsg("Error reading input", err))
      }
      render(input.toString())
    })
  } else {
    process.stdin.setEncoding("utf-8")
    process.stdin.on("readable", function() {
      const chunk = process.stdin.read()
      if (chunk != null) {
        render(chunk)
      }
    })
  }
}

// Compile markdown from/to files
exports.compileFile = function(inputFile, outputFile, done) {
  const compile = function(input) {
    const compiled = includeDirective(path.dirname(inputFile), input)

    if (outputFile !== "-") {
      return fs.writeFile(outputFile, compiled, err => done(err))
    } else {
      console.log(compiled)
      return done(null)
    }
  }

  if (inputFile !== "-") {
    return fs.readFile(inputFile, { encoding: "utf-8" }, function(err, input) {
      if (err) {
        return done(errMsg("Error writing output", err))
      }
      return compile(input.toString())
    })
  } else {
    process.stdin.setEncoding("utf-8")
    return process.stdin.on("readable", function() {
      const chunk = process.stdin.read()
      if (chunk != null) {
        return compile(chunk)
      }
    })
  }
}
