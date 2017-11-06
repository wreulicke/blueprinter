/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const aglio = require("../lib/main")
const assert = require("assert")
const bin = require("../lib/bin")
const fs = require("fs")
const http = require("http")
const path = require("path")
const drafter = require("drafter")
const sinon = require("sinon")

const root = path.dirname(__dirname)

const blueprint = fs.readFileSync(path.join(root, "example.apib"), "utf-8")

describe("API Blueprint Renderer", function() {
  it("Case1: Should load the default theme", function() {
    const theme = aglio.getTheme("default")

    assert.ok(theme)
  })

  it("Case2: Should get a list of included files", function() {
    sinon.stub(fs, "readFileSync", () => "I am a test file")

    const input = `\
# Title
<!-- include(test1.apib) -->
Some content...
<!-- include(test2.apib) -->
More content...\
`

    const paths = aglio.collectPathsSync(input, ".")

    fs.readFileSync.restore()

    assert.equal(paths.length, 2)
    assert(Array.from(paths).includes("test1.apib"))
    assert(Array.from(paths).includes("test2.apib"))
  })

  it("Case3: Should render blank string", function(done) {
    aglio.render("", { template: "default", locals: { foo: 1 } }, function(
      err,
      html
    ) {
      if (err) {
        return done(err)
      }

      assert(html)

      done()
    })
  })

  it("Case4: Should render a complex document", function(done) {
    aglio.render(blueprint, "default", function(err, html) {
      if (err) {
        return done(err)
      }

      assert(html)

      // Ensure include works
      assert(html.indexOf("This is content that was included"))

      done()
    })
  })

  it("Case5: Should render mixed line endings and tabs properly", function(
    done
  ) {
    const temp = "# GET /message\r\n+ Response 200 (text/plain)\r\r\t\tHello!\n"
    aglio.render(temp, "default", done)
  })

  it("Case6: Should render a custom template by filename", function(done) {
    const template = path.join(root, "test", "test.jade")
    aglio.render("# Blueprint", template, function(err, html) {
      if (err) {
        return done(err)
      }

      assert(html)

      done()
    })
  })

  it("Case7: Should return warnings with filtered input", function(done) {
    const temp = "# GET /message\r\n+ Response 200 (text/plain)\r\r\t\tHello!\n"
    const filteredTemp = temp.replace(/\r\n?/g, "\n").replace(/\t/g, "    ")

    aglio.render(temp, "default", function(err, html, warnings) {
      if (err) {
        return done(err)
      }

      assert.equal(filteredTemp, warnings.input)

      done()
    })
  })

  it("Case8: Should render from/to files", function(done) {
    const src = path.join(root, "example.apib")
    const dest = path.join(root, "example.html")
    aglio.renderFile(src, dest, {}, function(e) {
      if (e) {
        fs.unlinkSync("example.html")
        return done(e)
      }
      fs.unlinkSync("example.html")
      done()
    })
  })

  it("Case9: Should render from stdin", function(done) {
    sinon.stub(process.stdin, "read", () => "# Hello\n")

    setTimeout(() => process.stdin.emit("readable", 1))

    aglio.renderFile("-", "example.html", "default", function(err) {
      if (err) {
        process.stdin.read.restore()
        return done(err)
      }

      assert(process.stdin.read.called)
      process.stdin.read.restore()
      process.stdin.removeAllListeners()

      done()
    })
  })

  it("Case10: Should render to stdout", function(done) {
    sinon.stub(console, "log")

    aglio.renderFile(path.join(root, "example.apib"), "-", "default", function(
      err
    ) {
      if (err) {
        console.log.restore()
        return done(err)
      }

      assert(console.log.called)
      console.log.restore()

      done()
    })
  })

  it("Case11: Should compile from/to files", function(done) {
    const src = path.join(root, "example.apib")
    const dest = path.join(root, "example-compiled.apib")
    aglio.compileFile(src, dest, done)
  })

  it("Case12: Should compile from stdin", function(done) {
    sinon.stub(process.stdin, "read", () => "# Hello\n")

    setTimeout(() => process.stdin.emit("readable", 1))

    aglio.compileFile("-", "example-compiled.apib", function(err) {
      if (err) {
        process.stdin.read.restore()
        return done(err)
      }

      assert(process.stdin.read.called)
      process.stdin.read.restore()
      process.stdin.removeAllListeners()

      done()
    })
  })

  it("Case13: Should compile to stdout", function(done) {
    sinon.stub(console, "log")

    aglio.compileFile(path.join(root, "example.apib"), "-", function(err) {
      if (err) {
        console.log.restore()
        return done(err)
      }

      assert(console.log.called)
      console.log.restore()

      done()
    })
  })

  it("Case14: Should support legacy theme names", function(done) {
    aglio.render("", { template: "flatly" }, function(err, html) {
      if (err) {
        return done(err)
      }

      assert(html)

      done()
    })
  })

  it("Case15: Should error on missing input file", function(done) {
    aglio.renderFile("missing", "output.html", "default", function(err) {
      assert(err)

      aglio.compileFile("missing", "output.apib", function(err) {
        assert(err)
        done()
      })
    })
  })

  it("Case16: Should error on bad template", function(done) {
    aglio.render(blueprint, "bad", function(err) {
      assert(err)

      done()
    })
  })

  it("Case17: Should error on drafter failure", function(done) {
    sinon.stub(drafter, "parse", (content, options, callback) =>
      callback("error")
    )

    aglio.render(blueprint, "default", function(err) {
      assert(err)

      drafter.parse.restore()

      done()
    })
  })

  it("Case18: Should error on file read failure", function(done) {
    sinon.stub(fs, "readFile", (filename, options, callback) =>
      callback("error")
    )

    aglio.renderFile("foo", "bar", "default", function(err) {
      assert(err)

      fs.readFile.restore()

      done()
    })
  })

  it("Case19: Should error on file write failure", function(done) {
    sinon.stub(fs, "writeFile", (filename, data, callback) => callback("error"))

    aglio.renderFile("foo", "bar", "default", function(err) {
      assert(err)

      fs.writeFile.restore()

      done()
    })
  })

  it("Case20: Should error on non-file failure", function(done) {
    sinon.stub(aglio, "render", (content, template, callback) =>
      callback("error")
    )

    aglio.renderFile(
      path.join(root, "example.apib"),
      "bar",
      "default",
      function(err) {
        assert(err)

        aglio.render.restore()

        done()
      }
    )
  })
})

