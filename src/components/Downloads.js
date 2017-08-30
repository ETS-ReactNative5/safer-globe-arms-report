import React, { Component } from 'react';
import { csv } from 'd3-request';
import intl from 'react-intl-universal';
import { CircularProgress } from 'material-ui/Progress';
import Card, { CardHeader, CardContent, CardActions } from 'material-ui/Card';
import FileDownload from 'material-ui-icons/FileDownload';

import downloads from '../data/downloads.csv';
import './../styles/components/Downloads.css';

class Downloads extends Component {
  constructor(props) {
    super(props);

    this.state = {
      files: [],
      error: false,
      loading: true,
    };
  }

  componentWillMount() {
    csv(downloads, (error, data) => {
      if (error) {
        this.setState({
          error: true,
        });
      } else {
        this.setState({
          files: data,
          loading: false,
          error: false,
        });
      }
    });
  }

  renderCards() {
    return this.state.files.map((data, i) => {
      const filepath = require(`../data/downloads/${data.filename}`);

      return (
        <Card className="card box-shadow" key={i}>
          <a href={filepath} target="_blank" download={data.filename}>
            <CardHeader className="header" title={data.title} />
            <CardContent className="content">
              {data.desc}
            </CardContent>
            <CardActions className="actions">
              <FileDownload />
            </CardActions>
          </a>
        </Card>
      );
    });
  }

  render() {
    return (
      <section className="downloads flex-container">
        {this.state.loading ? <CircularProgress className="loading" /> : null}
        {this.state.error
          ? <div className="not-found">
              {intl.get('LOADING_ERROR')}
            </div>
          : null}
        {this.state.files ? this.renderCards() : null}
      </section>
    );
  }
}

export default Downloads;
