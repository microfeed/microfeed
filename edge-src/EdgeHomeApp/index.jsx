import React from "react";

export default class EdgeHomeApp extends React.Component {
  render() {
    return (
      <div className="text-xl font-bold text-red-500">
        Hello, {this.props.name} from React server-side rendering
      </div>
    );
  }
}
