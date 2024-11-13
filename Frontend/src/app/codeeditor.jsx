import React from "react";
import MonacoEditor from "react-monaco-editor";

function CodeEditor({ code = "", setCode = () => {} }) {
  const options = {
    selectOnLineNumbers: true,
    renderIndentGuides: true,
    colorDecorators: true,
    cursorBlinking: "blink",
    autoClosingQuotes: "always",
    find: {
      autoFindInSelection: "always",
    },
  };

  return (
    <MonacoEditor
      width="800"
      height="400"
      language="javascript"
      theme="vs-light"
      value={code}
      options={options}
      onChange={(newValue) => setCode(newValue)}
    />
  );
}

export default CodeEditor;
