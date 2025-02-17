import React, { Component } from 'react';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { ShareButtons, generateShareIcon } from 'react-share';
import ReactMarkdown from 'react-markdown-it';
import intl from 'react-intl-universal';
import { CircularProgress } from 'material-ui/Progress';

import ArticleNotification from './ArticleNotification';
import './../styles/components/FullStory.css';
import resolveUrl from '../resolveUrl';

const { FacebookShareButton, TwitterShareButton } = ShareButtons;
const FacebookIcon = generateShareIcon('facebook');
const TwitterIcon = generateShareIcon('twitter');

class FullStory extends Component {
  constructor(props) {
    super(props);

    this.state = {
      tags: [],
      title: null,
      date: null,
      id: 0,
      image: null,
      body: null,
      error: false,
      loading: true,
      author: null,
    };
  }

  componentDidMount() {
    const storyId = this.props.match.params.id;
    const url = require(`../data/stories/${storyId}.md`);

    fetch(url)
      .then(response => {
        return response.text();
      })
      .then(text => {
        const lines = text.split('\n');
        const tags = lines[0].split(',').reduce((ary, cur) => {
          ary.push(`#${cur.trim()}`);
          return ary;
        }, []);
        const date = lines[1];
        const author = lines[2];
        const image = resolveUrl(lines[3]);
        const body = lines
          .slice(4)
          .join('\n')
          .trim();
        this.setState({
          tags,
          date,
          image,
          body,
          author,
          id: this.props.match.params.id,
          error: false,
          loading: false,
        });
      });
  }

  render() {
    const { isModal } = this.props;
    const articleLink = window.location.href;
    let tags = this.state.tags.map((d, i) => (
      <div className={'tags'} key={i}>
        {d.substring(1)}
      </div>
    ));
    return (
      <div className="flex-container-row acticleDiv">
        {!isModal && (
          <Link to="/articles" className="left-menu">
            <div className="back-to-articles box-shadow">
              {intl.get('BACK_TO_ARTICLES')}
            </div>
          </Link>
        )}

        {this.state.loading ? <CircularProgress className="loading" /> : null}
        {this.state.error ? (
          <div className="not-found">{intl.get('NOT_FOUND')}</div>
        ) : null}

        {this.state.body ? (
          <div>
            <ArticleNotification fromModal={isModal} />
            <section className="text-box full-story-container flex-container box-shadow">
              <div className="story-image">
                <img src={this.state.image} alt={this.state.title} />
              </div>
              <div className="story-date">
                <div>{this.state.date}</div>
                {this.state.author ? (
                  <div>
                    {intl.get('TEXT_BY')}: {this.state.author}
                  </div>
                ) : null}
              </div>
              <div className="story-tags">{tags}</div>
              <div className="story-text md">
                <div className="story-share flex-container-column">
                  <div>
                    <FacebookShareButton
                      url={articleLink}
                      title={this.state.title}
                      picture={this.state.image}
                    >
                      <FacebookIcon size={38} round={false} />
                    </FacebookShareButton>
                    <TwitterShareButton
                      url={articleLink}
                      title={this.state.title}
                      hastag={this.state.tags.join(' ')}
                    >
                      <TwitterIcon size={38} round={false} />
                    </TwitterShareButton>
                  </div>
                </div>
                <ReactMarkdown className="md" source={this.state.body || ''} />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }
}

FullStory.propTypes = {
  match: PropTypes.object,
};

export default withRouter(FullStory);