describe("Executable", function() {
  it("Case21: Should print a version", function(done) {
    sinon.stub(console, "log")

    bin.run({ version: true }, function(err) {
      assert(console.log.args[0][0].match(/aglio \d+/))
      assert(console.log.args[1][0].match(/olio \d+/))
      console.log.restore()
      done(err)
    })
  })

  it("Case22: Should render a file", function(done) {
    sinon.stub(console, "error")

    sinon.stub(aglio, "renderFile", function(i, o, t, callback) {
      const warnings = [
        {
          code: 1,
          message: "Test message",
          location: [
            {
              index: 0,
              length: 1,
            },
          ],
        },
      ]
      warnings.input = "test"
      callback(null, warnings)
    })

    bin.run({}, err => assert(err))

    bin.run({ i: path.join(root, "example.apib"), o: "-" }, function() {
      console.error.restore()
      aglio.renderFile.restore()
      done()
    })
  })

  it("Case23: Should compile a file", function(done) {
    sinon.stub(aglio, "compileFile", (i, o, callback) => callback(null))

    bin.run({ c: 1, i: path.join(root, "example.apib"), o: "-" }, function() {
      aglio.compileFile.restore()
      done()
    })
  })

  it("Case24: Should start a live preview server", function(done) {
    this.timeout(5000)

    sinon.stub(aglio, "render", (i, t, callback) => callback(null, "foo"))

    sinon.stub(http, "createServer", handler => ({
      listen(port, host, cb) {
        console.log("calling listen")
        // Simulate requests
        let req = { url: "/favicon.ico" }
        let res = {
          end(data) {
            assert(!data)
          },
        }
        handler(req, res)

        req = { url: "/" }
        res = {
          writeHead() {
            false
          },
          end() {
            aglio.render.restore()
            cb()
            const file = fs.readFileSync("example.apib", "utf8")
            setTimeout(function() {
              fs.writeFileSync("example.apib", file, "utf8")
              setTimeout(function() {
                console.log.restore()
                done()
              }, 500)
            }, 500)
          },
        }
        handler(req, res)
      },
    }))

    sinon.stub(console, "log")
    sinon.stub(console, "error")

    bin.run({ s: true }, function(err) {
      console.error.restore()
      assert(err)

      bin.run(
        {
          i: path.join(root, "example.apib"),
          s: true,
          p: 3000,
          h: "localhost",
        },
        function(err) {
          assert.equal(err, null)
          http.createServer.restore()
        }
      )
    })
  })

  it("Case25: Should support custom Jade template shortcut", function(done) {
    sinon.stub(console, "log")

    bin.run(
      { i: path.join(root, "example.apib"), t: "test.jade", o: "-" },
      function(err) {
        console.log.restore()
        done(err)
      }
    )
  })

  it("Case26: Should handle theme load errors", function(done) {
    sinon.stub(console, "error")
    sinon.stub(aglio, "getTheme", function() {
      throw new Error("Could not load theme")
    })

    bin.run({ template: "invalid" }, function(err) {
      console.error.restore()
      aglio.getTheme.restore()
      assert(err)
      done()
    })
  })

  it("Case27: Should handle rendering errors", function(done) {
    sinon.stub(aglio, "renderFile", (i, o, t, callback) =>
      callback({
        code: 1,
        message: "foo",
        input: "foo bar baz",
        location: [{ index: 1, length: 1 }],
      })
    )

    sinon.stub(console, "error")

    bin.run({ i: path.join(root, "example.apib"), o: "-" }, function() {
      assert(console.error.called)

      console.error.restore()
      aglio.renderFile.restore()

      done()
    })
  })
})
