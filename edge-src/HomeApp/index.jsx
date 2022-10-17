import React from "react";

export default class HelloMessage extends React.Component {
  render() {
    return <div class="text-xl font-bold">Hello, {this.props.name} from React server-side rendering</div>;
  }
}
