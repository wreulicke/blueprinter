import * as React from "react"
import * as ReactDOM from "react-dom"
import SplitPane from "react-split-pane"
import JSONTree from "react-json-tree"
const CodeMirror = require("react-codemirror")
const example = require("./example")
const drafter = require("drafter.js")
const debounce = require("lodash.debounce")
const options = {
  lineNumbers: true,
}

const resetEditor = ref => {
  const cm = ref.getCodeMirror()
  cm.setSize("100%", "100%")
}

class Editor extends React.Component {
  state = {
    document: example,
    active: "json",
  }
  componentDidMount() {
    resetEditor(this.refs.editor)
  }
  activeClass(type) {
    return this.state.active === type ? "is-active" : null
  }
  changeMode = mode => {
    return () => this.setState({ active: mode })
  }
  display(mode) {
    return {
      display: this.state.active === mode ? "" : "none",
    }
  }
  changeDocument = debounce(document => this.setState({ document }), 150)
  render() {
    const ast = drafter.parseSync(this.state.document, {})
    return (
      <SplitPane minSize={450} split="vertical">
        <div className="editor" style={{ paddingLeft: "5px" }}>
          <CodeMirror
            ref="editor"
            value={this.state.document}
            onChange={this.changeDocument}
            options={options}
          />
        </div>
        <div
          style={{
            overflow: "scroll",
            width: "100%",
            height: "100%",
            padding: "10px",
          }}
        >
          <div className="tabs">
            <ul>
              <li
                className={this.activeClass("view")}
                onClick={this.changeMode("view")}
              >
                <a>Tree</a>
              </li>
              <li
                className={this.activeClass("html")}
                onClick={this.changeMode("html")}
              >
                <a>HTML</a>
              </li>
            </ul>
          </div>
          <div>
            <div style={this.display("view")}>
              <JSONTree data={ast} theme="mocha" />
            </div>
          </div>
        </div>
      </SplitPane>
    )
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const div = document.createElement("div")
  document.body.appendChild(div)
  ReactDOM.render(<Editor />, div)
})
