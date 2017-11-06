const aglio = require('./lib/main')
const util = require('util')
const themes = ['default', 'flatly', 'slate', 'cyborg', 'streak']

const render = util.promisify(aglio.renderFile)
const exmaples = async () => {
  const v = await Promise.all(themes.map(async (theme) => {
    await render('example.apib', `examples/${theme}.html`, {themeVariables: theme})
    await render('example.apib', `examples/${theme}-triple.html`, {themeVariables: theme, themeTemplate: "triple"})
  }))
  return v
}

exmaples().catch(e => console.log("example generation is failed", e))