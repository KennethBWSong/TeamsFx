import "./Widget.css";

import { Component } from "react";

/**
 * Defined a widget, it's also a react component.
 * For more information about react component, please refer to https://reactjs.org/docs/react-component.html
 */
export class Widget extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  /**
   * This method is invoked immediately after a component is mounted.
   * It's a good place to fetch data from server.
   * For more information about react lifecycle, please refer to https://reactjs.org/docs/react-component.html#componentdidmount
   */
  async componentDidMount() {
    this.setState({ ...(await this.getData()) });
  }

  /**
   * Define your widget layout, you can edit the code here to customize your widget.
   */
  render() {
    return (
      <div className="widget-root">
        {this.headerContent() && <div className="widget-header">{this.headerContent()}</div>}
        {this.bodyContent() && <div>{this.bodyContent()}</div>}
        {this.footerContent() && <div>{this.footerContent()}</div>}
      </div>
    );
  }

  /**
   * Get data required by the widget, you can get data from a api call or static data stored in a file. Override this method according to your needs.
   * @returns data for the widget
   */
  async getData() {
    return new Promise()(() => {});
  }

  /**
   * Override this method to customize the widget header.
   * @returns JSX component for the widget body
   */
  headerContent() {
    return undefined;
  }

  /**
   * Override this method to customize the widget body.
   * @returns JSX component for the widget body
   */
  bodyContent() {
    return undefined;
  }

  /**
   * Override this method to customize the widget footer.
   * @returns react node for the widget footer
   */
  footerContent() {
    return undefined;
  }
}
