import React from "react";
// import Quill from 'quill/core';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// function imageHandler() {
//   const range = this.quill.getSelection();
//   const value = prompt('What is the image URL');
//   if (value) {
//     this.quill.insertEmbed(range.index, 'image', value, Quill.sources.USER);
//   }
// }

export default function AdminQuill({label, value, onChange}) {
  const toolbarOptions = [
    [{'header': [2, 3, false]}],
    ['bold', 'italic', 'underline', 'blockquote', 'code-block'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    [
      'link',
      // 'image',
    ],
    ['clean']
  ];
  const modules = {
    toolbar: {
      container: toolbarOptions,
      // handlers: {
      //   image: imageHandler,
      // },
    },
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'blockquote', 'code-block',
    'list', 'bullet', 'indent',
    'link',
    'image',
  ];

  return <div>
    <div className="lh-page-subtitle">
      {label}
    </div>
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      formats={formats}
    />
  </div>
}
