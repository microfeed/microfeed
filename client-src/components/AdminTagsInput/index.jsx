import React, { useState } from "react";
import clsx from "clsx";
import './style.css'

export default function AdminTagsInput(
  { label, labelComponent = null, placeholder = '', disabled = false,
    setRef = () => { }, customLabelClass = '', customClass = '', type = 'text',
    extraParams = {} }) {

  const [input, setInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isKeyReleased, setIsKeyReleased] = useState(false);


  const onChange = (e) => {
    const { value } = e.target;
    setInput(value);
  };

  const onKeyDown = (e) => {
    const { key } = e;
    const trimmedInput = input.trim();

    if (key === ',' && trimmedInput.length && !tags.includes(trimmedInput)) {
      e.preventDefault();
      setTags(prevState => [...prevState, trimmedInput]);
      setInput('');
    }

    if (key === "Backspace" && !input.length && tags.length && isKeyReleased) {
      const tagsCopy = [...tags];
      const poppedTag = tagsCopy.pop();
      e.preventDefault();
      setTags(tagsCopy);
      setInput(poppedTag);
    }

    setIsKeyReleased(false);
  };

  const onKeyUp = () => {
    setIsKeyReleased(true);
  }

  const deleteTag = (index) => {
    setTags(prevState => prevState.filter((tag, i) => i !== index))
  }

  return (<label className="w-full">
    {label && <div className={clsx(customLabelClass || "lh-page-subtitle")}>{label}</div>}
    {labelComponent}
    <div className="container">
      {tags.map((tag, index) => (
        <div className="tag">
          {tag}
          <button onClick={() => deleteTag(index)}>x</button>
        </div>
      ))}
      <input
        type={type}
        placeholder={placeholder}
        value={input || ''}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        ref={(ref) => setRef(ref)}
        className={clsx('w-full rounded', customClass || 'text-sm', disabled && 'bg-gray-100')}
        disabled={disabled}
        {...extraParams}
      />
    </div>
  </label>);
}
