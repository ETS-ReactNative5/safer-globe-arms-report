import React, { Component } from 'react';
import intl from 'react-intl-universal';
import Clear from 'material-ui-icons/Clear';

import './../styles/components/ArticleNotification.css';

export default class ArticleNotification extends Component {
  constructor(props) {
    super(props);

    const isOpen = JSON.parse(
      window.sessionStorage.getItem('showArticleNotification'),
    );
    this.state = {
      open: isOpen !== null ? isOpen : true,
    };
  }

  closeNotification() {
    window.sessionStorage.setItem('showArticleNotification', false);

    this.setState({
      open: false,
    });
  }

  render() {
    const { fromModal } = this.props;

    return this.state.open && intl.options.currentLocale.includes('en') ? (
      <div
        className={`article-notification ${fromModal && 'article-notification--from-modal'}`}
        onClick={this.closeNotification.bind(this)}
      >
        <span>{intl.get('ARTICLES_ONLY_IN_FINNISH')}</span>
        <Clear onClick={this.closeNotification.bind(this)} />
      </div>
    ) : null;
  }
}
