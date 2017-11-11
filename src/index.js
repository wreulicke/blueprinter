const drafter = require("drafter.js")
const fs = require("fs")
const path = require("path")
const util = require("util")

const readFile = util.promisify(fs.readFile)
const parse = util.promisify(drafter.parse)

const run = async () => {
  const data = await readFile("example/example.apib")
  const md = data.toString()
  const ast = await parse(md, {})
  console.log(JSON.stringify(ast, null, 2))
}

run().catch(console.log)
