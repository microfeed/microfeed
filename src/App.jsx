import React from 'react';
// import './App.css';

export default class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            text: '',
        }
    }

    componentDidMount() {
        // fetch('/api/search', {
        //     method: 'GET',
        // }).then((response) => response.text()).then((text) => {
        //     this.setState({
        //         text,
        //     });
        // });
    }

    render() {
        return (<div>
            Rendered from client-side react
        </div>);
    }
}
