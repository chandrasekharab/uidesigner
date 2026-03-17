'use client';

import React, { memo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const CodeMirrorEditor = memo(function CodeMirrorEditor({
  value,
  onChange,
  onBlur,
}: CodeMirrorEditorProps) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={oneDark}
      extensions={[json()]}
      onChange={onChange}
      onBlur={onBlur}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        autocompletion: true,
        indentOnInput: true,
      }}
      style={{ height: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, Fira Code, monospace' }}
    />
  );
});

export default CodeMirrorEditor;
