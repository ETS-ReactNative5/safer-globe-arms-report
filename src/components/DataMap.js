import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import * as topojson from 'topojson';
import * as d3GeoProjection from 'd3-geo-projection';
import { csv } from 'd3-request';
import formatEuros from '../utils/formatEuros';
import drawArc from '../utils/drawArcs';
import commentLine from '../utils/commentLine';

/*
  This component builds the primary data map.

  The state.gpiYear is default set to 2016 but this once we have the full data set, this would be good to default
  to whatever the last year is in the data set.

  Using that year, the initial map is built and colored.

  Note that every time the GPI year is updated, the map is cleared and drawn again from scratch

  This component received one required prop from the <Data> component called this.props.gpiYear. (See Proptypes at the bottom)
*/

class DataMap extends Component {
  constructor() {
    super();
    this.drawMap = this.drawMap.bind(this);

    this.state = {
      gpiYear: 2015,
      saferGlobeData: {},
    };
  }

  shouldComponentUpdate() {
    if (this.state.saferGlobeData && this.props.gpiYear) {
      return false;
    } else {
      return true;
    }
  }
  componentWillMount() {
    this.setState({ saferGlobeData: this.props.mapData });
  }
  componentDidMount() {
    if (window.timeline && window.nav && window.sidebar) this.render();
  }
  drawMap(displayData) {
    let totalExport = [{}],
      intlMissions = [{}];
    d3.select('.map-container').html('');
    const wid = Math.max(1024, window.innerWidth),
      hght = window.innerHeight - 65 - 30;
    let scl = 215 * wid / 1440,
      armstype = 'total',
      active = { state: false, country: '' },
      finlandIsClicked = false,
      finlandIsHover = false,
      mouseHover = { state: false, country: '' },
      play = false,
      timer;

    let hScale = d3
      .scaleLinear()
      .domain([0, 60000000])
      .range([2, 175]);

    let projection = d3GeoProjection
      .geoRobinson()
      .scale(scl)
      .translate([wid / 1.85, hght / 1.83]);

    let path = d3.geoPath().projection(projection);

    let Zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .on('zoom', zoomed);

    function zoomed() {
      d3.selectAll('.land').attr('stroke-width', 0.5 / d3.event.transform.k);
      zoomGroup.attr('transform', d3.event.transform); // updated for d3 v4
    }

    d3.select('.map-container__reset').on('click', () => {
      mapSVG
        .transition()
        .duration(500)
        .call(Zoom.transform, d3.zoomIdentity);
    });

    d3.select('.map-container__finland').on('click', clickedFinland);

    function drawBars(yrs) {
      let connectorG = zoomGroup
        .selectAll('.connectorLineG')
        .data(topojson.feature(data, data.objects.countries).features)
        .enter()
        .filter(
          d => d.properties.name !== null && d.properties.name !== 'Finland',
        )
        .append('g')
        .attr('class', 'connectorLineG');
      d3
        .selectAll('.connectorLineG')
        .append('path')
        .attr(
          'class',
          d =>
            `connectorLine ${d.properties.name
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}connector`,
        )
        .attr('d', d => {
          let path = drawArc(d.properties.centroid, origin);
          return path;
        })
        .attr('opacity', 1)
        .attr('fill', 'none')
        .attr('stroke-width', 0.5)
        .attr('stroke', '#2D80B5')
        .style('display', 'none')
        .style('pointer-events', 'none');
      d3
        .selectAll('.intlMissionsGroup')
        .selectAll('.connectorLineIntl')
        .data(data.objects.countries.geometries)
        .enter()
        .append('line')
        .attr(
          'class',
          d =>
            `connectorLineIntl ${d.properties.name
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}connectorIntl`,
        )
        .attr('x1', wid / 2 + 1.5)
        .attr('y1', hght - 43)
        .attr('x2', d => d.properties.centroid[0])
        .attr('y2', d => d.properties.centroid[1])
        .attr('opacity', 0.5)
        .attr('fill', 'none')
        .attr('stroke-width', 0.5)
        .attr('stroke', '#999999')
        .style('display', 'none');
      d3
        .selectAll('.intlMissionsGroup')
        .append('path')
        .attr('class', 'connectorLine International_Missionsconnector')
        .attr('d', () => {
          let coordinates = [wid / 2 + 1.5, hght - 43];
          let path = drawArc(coordinates, origin);
          return path;
        })
        .attr('opacity', 1)
        .attr('fill', 'none')
        .attr('stroke-width', 0.5)
        .attr('stroke', '#2D80B5')
        .style('display', 'none')
        .style('pointer-events', 'none');

      let gBar = zoomGroup
        .selectAll('.countryBars')
        .data(topojson.feature(data, data.objects.countries).features)
        .enter()
        .filter(
          d => d.properties.name !== null && d.properties.name !== 'Finland',
        )
        .append('g')
        .attr(
          'class',
          d =>
            `countryBars countryGroup ${d.properties.CountryName.EN
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}`,
        )
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.25)
        .style('cursor', 'pointer')
        .on('mouseover', d => {
          let cntryname = d.properties.CountryName.EN;
          hover(cntryname, d3.event.x, d3.event.y);
        })
        .on('click', clicked)
        .on('mouseout', mouseOut);

      gBar
        .append('rect')
        .attr('class', 'civBars')
        .attr('x', d => d.properties.centroid[0] - 1.5)
        .attr('width', 3)
        .attr('y', d => d.properties.centroid[1])
        .attr('height', 0)
        .attr('fill', civilianColor)
        .transition()
        .delay(2000)
        .duration(
          d =>
            500 *
            d.properties.data[yrs]['CivilianArmsTotal'] /
            d.properties.data[yrs]['TotalCountry'],
        )
        .attr('height', d => {
          if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) return 0;
          return hScale(d.properties.data[yrs]['CivilianArmsTotal']);
        })
        .attr('y', d => {
          let y1 = hScale(d.properties.data[yrs]['CivilianArmsTotal']);
          if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
          return d.properties.centroid[1] - y1;
        });

      gBar
        .append('rect')
        .attr('class', 'milBars')
        .attr('x', d => d.properties.centroid[0] - 1.5)
        .attr('width', 3)
        .attr('y', d => {
          let y1 = hScale(d.properties.data[yrs]['CivilianArmsTotal']);
          if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
          return d.properties.centroid[1] - y1;
        })
        .attr('height', 0)
        .attr('fill', defenceColor)
        .transition()
        .delay(
          d =>
            2000 +
            500 *
              d.properties.data[yrs]['CivilianArmsTotal'] /
              d.properties.data[yrs]['TotalCountry'],
        )
        .duration(
          d =>
            500 *
            d.properties.data[yrs]['CountryMilatary'] /
            d.properties.data[yrs]['TotalCountry'],
        )
        .attr('height', d => {
          if (d.properties.data[yrs]['CountryMilatary'] === 0) return 0;
          return hScale(d.properties.data[yrs]['CountryMilatary']);
        })
        .attr('y', d => {
          let y1 = hScale(d.properties.data[yrs]['CivilianArmsTotal']),
            y2 = hScale(d.properties.data[yrs]['CountryMilatary']);
          if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
          if (d.properties.data[yrs]['CountryMilatary'] === 0) y2 = 0;
          return d.properties.centroid[1] - y1 - y2;
        });

      d3
        .selectAll('.intlMissionsGroup')
        .append('rect')
        .attr('class', 'intlMissionsBars')
        .attr('x', wid / 2)
        .attr('width', 4)
        .attr('y', hght - 42)
        .attr('height', 0)
        .attr('fill', defenceColor)
        .transition()
        .duration(500)
        .delay(2000)
        .attr('height', d => {
          if (d[yrs]['Total'] === 0) return 0;
          return hScale(d[yrs]['Total']);
        })
        .attr('y', d => {
          let y1 = hScale(d[yrs]['Total']);
          if (d[yrs]['Total'] === 0) y1 = 0;
          return hght - 42 - y1;
        });

      d3
        .selectAll('.land')
        .transition()
        .delay(2500)
        .attr('pointer-events', 'auto');
      d3
        .selectAll('.bg')
        .transition()
        .delay(2500)
        .attr('pointer-events', 'all');

      d3
        .select('.data-map-container')
        .transition()
        .delay(2500)
        .style('pointer-events', 'auto');

      updateSidebar(
        'World',
        selectedYear,
        totalExport[0][selectedYear]['Total'],
        totalExport[0][selectedYear]['Military'],
        totalExport[0][selectedYear]['Civilian'],
        totalExport,
      );
    }
    function changeYear(yrs) {
      d3.selectAll('.data-list-total__year').html(yrs);
      document.getElementsByClassName('active')[0].classList.remove('active');
      document.getElementById(yrs).classList.add('active');
      if (mouseHover.state || finlandIsHover) {
        if (finlandIsHover) {
          let keyIndx, displayStyle;
          switch (armstype) {
            case 'total':
              keyIndx = 'TotalCountry';
              displayStyle = 'inline';
              break;
            case 'CountryMilatary':
              keyIndx = 'CountryMilatary';
              displayStyle = 'inline';
              break;
            case 'CivilianArmsTotal':
              keyIndx = 'CivilianArmsTotal';
              displayStyle = 'none';
              break;
          }
          updateSideBarYear('World', yrs);
          d3.selectAll('.connectorLine').style('display', d => {
            if (d.properties !== null && d.properties !== undefined) {
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 'inline';
              } else return 'none';
            } else {
              if (keyIndx != 'CivilianArmsTotal') {
                return 'inline';
              } else return 'none';
            }
          });
          d3
            .selectAll('.International_Missionsconnector')
            .style('display', displayStyle);
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            )
            .attr('opacity', 1);
          d3
            .selectAll('.Finland')
            .transition()
            .duration(200)
            .attr('fill', '#2D80B5');
          d3
            .selectAll('.countryGroup')
            .transition()
            .duration(200)
            .attr('opacity', d => {
              let keyIndx;
              switch (armstype) {
                case 'total':
                  keyIndx = 'TotalCountry';
                  break;
                case 'CountryMilatary':
                  keyIndx = 'CountryMilatary';
                  break;
                case 'CivilianArmsTotal':
                  keyIndx = 'CivilianArmsTotal';
                  break;
              }
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 1;
              } else {
                return 0.15;
              }
            });
        } else {
          updateSideBarYear(mouseHover.country, yrs);
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            );
        }
      } else {
        if (active.state || finlandIsClicked) {
          if (!finlandIsClicked) {
            updateSideBarYear(active.country, yrs);
            d3
              .selectAll('.land')
              .transition()
              .duration(200)
              .attr(
                'fill',
                d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
              );
            d3
              .selectAll('.Finland')
              .transition()
              .duration(200)
              .attr('fill', '#2D80B5');
          } else {
            let keyIndx, displayStyle;
            switch (armstype) {
              case 'total':
                keyIndx = 'TotalCountry';
                displayStyle = 'inline';
                break;
              case 'CountryMilatary':
                keyIndx = 'CountryMilatary';
                displayStyle = 'inline';
                break;
              case 'CivilianArmsTotal':
                keyIndx = 'CivilianArmsTotal';
                displayStyle = 'none';
                break;
            }
            updateSideBarYear('World', yrs);
            d3.selectAll('.connectorLine').style('display', d => {
              if (d.properties !== null && d.properties !== undefined) {
                if (d.properties.data[yrs][keyIndx] > 0) {
                  return 'inline';
                } else return 'none';
              } else {
                if (keyIndx != 'CivilianArmsTotal') {
                  return 'inline';
                } else return 'none';
              }
            });
            d3
              .selectAll('.International_Missionsconnector')
              .style('display', displayStyle);
            d3
              .selectAll('.land')
              .transition()
              .duration(200)
              .attr(
                'fill',
                d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
              )
              .attr('opacity', 1);
            d3
              .selectAll('.countryGroup')
              .transition()
              .duration(200)
              .attr('opacity', d => {
                let keyIndx;
                switch (armstype) {
                  case 'total':
                    keyIndx = 'TotalCountry';
                    break;
                  case 'CountryMilatary':
                    keyIndx = 'CountryMilatary';
                    break;
                  case 'CivilianArmsTotal':
                    keyIndx = 'CivilianArmsTotal';
                    break;
                }
                if (d.properties.data[yrs][keyIndx] > 0) {
                  return 1;
                } else {
                  return 0.15;
                }
              });
          }
        }
        if (!active.state && !finlandIsClicked) {
          updateSideBarYear('World', yrs);
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            );
          d3
            .selectAll('.Finland')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            );
        }
      }
      redrawBars(armstype, yrs);
    }

    function redrawBars(val, yrs) {
      if (val === 'total') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(200)
          .attr('height', d => {
            if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) return 0;
            return hScale(d.properties.data[yrs]['CivilianArmsTotal']);
          })
          .attr('y', d => {
            let y1 = hScale(d.properties.data[yrs]['CivilianArmsTotal']);
            if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
            return d.properties.centroid[1] - y1;
          });
        d3
          .selectAll('.intlMissionsBars')
          .transition()
          .duration(200)
          .attr('y', d => {
            let y1 = hScale(d[yrs]['Total']);
            if (d[yrs]['Total'] === 0) y1 = 0;
            return hght - 42 - y1;
          })
          .attr('height', d => {
            if (d[yrs]['Total'] === 0) return 0;
            return hScale(d[yrs]['Total']);
          });
        d3
          .selectAll('.milBars')
          .transition()
          .duration(200)
          .attr('height', d => {
            if (d.properties.data[yrs]['CountryMilatary'] === 0) return 0;
            return hScale(d.properties.data[yrs]['CountryMilatary']);
          })
          .attr('y', d => {
            let y1 = hScale(d.properties.data[yrs]['CivilianArmsTotal']),
              y2 = hScale(d.properties.data[yrs]['CountryMilatary']);
            if (d.properties.data[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
            if (d.properties.data[yrs]['CountryMilatary'] === 0) y2 = 0;
            return d.properties.centroid[1] - y1 - y2;
          });

        if (mouseHover.state) {
          let cname = mouseHover.country;
          if (cname !== 'International Missions') {
            let values;
            d3
              .selectAll(
                `.${cname
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            if (values.properties.data[yrs].TotalCountry === 0) {
              d3.selectAll('.connectorLine').style('display', 'none');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr(
                  'fill',
                  d =>
                    colorList[
                      d.properties.data[selectedYear]['GPI']['GPIBand']
                    ],
                );
            } else {
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3.selectAll('.connectorLine').style('display', 'none');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          } else {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            d3.selectAll('.connectorLine').style('display', 'none');
            for (let i = 0; i < intlMissions[0][yrs]['Countries'].length; i++) {
              let cntryName = intlMissions[0][yrs]['Countries'][i][0];
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}`,
                )
                .attr('opacity', 1);
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connectorIntl`,
                )
                .style('display', 'inline');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          }
        }
        if (active.state && !mouseHover.state) {
          let cname = active.country;
          if (cname !== 'International Missions') {
            let values;
            d3
              .selectAll(
                `.${cname
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            if (values.properties.data[yrs].TotalCountry === 0) {
              d3.selectAll('.connectorLine').style('display', 'none');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr(
                  'fill',
                  d =>
                    colorList[
                      d.properties.data[selectedYear]['GPI']['GPIBand']
                    ],
                );
            } else {
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3.selectAll('.connectorLine').style('display', 'none');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          } else {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            d3.selectAll('.connectorLine').style('display', 'none');
            for (let i = 0; i < intlMissions[0][yrs]['Countries'].length; i++) {
              let cntryName = intlMissions[0][yrs]['Countries'][i][0];
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}`,
                )
                .attr('opacity', 1);
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connectorIntl`,
                )
                .style('display', 'inline');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          }
        }
        if (finlandIsClicked && !mouseHover.state) {
          let keyIndx, displayStyle;
          switch (armstype) {
            case 'total':
              keyIndx = 'TotalCountry';
              displayStyle = 'inline';
              break;
            case 'CountryMilatary':
              keyIndx = 'CountryMilatary';
              displayStyle = 'inline';
              break;
            case 'CivilianArmsTotal':
              keyIndx = 'CivilianArmsTotal';
              displayStyle = 'none';
              break;
          }
          d3.selectAll('.connectorLine').style('display', d => {
            if (d.properties !== null && d.properties !== undefined) {
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 'inline';
              } else return 'none';
            } else {
              if (keyIndx != 'CivilianArmsTotal') {
                return 'inline';
              } else return 'none';
            }
          });
          d3
            .selectAll('.International_Missionsconnector')
            .style('display', displayStyle);
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            )
            .attr('opacity', 1);
          d3
            .selectAll('.Finland')
            .transition()
            .duration(200)
            .attr('fill', '#2D80B5');
          d3
            .selectAll('.countryGroup')
            .transition()
            .attr('opacity', d => {
              let keyIndx;
              switch (armstype) {
                case 'total':
                  keyIndx = 'TotalCountry';
                  break;
                case 'CountryMilatary':
                  keyIndx = 'CountryMilatary';
                  break;
                case 'CivilianArmsTotal':
                  keyIndx = 'CivilianArmsTotal';
                  break;
              }
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 1;
              } else {
                return 0.15;
              }
            });
        }
      }
      if (val === 'CivilianArmsTotal') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(200)
          .attr('height', d => {
            if (d.properties.data[yrs][val] === 0) return 0;
            return hScale(d.properties.data[yrs][val]);
          })
          .attr('y', d => {
            let y1 = hScale(d.properties.data[yrs][val]);
            if (d.properties.data[yrs][val] === 0) y1 = 0;
            return d.properties.centroid[1] - y1;
          });
        d3
          .selectAll('.milBars')
          .transition()
          .duration(200)
          .attr('height', 0)
          .attr('y', d => {
            let y1 = hScale(d.properties.data[yrs][val]);
            if (d.properties.data[yrs][val] === 0) y1 = 0;
            return d.properties.centroid[1] - y1;
          });
        d3
          .selectAll('.intlMissionsBars')
          .transition()
          .duration(200)
          .attr('y', hght - 42)
          .attr('height', 0);
        if (mouseHover.state) {
          let cname = mouseHover.country;
          if (cname !== 'International Missions') {
            let values;
            d3
              .selectAll(
                `.${cname
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            if (values.properties.data[yrs].CivilianArmsTotal === 0) {
              d3.selectAll('.connectorLine').style('display', 'none');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr(
                  'fill',
                  d =>
                    colorList[
                      d.properties.data[selectedYear]['GPI']['GPIBand']
                    ],
                );
            } else {
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3.selectAll('.connectorLine').style('display', 'none');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          } else {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr(
                'fill',
                d =>
                  colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
              );
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            d3.selectAll('.connectorLine').style('display', 'none');
            d3.selectAll('.countryGroup').attr('opacity', 0.15);
          }
        }
        if (active.state && !mouseHover.state) {
          let cname = active.country;
          if (cname !== 'International Missions') {
            let values;
            d3
              .selectAll(
                `.${cname
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            if (values.properties.data[yrs][val] === 0) {
              d3.selectAll('.connectorLine').style('display', 'none');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr(
                  'fill',
                  d =>
                    colorList[
                      d.properties.data[selectedYear]['GPI']['GPIBand']
                    ],
                );
            } else {
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3.selectAll('.connectorLine').style('display', 'none');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          } else {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr(
                'fill',
                d =>
                  colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
              );
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            d3.selectAll('.connectorLine').style('display', 'none');
            d3.selectAll('.countryGroup').attr('opacity', 0.15);
          }
        }
        if (finlandIsClicked && !mouseHover.state) {
          let keyIndx, displayStyle;
          switch (armstype) {
            case 'total':
              keyIndx = 'TotalCountry';
              displayStyle = 'inline';
              break;
            case 'CountryMilatary':
              keyIndx = 'CountryMilatary';
              displayStyle = 'inline';
              break;
            case 'CivilianArmsTotal':
              keyIndx = 'CivilianArmsTotal';
              displayStyle = 'none';
              break;
          }
          d3.selectAll('.connectorLine').style('display', d => {
            if (d.properties !== null && d.properties !== undefined) {
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 'inline';
              } else return 'none';
            } else {
              if (keyIndx != 'CivilianArmsTotal') {
                return 'inline';
              } else return 'none';
            }
          });
          d3
            .selectAll('.International_Missionsconnector')
            .style('display', displayStyle);
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            )
            .attr('opacity', 1);
          d3
            .selectAll('.Finland')
            .transition()
            .duration(200)
            .attr('fill', '#2D80B5');
          d3
            .selectAll('.countryGroup')
            .transition()
            .attr('opacity', d => {
              let keyIndx;
              switch (armstype) {
                case 'total':
                  keyIndx = 'TotalCountry';
                  break;
                case 'CountryMilatary':
                  keyIndx = 'CountryMilatary';
                  break;
                case 'CivilianArmsTotal':
                  keyIndx = 'CivilianArmsTotal';
                  break;
              }
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 1;
              } else {
                return 0.15;
              }
            });
        }
      }
      if (val === 'CountryMilatary') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(200)
          .attr('height', 0)
          .attr('y', d => d.properties.centroid[1]);
        d3
          .selectAll('.milBars')
          .transition()
          .duration(200)
          .attr('height', d => {
            if (d.properties.data[yrs][val] === 0) return 0;
            return hScale(d.properties.data[yrs][val]);
          })
          .attr('y', d => {
            let y2 = hScale(d.properties.data[yrs][val]);
            if (d.properties.data[yrs][val] === 0) y2 = 0;
            return d.properties.centroid[1] - y2;
          });
        d3
          .selectAll('.intlMissionsBars')
          .transition()
          .duration(200)
          .attr('y', d => {
            let y1 = hScale(d[yrs]['Total']);
            if (d[yrs]['Total'] === 0) y1 = 0;
            return hght - 42 - y1;
          })
          .attr('height', d => {
            if (d[yrs]['Total'] === 0) return 0;
            return hScale(d[yrs]['Total']);
          });
        if (mouseHover.state) {
          let cname = mouseHover.country;
          if (cname !== 'International Missions') {
            let values;
            d3
              .selectAll(
                `.${cname
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            if (values.properties.data[yrs][val] === 0) {
              d3.selectAll('.connectorLine').style('display', 'none');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr(
                  'fill',
                  d =>
                    colorList[
                      d.properties.data[selectedYear]['GPI']['GPIBand']
                    ],
                );
            } else {
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3.selectAll('.connectorLine').style('display', 'none');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          } else {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            d3.selectAll('.connectorLine').style('display', 'none');
            for (let i = 0; i < intlMissions[0][yrs]['Countries'].length; i++) {
              let cntryName = intlMissions[0][yrs]['Countries'][i][0];
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}`,
                )
                .attr('opacity', 1);
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connectorIntl`,
                )
                .style('display', 'inline');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          }
        }
        if (active.state && !mouseHover.state) {
          let cname = active.country;
          if (cname !== 'International Missions') {
            let values;
            d3
              .selectAll(
                `.${cname
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            if (values.properties.data[yrs].CountryMilatary === 0) {
              d3.selectAll('.connectorLine').style('display', 'none');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr(
                  'fill',
                  d =>
                    colorList[
                      d.properties.data[selectedYear]['GPI']['GPIBand']
                    ],
                );
            } else {
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
              d3.selectAll('.connectorLineIntl').style('display', 'none');
              d3.selectAll('.connectorLine').style('display', 'none');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          } else {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            d3.selectAll('.connectorLine').style('display', 'none');
            for (let i = 0; i < intlMissions[0][yrs]['Countries'].length; i++) {
              let cntryName = intlMissions[0][yrs]['Countries'][i][0];
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}`,
                )
                .attr('opacity', 1);
              d3
                .selectAll(
                  `.${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connectorIntl`,
                )
                .style('display', 'inline');
              d3
                .selectAll(
                  `.${cname
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
            }
          }
        }
        if (finlandIsClicked && !mouseHover.state) {
          let keyIndx, displayStyle;
          switch (armstype) {
            case 'total':
              keyIndx = 'TotalCountry';
              displayStyle = 'inline';
              break;
            case 'CountryMilatary':
              keyIndx = 'CountryMilatary';
              displayStyle = 'inline';
              break;
            case 'CivilianArmsTotal':
              keyIndx = 'CivilianArmsTotal';
              displayStyle = 'none';
              break;
          }
          d3.selectAll('.connectorLine').style('display', d => {
            if (d.properties !== null && d.properties !== undefined) {
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 'inline';
              } else return 'none';
            } else {
              if (keyIndx != 'CivilianArmsTotal') {
                return 'inline';
              } else return 'none';
            }
          });
          d3
            .selectAll('.International_Missionsconnector')
            .style('display', displayStyle);
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr(
              'fill',
              d => colorList[d.properties.data[yrs]['GPI']['GPIBand']],
            )
            .attr('opacity', 1);
          d3
            .selectAll('.Finland')
            .transition()
            .duration(200)
            .attr('fill', '#2D80B5');
          d3
            .selectAll('.countryGroup')
            .transition()
            .attr('opacity', d => {
              let keyIndx;
              switch (armstype) {
                case 'total':
                  keyIndx = 'TotalCountry';
                  break;
                case 'CountryMilatary':
                  keyIndx = 'CountryMilatary';
                  break;
                case 'CivilianArmsTotal':
                  keyIndx = 'CivilianArmsTotal';
                  break;
              }
              if (d.properties.data[yrs][keyIndx] > 0) {
                return 1;
              } else {
                return 0.15;
              }
            });
        }
      }
    }
    function updateSideBarYear(cntryNm, yrs) {
      if (cntryNm === 'World') {
        d3.selectAll('rect').attr('opacity', 1);
      }
      let lineChartwidth = 308,
        lineChartMargin = { top: 0, right: 25, bottom: 0, left: 40 };
      let totalVal = 0,
        defenceVal = 0,
        civilianVal = 0;
      let lineChartX = d3
        .scaleLinear()
        .rangeRound([
          0,
          lineChartwidth - lineChartMargin.left - lineChartMargin.right,
        ])
        .domain([0, endYear - startYear]);
      d3
        .selectAll('.yearMarker')
        .transition()
        .duration(200)
        .attr('x1', lineChartX(parseInt(yrs, 10) - startYear))
        .attr('x2', lineChartX(parseInt(yrs, 10) - startYear));
      if (cntryNm === 'World') {
        totalVal = totalExport[0][yrs]['Total'];
        defenceVal = totalExport[0][yrs]['Military'];
        civilianVal = totalExport[0][yrs]['Civilian'];
      }
      if (cntryNm === 'International Missions') {
        totalVal = intlMissions[0][yrs].Total;
        defenceVal = intlMissions[0][yrs].Total;
        civilianVal = 0;
      }
      if (cntryNm !== 'World' && cntryNm !== 'International Missions') {
        let values;
        d3
          .selectAll(
            `.${cntryNm
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}`,
          )
          .each(function(d) {
            if (
              d.properties.name != 'Alaska (United States of America)' ||
              d.properties.name != 'France (Sub Region)'
            )
              values = d;
          });
        totalVal = values.properties.data[yrs].TotalCountry;
        defenceVal = values.properties.data[yrs].CountryMilatary;
        civilianVal = values.properties.data[yrs].CivilianArmsTotal;
      }
      if (cntryNm !== 'International Missions') {
        if (armstype === 'total') {
          d3.selectAll('.totalLine').attr('opacity', 0.8);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return y.data[yrs]['TotalCountry'] - x.data[yrs]['TotalCountry'];
          });
          let rank = 'NA',
            bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (arrSorted[i].data[yrs]['TotalCountry'] === totalVal) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i].data[yrs]['Comment']['Total'][langSelected];
              break;
            }
          }
          if (totalVal === 0) {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  0,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          } else {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  rank,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          }
          d3.selectAll('.key-points').html('');
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(totalVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
          for (let k = 1; k < 6; k++) {
            let percentDef1 =
                arrSorted[k - 1].data[yrs].CountryMilatary *
                100 /
                totalExport[0][yrs]['Total'],
              percentCiv1 =
                arrSorted[k - 1].data[yrs].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3
              .select('.top-countries__name' + k)
              .html(countryNameLang[arrSorted[k - 1].name][langSelected]);
            d3
              .select('.top-countries__name--sum' + k)
              .html(formatEuros(arrSorted[k - 1].data[yrs].TotalCountry));
            d3
              .select('#top-countries__graphs--defence' + k)
              .transition()
              .duration(250)
              .style('width', percentDef1 + '%');
            d3
              .select('#top-countries__graphs--civilian' + k)
              .transition()
              .duration(250)
              .style('width', percentCiv1 + '%');
          }
        }
        if (armstype === 'CivilianArmsTotal') {
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.15);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return (
              y.data[yrs]['CivilianArmsTotal'] -
              x.data[yrs]['CivilianArmsTotal']
            );
          });
          let rank = 'NA',
            bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (arrSorted[i].data[yrs]['CivilianArmsTotal'] === civilianVal) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i].data[yrs]['Comment']['Civilian'][langSelected];
              break;
            }
          }
          if (civilianVal === 0) {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  0,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          } else {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  rank,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          }
          d3.selectAll('.key-points').html('');

          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3
            .selectAll('.data-list-total__value')
            .html(formatEuros(civilianVal));
          let percentDef = 0,
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
          for (let k = 1; k < 6; k++) {
            let percentDef1 = 0,
              percentCiv1 =
                arrSorted[k - 1].data[yrs].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3
              .select('.top-countries__name' + k)
              .html(countryNameLang[arrSorted[k - 1].name][langSelected]);
            d3
              .select('.top-countries__name--sum' + k)
              .html(formatEuros(arrSorted[k - 1].data[yrs].CivilianArmsTotal));
            d3
              .select('#top-countries__graphs--defence' + k)
              .transition()
              .duration(250)
              .style('width', percentDef1 + '%');
            d3
              .select('#top-countries__graphs--civilian' + k)
              .transition()
              .duration(250)
              .style('width', percentCiv1 + '%');
          }
        }
        if (armstype === 'CountryMilatary') {
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.15);
          arrSorted.sort(function(x, y) {
            return (
              y.data[yrs]['CountryMilatary'] - x.data[yrs]['CountryMilatary']
            );
          });
          let rank = 'NA',
            bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (arrSorted[i].data[yrs]['CountryMilatary'] === defenceVal) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i].data[yrs]['Comment']['Military'][langSelected];
              break;
            }
          }
          if (defenceVal === 0) {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  0,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          } else {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  rank,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          }
          d3.selectAll('.key-points').html('');

          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(defenceVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = 0;
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
          for (let k = 1; k < 6; k++) {
            let percentDef1 =
                arrSorted[k - 1].data[yrs].CountryMilatary *
                100 /
                totalExport[0][yrs]['Total'],
              percentCiv1 = 0;
            d3
              .select('.top-countries__name' + k)
              .html(countryNameLang[arrSorted[k - 1].name][langSelected]);
            d3
              .select('.top-countries__name--sum' + k)
              .html(formatEuros(arrSorted[k - 1].data[yrs].CountryMilatary));
            d3
              .select('#top-countries__graphs--defence' + k)
              .transition()
              .duration(250)
              .style('width', percentDef1 + '%');
            d3
              .select('#top-countries__graphs--civilian' + k)
              .transition()
              .duration(250)
              .style('width', percentCiv1 + '%');
          }
        }

        if (active.state || mouseHover.state) {
          d3.select('.top-countries').style('display', 'none');

          d3.select('.country-bullet-point').style('display', 'inline');
        } else {
          d3.select('.top-countries').style('display', 'inline');

          d3.select('.country-bullet-point').style('display', 'none');
        }
      } else {
        if (armstype === 'total') {
          intlMissions[0][yrs].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html(intlMissionTableTitle[langSelected])
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          let tbl = d3
            .selectAll('.key-points')
            .append('table')
            .attr('class', 'country-table')
            .style('width', '293px');
          tbl
            .selectAll('.country-row')
            .data(intlMissions[0][yrs].Countries)
            .enter()
            .append('tr')
            .attr('class', 'country-row');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => countryNameLang[d[0]][langSelected])
            .style('text-align', 'left')
            .style('font-size', '1rem')
            .style('font-weight', '600')
            .style('padding', '0.5rem 0');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => formatEuros(d[1]))
            .style('text-align', 'right')
            .style('font-size', '1rem')
            .style('padding', '0.5rem 0');
          d3.selectAll('.totalLine').attr('opacity', 0.8);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(totalVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
        }
        if (armstype === 'CivilianArmsTotal') {
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html(intlMissionTableTitle[langSelected])
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.15);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3
            .selectAll('.data-list-total__value')
            .html(formatEuros(civilianVal));
          let percentDef = 0,
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
        }
        if (armstype === 'CountryMilatary') {
          intlMissions[0][yrs].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html(intlMissionTableTitle[langSelected])
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          let tbl = d3
            .selectAll('.key-points')
            .append('table')
            .attr('class', 'country-table')
            .style('width', '293px');
          tbl
            .selectAll('.country-row')
            .data(intlMissions[0][yrs].Countries)
            .enter()
            .append('tr')
            .attr('class', 'country-row');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => countryNameLang[d[0]][langSelected])
            .style('text-align', 'left')
            .style('font-size', '1rem')
            .style('font-weight', '600')
            .style('padding', '0.5rem 0');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => formatEuros(d[1]))
            .style('text-align', 'right')
            .style('font-size', '1rem')
            .style('padding', '0.5rem 0');
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.15);
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(defenceVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = 0;
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
        }

        if (armstype === 'total' || armstype === 'CountryMilatary') {
          d3.selectAll('.countryGroup').attr('opacity', 0.15);
          for (let i = 0; i < intlMissions[0][yrs]['Countries'].length; i++) {
            let cntryName = intlMissions[0][yrs]['Countries'][i][0];
            d3
              .selectAll(
                `.${cntryName
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .attr('opacity', 1);
          }
        } else {
          d3.selectAll('.land').attr('opacity', 0.2);
        }
        if (active.state || mouseHover.state) {
          d3.select('.top-countries').style('display', 'none');
          d3.select('.country-rank').html('');
          d3.select('.country-bullet-point').style('display', 'inline');
        } else {
          d3.select('.top-countries').style('display', 'inline');

          d3.select('.country-bullet-point').style('display', 'none');
        }
      }
    }

    function updateSidebar(
      cntryNm,
      yrs,
      totalVal,
      defenceVal,
      civilianVal,
      dataForLine,
    ) {
      if (cntryNm !== 'International Missions') {
        drawLineChart(dataForLine);
        if (armstype === 'total') {
          d3.selectAll('.totalLine').attr('opacity', 0.8);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return (
              y['data'][selectedYear]['TotalCountry'] -
              x['data'][selectedYear]['TotalCountry']
            );
          });
          let rank = 'NA',
            bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['data'][selectedYear]['TotalCountry'] === totalVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['data'][selectedYear]['Comment']['Total'][
                  langSelected
                ];
              break;
            }
          }
          if (totalVal === 0) {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  0,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          } else {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  rank,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          }
          d3.selectAll('.key-points').html('');
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(totalVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
          for (let k = 1; k < 6; k++) {
            let percentDef1 =
                arrSorted[k - 1].data[selectedYear].CountryMilatary *
                100 /
                totalExport[0][yrs]['Total'],
              percentCiv1 =
                arrSorted[k - 1].data[selectedYear].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3
              .select('.top-countries__name' + k)
              .html(countryNameLang[arrSorted[k - 1].name][langSelected]);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(arrSorted[k - 1].data[selectedYear].TotalCountry),
              );
            d3
              .select('#top-countries__graphs--defence' + k)
              .transition()
              .duration(250)
              .style('width', percentDef1 + '%');
            d3
              .select('#top-countries__graphs--civilian' + k)
              .transition()
              .duration(250)
              .style('width', percentCiv1 + '%');
          }
        }
        if (armstype === 'CivilianArmsTotal') {
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.15);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return (
              y['data'][selectedYear]['CivilianArmsTotal'] -
              x['data'][selectedYear]['CivilianArmsTotal']
            );
          });
          let rank = 'NA',
            bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['data'][selectedYear]['CivilianArmsTotal'] ===
              civilianVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['data'][selectedYear]['Comment']['Civilian'][
                  langSelected
                ];
              break;
            }
          }
          if (civilianVal === 0) {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  0,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          } else {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  rank,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          }
          d3.selectAll('.key-points').html('');

          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3
            .selectAll('.data-list-total__value')
            .html(formatEuros(civilianVal));
          let percentDef = 0,
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
          for (let k = 1; k < 6; k++) {
            let percentDef1 = 0,
              percentCiv1 =
                arrSorted[k - 1].data[selectedYear].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3
              .select('.top-countries__name' + k)
              .html(countryNameLang[arrSorted[k - 1].name][langSelected]);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(
                  arrSorted[k - 1].data[selectedYear].CivilianArmsTotal,
                ),
              );
            d3
              .select('#top-countries__graphs--defence' + k)
              .transition()
              .duration(250)
              .style('width', percentDef1 + '%');
            d3
              .select('#top-countries__graphs--civilian' + k)
              .transition()
              .duration(250)
              .style('width', percentCiv1 + '%');
          }
        }
        if (armstype === 'CountryMilatary') {
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.15);
          arrSorted.sort(function(x, y) {
            return (
              y['data'][selectedYear]['CountryMilatary'] -
              x['data'][selectedYear]['CountryMilatary']
            );
          });
          let rank = 'NA',
            bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['data'][selectedYear]['CountryMilatary'] ===
              defenceVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['data'][selectedYear]['Comment']['Military'][
                  langSelected
                ];
              break;
            }
          }
          if (defenceVal === 0) {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  0,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          } else {
            d3
              .selectAll('.country-rank')
              .html(
                commentLine(
                  countryNameLang[cntryNm][langSelected],
                  rank,
                  langSelected,
                  armstype,
                  selectedYear,
                  bullets,
                ),
              );
          }
          d3.selectAll('.key-points').html('');

          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(defenceVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = 0;
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
          for (let k = 1; k < 6; k++) {
            let percentDef1 =
                arrSorted[k - 1].data[selectedYear].CountryMilatary *
                100 /
                totalExport[0][yrs]['Total'],
              percentCiv1 = 0;
            d3
              .select('.top-countries__name' + k)
              .html(countryNameLang[arrSorted[k - 1].name][langSelected]);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(
                  arrSorted[k - 1].data[selectedYear].CountryMilatary,
                ),
              );
            d3
              .select('#top-countries__graphs--defence' + k)
              .transition()
              .duration(250)
              .style('width', percentDef1 + '%');
            d3
              .select('#top-countries__graphs--civilian' + k)
              .transition()
              .duration(250)
              .style('width', percentCiv1 + '%');
          }
        }

        if (active.state || mouseHover.state) {
          d3.select('.top-countries').style('display', 'none');

          d3.select('.country-bullet-point').style('display', 'inline');
        } else {
          d3.select('.top-countries').style('display', 'inline');

          d3.select('.country-bullet-point').style('display', 'none');
        }
      } else {
        mouseHover.state = true;
        mouseHover.country = cntryNm;
        drawLineChartIntl(dataForLine);
        if (armstype === 'total') {
          dataForLine[0][selectedYear].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html(intlMissionTableTitle[langSelected])
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          let tbl = d3
            .selectAll('.key-points')
            .append('table')
            .attr('class', 'country-table')
            .style('width', '293px');
          tbl
            .selectAll('.country-row')
            .data(dataForLine[0][selectedYear].Countries)
            .enter()
            .append('tr')
            .attr('class', 'country-row');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => countryNameLang[d[0]][langSelected])
            .style('text-align', 'left')
            .style('font-size', '1rem')
            .style('font-weight', '600')
            .style('padding', '0.5rem 0');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => formatEuros(d[1]))
            .style('text-align', 'right')
            .style('font-size', '1rem')
            .style('padding', '0.5rem 0');
          d3.selectAll('.totalLine').attr('opacity', 0.8);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(totalVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
        }
        if (armstype === 'CivilianArmsTotal') {
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html(intlMissionTableTitle[langSelected])
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.15);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3
            .selectAll('.data-list-total__value')
            .html(formatEuros(civilianVal));
          let percentDef = 0,
            percentCiv = civilianVal * 100 / totalExport[0][yrs]['Total'];
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
        }
        if (armstype === 'CountryMilatary') {
          dataForLine[0][selectedYear].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html(intlMissionTableTitle[langSelected])
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          let tbl = d3
            .selectAll('.key-points')
            .append('table')
            .attr('class', 'country-table')
            .style('width', '293px');
          tbl
            .selectAll('.country-row')
            .data(dataForLine[0][selectedYear].Countries)
            .enter()
            .append('tr')
            .attr('class', 'country-row');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => countryNameLang[d[0]][langSelected])
            .style('text-align', 'left')
            .style('font-size', '1rem')
            .style('font-weight', '600')
            .style('padding', '0.5rem 0');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => formatEuros(d[1]))
            .style('text-align', 'right')
            .style('font-size', '1rem')
            .style('padding', '0.5rem 0');
          d3.selectAll('.totalLine').attr('opacity', 0.15);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.15);
          d3
            .selectAll('.data-list-total__name')
            .html(countryNameLang[cntryNm][langSelected]);
          d3.selectAll('.data-list-total__value').html(formatEuros(defenceVal));
          let percentDef = defenceVal * 100 / totalExport[0][yrs]['Total'],
            percentCiv = 0;
          d3
            .select('.top-countries__graphs--defence')
            .transition()
            .duration(250)
            .style('width', percentDef + '%');
          d3
            .select('.top-countries__graphs--civilian')
            .transition()
            .duration(250)
            .style('width', percentCiv + '%');
        }
        if (armstype === 'total' || armstype === 'CountryMilatary') {
          for (
            let i = 0;
            i < intlMissions[0][selectedYear]['Countries'].length;
            i++
          ) {
            let cntryName = intlMissions[0][selectedYear]['Countries'][i][0];
            d3
              .selectAll(
                `.${cntryName
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .transition()
              .duration(300)
              .attr('opacity', 1);
          }
        } else {
          d3.selectAll('.countryGroup').attr('opacity', 0.15);
        }
        if (active.state || mouseHover.state) {
          d3.select('.top-countries').style('display', 'none');
          d3.select('.country-rank').html('');
          d3.select('.country-bullet-point').style('display', 'inline');
        } else {
          d3.select('.top-countries').style('display', 'inline');

          d3.select('.country-bullet-point').style('display', 'none');
        }
      }
    }

    function hoverIntl() {
      mouseHover.state = true;
      mouseHover.country = 'International Missions';
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('.connectorLineIntl').style('display', 'none');
      d3
        .selectAll('.countryGroup')
        .transition()
        .duration(200)
        .attr('opacity', 0.15);
      if (armstype === 'total' || armstype === 'CountryMilatary') {
        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr('fill', '#2D80B5');
        d3
          .selectAll('.countryGroup')
          .transition()
          .duration(300)
          .attr('opacity', d => {
            if (d.properties.data[selectedYear]['IntlMissionMilatary'] > 0)
              return 1;
            else return 0.15;
          });
        d3.selectAll('.connectorLineIntl').style('display', d => {
          if (d.properties.data[selectedYear]['IntlMissionMilatary'] > 0)
            return 'inline';
          else return 'none';
        });
        d3
          .selectAll(
            `.${mouseHover.country
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}connector`,
          )
          .style('display', 'inline');
      }
      d3
        .selectAll('.intlMissionsGroup')
        .transition()
        .duration(200)
        .attr('opacity', 1);
      updateSidebar(
        'International Missions',
        selectedYear,
        intlMissions[0][selectedYear].Total,
        intlMissions[0][selectedYear].Total,
        0,
        intlMissions,
      );
    }

    function hover(cntryNm, xPos, yPos) {
      console.log(active, mouseHover, finlandIsClicked, finlandIsHover);
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('.connectorLineIntl').style('display', 'none');
      d3
        .selectAll('.Finland')
        .attr('opacity', 0.15)
        .attr(
          'fill',
          d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
        );
      mouseHover.state = true;
      mouseHover.country = cntryNm;
      d3
        .selectAll('.countryGroup')
        .transition()
        .duration(200)
        .attr('opacity', 0.15);
      let values;
      d3
        .selectAll(
          `.${cntryNm
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}`,
        )
        .each(function(d) {
          if (
            d.properties.name != 'Alaska (United States of America)' &&
            d.properties.name != 'France (Sub Region)'
          )
            values = d;
        });
      d3
        .selectAll(
          `.${cntryNm
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}`,
        )
        .transition()
        .duration(200)
        .attr('opacity', 1);

      mouseHover.state = true;
      mouseHover.country = cntryNm;

      let dataForLineGraph = [{}];
      for (let g = startYear; g <= endYear; g++) {
        let totalObject = {
          Year: g,
          Total: 0,
          Military: 0,
          Civilian: 0,
        };
        totalObject.Military =
          values.properties.data[g.toString()].CountryMilatary;
        totalObject.Civilian =
          values.properties.data[g.toString()].CivilianArmsTotal;
        totalObject.Total = totalObject.Military + totalObject.Civilian;
        dataForLineGraph[0][g.toString()] = totalObject;
      }
      d3
        .selectAll('.intlMissionsGroup')
        .transition()
        .duration(200)
        .attr('opacity', 0.2);
      let keyIndx;
      switch (armstype) {
        case 'total':
          keyIndx = 'TotalCountry';
          break;
        case 'CountryMilatary':
          keyIndx = 'CountryMilatary';
          break;
        case 'CivilianArmsTotal':
          keyIndx = 'CivilianArmsTotal';
          break;
      }
      if (values.properties.data[selectedYear][keyIndx] > 0) {
        d3
          .selectAll(
            `.${values.properties.CountryName.EN
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}connector`,
          )
          .style('display', 'inline');
        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr('fill', '#2D80B5');
      }
      updateSidebar(
        cntryNm,
        selectedYear,
        values.properties.data[selectedYear].TotalCountry,
        values.properties.data[selectedYear].CountryMilatary,
        values.properties.data[selectedYear].CivilianArmsTotal,
        dataForLineGraph,
      );
    }

    function mouseOut(data) {
      mouseHover.state = false;
      if (!active.state && !finlandIsClicked) {
        console.log('helloworld');
        d3.selectAll('.connectorLine').style('display', 'none');
        d3.selectAll('.connectorLineIntl').style('display', 'none');
        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr(
            'fill',
            d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
          );
        d3
          .selectAll('.countryGroup')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        d3
          .selectAll('.land')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        d3
          .selectAll('.intlMissionsGroup')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        updateSidebar(
          'World',
          selectedYear,
          totalExport[0][selectedYear]['Total'],
          totalExport[0][selectedYear]['Military'],
          totalExport[0][selectedYear]['Civilian'],
          totalExport,
        );
      } else {
        d3
          .selectAll('.countryGroup')
          .transition()
          .duration(200)
          .attr('opacity', 0.15);
        d3.selectAll('.connectorLine').style('display', 'none');
        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr(
            'fill',
            d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
          );
        if (active.country !== 'International Missions') {
          if (finlandIsClicked) {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            let keyIndx, displayStyle;
            d3.selectAll('.connectorLineIntl').style('display', 'none');
            switch (armstype) {
              case 'total':
                keyIndx = 'TotalCountry';
                displayStyle = 'inline';
                break;
              case 'CountryMilatary':
                keyIndx = 'CountryMilatary';
                displayStyle = 'inline';
                break;
              case 'CivilianArmsTotal':
                keyIndx = 'CivilianArmsTotal';
                displayStyle = 'none';
                break;
            }
            d3
              .selectAll('.countryGroup')
              .transition()
              .duration(210)
              .attr('opacity', d => {
                if (d.properties.data[selectedYear][keyIndx] > 0) {
                  return 1;
                } else return 0.15;
              });
            d3
              .selectAll('.land')
              .transition()
              .duration(210)
              .attr('opacity', d => {
                if (d.properties.data[selectedYear][keyIndx] > 0) {
                  return 1;
                } else return 1;
              });
            d3.selectAll('.connectorLine').style('display', d => {
              if (d.properties !== null && d.properties !== undefined) {
                if (d.properties.data[selectedYear][keyIndx] > 0) {
                  return 'inline';
                } else return 'none';
              } else {
                if (keyIndx != 'CivilianArmsTotal') {
                  return 'inline';
                } else return 'none';
              }
            });
            d3
              .selectAll('.International_Missionsconnector')
              .style('display', displayStyle);
            updateSidebar(
              'World',
              selectedYear,
              totalExport[0][selectedYear]['Total'],
              totalExport[0][selectedYear]['Military'],
              totalExport[0][selectedYear]['Civilian'],
              totalExport,
            );
          } else {
            let values;
            d3
              .selectAll(
                `.${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .each(function(d) {
                if (
                  d.properties.name != 'Alaska (United States of America)' ||
                  d.properties.name != 'France (Sub Region)'
                )
                  values = d;
              });
            d3
              .selectAll('.land')
              .transition()
              .duration(190)
              .attr('opacity', 1);
            d3
              .selectAll(
                `.${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .transition()
              .duration(200)
              .attr('opacity', 1);
            let dataForLineGraph = [{}];
            for (let g = startYear; g <= endYear; g++) {
              let totalObject = {
                Year: g,
                Total: 0,
                Military: 0,
                Civilian: 0,
              };
              totalObject.Military =
                values.properties.data[g.toString()].CountryMilatary;
              totalObject.Civilian =
                values.properties.data[g.toString()].CivilianArmsTotal;
              totalObject.Total = totalObject.Military + totalObject.Civilian;
              dataForLineGraph[0][g.toString()] = totalObject;
            }
            d3
              .selectAll('.intlMissionsGroup')
              .transition()
              .duration(200)
              .attr('opacity', 0.2);
            let keyIndx;
            switch (armstype) {
              case 'total':
                keyIndx = 'TotalCountry';
                break;
              case 'CountryMilatary':
                keyIndx = 'CountryMilatary';
                break;
              case 'CivilianArmsTotal':
                keyIndx = 'CivilianArmsTotal';
                break;
            }
            if (values.properties.data[selectedYear][keyIndx] > 0) {
              d3
                .selectAll(
                  `.${values.properties.CountryName.EN
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}connector`,
                )
                .style('display', 'inline');
              d3
                .selectAll('.Finland')
                .attr('opacity', 1)
                .attr('fill', '#2D80B5');
            }
            updateSidebar(
              active.country,
              selectedYear,
              values.properties.data[selectedYear].TotalCountry,
              values.properties.data[selectedYear].CountryMilatary,
              values.properties.data[selectedYear].CivilianArmsTotal,
              dataForLineGraph,
            );
          }
        } else {
          d3
            .selectAll('.intlMissionsGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);

          if (armstype === 'total' || armstype === 'CountryMilatary') {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            d3
              .selectAll('.countryGroup')
              .transition()
              .duration(300)
              .attr('opacity', d => {
                if (d.properties.data[selectedYear]['IntlMissionMilatary'] > 0)
                  return 1;
                else return 0.15;
              });
            d3.selectAll('.connectorLineIntl').style('display', d => {
              if (d.properties.data[selectedYear]['IntlMissionMilatary'] > 0)
                return 'inline';
              else return 'none';
            });
            d3
              .selectAll(
                `.${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}connector`,
              )
              .style('display', 'inline');
          }
          updateSidebar(
            'International Missions',
            selectedYear,
            intlMissions[0][selectedYear].Total,
            intlMissions[0][selectedYear].Total,
            0,
            intlMissions,
          );
        }
      }
    }

    let mapSVG = d3
      .select('.map-container')
      .append('svg')
      .attr('width', wid)
      .attr('height', hght)
      .attr('class', 'svg-map');

    mapSVG.call(Zoom);

    let zoomGroup = mapSVG.append('g');
    d3.select('.data-map-container').style('pointer-events', 'none');
    const langSelected = this.props.language;
    const intlMissionTableTitle = {
      EN: 'Countries where missions took place',
      FI: 'Maat, joissa tehtävät suoritettiin',
    };
    zoomGroup
      .append('rect')
      .attr('class', 'bg')
      .attr('width', wid)
      .attr('height', hght)
      .style('fill', 'none')
      .attr('pointer-events', 'none')
      .on('click', () => {
        mapSVG
          .transition()
          .duration(500)
          .call(Zoom.transform, d3.zoomIdentity);
        active.state = false;
        mouseHover.state = false;
        finlandIsClicked = false;
        finlandIsHover = false;
        d3.selectAll('.connectorLine').style('display', 'none');
        d3.selectAll('.connectorLineIntl').style('display', 'none');
        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr(
            'fill',
            d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
          );
        d3
          .selectAll('.countryGroup')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        d3
          .selectAll('.intlMissionsGroup')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        updateSidebar(
          'World',
          selectedYear,
          totalExport[0][selectedYear]['Total'],
          totalExport[0][selectedYear]['Military'],
          totalExport[0][selectedYear]['Civilian'],
          totalExport,
        );
      });

    let colorList = [
      '#dddddd',
      '#D5E1EC',
      '#B7BFD6',
      '#9F9CC1',
      '#89659F',
      '#82197C',
    ];
    let civilianColor = '#785ef0',
      defenceColor = '#fe6100';

    let data = this.state.saferGlobeData;
    const startYear = parseInt(
        d3.keys(data.objects.countries.geometries[0].properties.data)[0],
        10,
      ),
      endYear = parseInt(
        d3
          .keys(data.objects.countries.geometries[0].properties.data)
          .slice(-2)[0],
        10,
      );

    let gpiObject = {};
    let currentYear = parseInt(
        d3
          .keys(data.objects.countries.geometries[0].properties.data)
          .slice(-2)[0],
        10,
      ),
      selectedYear = d3
        .keys(data.objects.countries.geometries[0].properties.data)
        .slice(-2)[0];

    for (let g = startYear; g <= endYear; g++) {
      let totalObject = {
        Year: g,
        Total: 0,
        Military: 0,
        Civilian: 0,
      };
      let intlMissionsObject = {
        Total: 0,
        Countries: [],
      };
      for (let k = 0; k < data.objects.countries.geometries.length; k++) {
        totalObject.Military =
          data.objects.countries.geometries[k].properties.data[g.toString()]
            .MilataryMaterielTotal +
          data.objects.countries.geometries[k].properties.data[g.toString()]
            .IntlMissionMilatary +
          totalObject.Military;
        totalObject.Civilian =
          data.objects.countries.geometries[k].properties.data[g.toString()]
            .CivilianArmsTotal + totalObject.Civilian;
        intlMissionsObject.Total =
          data.objects.countries.geometries[k].properties.data[g.toString()]
            .IntlMissionMilatary + intlMissionsObject.Total;
        if (
          data.objects.countries.geometries[k].properties.data[g.toString()]
            .IntlMissionMilatary !== 0
        ) {
          intlMissionsObject.Countries.push([]);
          intlMissionsObject.Countries[
            intlMissionsObject.Countries.length - 1
          ].push(
            data.objects.countries.geometries[k].properties.CountryName.EN,
          );
          intlMissionsObject.Countries[
            intlMissionsObject.Countries.length - 1
          ].push(
            data.objects.countries.geometries[k].properties.data[g.toString()]
              .IntlMissionMilatary,
          );
        }
      }
      totalObject.Total = totalObject.Military + totalObject.Civilian;
      totalExport[0][g.toString()] = totalObject;
      intlMissions[0][g.toString()] = intlMissionsObject;
    }

    drawLineChart(totalExport);

    //Drawing Line Chart
    function drawLineChartIntl(dataLine) {
      d3.selectAll('.time-series-svg').remove();

      let lineChartwidth = 308,
        lineChartheight = 125,
        lineChartMargin = { top: 0, right: 25, bottom: 0, left: 40 };

      let lineChartSVG = d3
        .selectAll('.time-series-graph')
        .append('svg')
        .attr('class', 'time-series-svg')
        .attr('width', lineChartwidth)
        .attr('height', lineChartheight);

      let lineChartg = lineChartSVG
        .append('g')
        .attr(
          'transform',
          'translate(' + lineChartMargin.left + ',' + lineChartMargin.top + ')',
        );

      let lineChartX = d3
        .scaleLinear()
        .rangeRound([
          0,
          lineChartwidth - lineChartMargin.left - lineChartMargin.right,
        ]);

      let lineChartY = d3
        .scaleLinear()
        .rangeRound([
          lineChartheight - lineChartMargin.top - lineChartMargin.bottom,
          0,
        ]);

      let lineChartLine = d3
        .line()
        .curve(d3.curveStep)
        .x((d, i) => lineChartX(i))
        .y(d => lineChartY(d));

      let totalForLine = [],
        defenceForLine = [],
        civilianForLine = [];

      for (let i = 0; i < d3.keys(dataLine[0]).length; i++) {
        totalForLine.push(dataLine[0][d3.keys(dataLine[0])[i]]['Total']);
        defenceForLine.push(dataLine[0][d3.keys(dataLine[0])[i]]['Total']);
        civilianForLine.push(0);
      }
      lineChartY.domain([0, d3.max(totalForLine)]);
      lineChartX.domain([0, totalForLine.length - 1]);
      lineChartg
        .append('g')
        .call(
          d3
            .axisLeft(lineChartY)
            .ticks(5)
            .tickFormat(d => {
              if (d < 1e6) {
                let s = (d / 1e3).toFixed(0);
                return s + ' K€';
              } else {
                let s = (d / 1e6).toFixed(0);
                return s + ' M€';
              }
            })
            .tickSize(6),
        )
        .append('text')
        .attr('fill', '#aaa');

      for (let i = 0; i < d3.keys(dataLine[0]).length; i++) {
        lineChartg
          .append('line')
          .attr('x1', lineChartX(i))
          .attr('x2', lineChartX(i))
          .attr('y1', lineChartheight)
          .attr('y2', lineChartheight + 5)
          .attr('stroke', '#aaa')
          .attr('shape-rendering', 'crispEdges');
        let txt = "'" + parseInt(d3.keys(dataLine[0])[i], 10) % 1000;
        if (parseInt(d3.keys(dataLine[0])[i], 10) % 1000 < 10) {
          txt = "'0" + parseInt(d3.keys(dataLine[0])[i], 10) % 1000;
        }
        lineChartg
          .append('text')
          .attr('x', lineChartX(i) + 1)
          .attr('y', lineChartheight + 10)
          .attr('fill', '#aaa')
          .attr('font-size', 11)
          .attr('font-family', 'Source Sans Pro')
          .text(txt);
      }

      lineChartg.selectAll('.domain').remove();
      lineChartg
        .selectAll('.tick text')
        .attr('fill', '#aaa')
        .attr('font-size', 10);
      lineChartg.selectAll('.tick line').attr('stroke', '#aaa');
      lineChartg
        .append('path')
        .datum(totalForLine)
        .attr('class', 'totalLine')
        .attr('fill', 'none')
        .attr('stroke', '#999')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1)
        .attr('d', lineChartLine)
        .attr('shape-rendering', 'crispEdges')
        .attr('opacity', 0.8);
      lineChartg
        .append('path')
        .datum(defenceForLine)
        .attr('class', 'defenceLine')
        .attr('fill', 'none')
        .attr('stroke', defenceColor)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1)
        .attr('d', lineChartLine)
        .attr('shape-rendering', 'crispEdges')
        .attr('opacity', 0.8);
      lineChartg
        .append('path')
        .datum(civilianForLine)
        .attr('class', 'civilianLine')
        .attr('fill', 'none')
        .attr('stroke', civilianColor)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1)
        .attr('d', lineChartLine)
        .attr('shape-rendering', 'crispEdges')
        .attr('opacity', 0.8);

      lineChartg
        .append('line')
        .attr('class', 'yearMarker')
        .attr('x1', lineChartX(d3.keys(dataLine[0]).indexOf(selectedYear)))
        .attr('x2', lineChartX(d3.keys(dataLine[0]).indexOf(selectedYear)))
        .attr('y1', 0)
        .attr(
          'y2',
          lineChartheight - lineChartMargin.top - lineChartMargin.bottom,
        )
        .attr('stroke', '#333')
        .attr('stroke-dasharray', '4,4')
        .attr('shape-rendering', 'crispEdges');
    }

    function drawLineChart(dataLine) {
      d3.selectAll('.time-series-svg').remove();

      let lineChartwidth = 308,
        lineChartheight = 125,
        lineChartMargin = { top: 0, right: 25, bottom: 0, left: 40 };

      let lineChartSVG = d3
        .selectAll('.time-series-graph')
        .append('svg')
        .attr('class', 'time-series-svg')
        .attr('width', lineChartwidth)
        .attr('height', lineChartheight);

      let lineChartg = lineChartSVG
        .append('g')
        .attr(
          'transform',
          'translate(' + lineChartMargin.left + ',' + lineChartMargin.top + ')',
        );

      let lineChartX = d3
        .scaleLinear()
        .rangeRound([
          0,
          lineChartwidth - lineChartMargin.left - lineChartMargin.right,
        ]);

      let lineChartY = d3
        .scaleLinear()
        .rangeRound([
          lineChartheight - lineChartMargin.top - lineChartMargin.bottom,
          0,
        ]);

      let lineChartLine = d3
        .line()
        .curve(d3.curveStep)
        .x((d, i) => lineChartX(i))
        .y(d => lineChartY(d));

      let totalForLine = [],
        defenceForLine = [],
        civilianForLine = [];

      for (let i = 0; i < d3.keys(dataLine[0]).length; i++) {
        totalForLine.push(dataLine[0][d3.keys(dataLine[0])[i]]['Total']);
        defenceForLine.push(dataLine[0][d3.keys(dataLine[0])[i]]['Military']);
        civilianForLine.push(dataLine[0][d3.keys(dataLine[0])[i]]['Civilian']);
      }
      lineChartY.domain([0, d3.max(totalForLine)]);
      lineChartX.domain([0, totalForLine.length - 1]);
      lineChartg
        .append('g')
        .call(
          d3
            .axisLeft(lineChartY)
            .ticks(5)
            .tickFormat(d => {
              if (d < 1e6) {
                let s = (d / 1e3).toFixed(0);
                return s + ' K€';
              } else {
                let s = (d / 1e6).toFixed(0);
                return s + ' M€';
              }
            })
            .tickSize(6),
        )
        .append('text')
        .attr('fill', '#aaa');

      for (let i = 0; i < d3.keys(dataLine[0]).length; i++) {
        lineChartg
          .append('line')
          .attr('x1', lineChartX(i))
          .attr('x2', lineChartX(i))
          .attr('y1', lineChartheight)
          .attr('y2', lineChartheight + 5)
          .attr('stroke', '#aaa')
          .attr('shape-rendering', 'crispEdges');
        let txt = "'" + parseInt(d3.keys(dataLine[0])[i], 10) % 1000;
        if (parseInt(d3.keys(dataLine[0])[i], 10) % 1000 < 10) {
          txt = "'0" + parseInt(d3.keys(dataLine[0])[i], 10) % 1000;
        }
        lineChartg
          .append('text')
          .attr('x', lineChartX(i) + 1)
          .attr('y', lineChartheight + 10)
          .attr('fill', '#aaa')
          .attr('font-size', 11)
          .attr('font-family', 'Source Sans Pro')
          .text(txt);
      }

      lineChartg.selectAll('.domain').remove();
      lineChartg
        .selectAll('.tick text')
        .attr('fill', '#aaa')
        .attr('font-size', 10);
      lineChartg.selectAll('.tick line').attr('stroke', '#aaa');
      lineChartg
        .append('path')
        .datum(totalForLine)
        .attr('class', 'totalLine')
        .attr('fill', 'none')
        .attr('stroke', '#999')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1)
        .attr('d', lineChartLine)
        .attr('shape-rendering', 'crispEdges');
      lineChartg
        .append('path')
        .datum(defenceForLine)
        .attr('class', 'defenceLine')
        .attr('fill', 'none')
        .attr('stroke', defenceColor)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1)
        .attr('d', lineChartLine)
        .attr('shape-rendering', 'crispEdges');
      lineChartg
        .append('path')
        .datum(civilianForLine)
        .attr('class', 'civilianLine')
        .attr('fill', 'none')
        .attr('stroke', civilianColor)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1)
        .attr('d', lineChartLine)
        .attr('shape-rendering', 'crispEdges');

      lineChartg
        .append('line')
        .attr('class', 'yearMarker')
        .attr('x1', lineChartX(d3.keys(dataLine[0]).indexOf(selectedYear)))
        .attr('x2', lineChartX(d3.keys(dataLine[0]).indexOf(selectedYear)))
        .attr('y1', 0)
        .attr(
          'y2',
          lineChartheight - lineChartMargin.top - lineChartMargin.bottom,
        )
        .attr('stroke', '#333')
        .attr('stroke-dasharray', '4,4')
        .attr('shape-rendering', 'crispEdges');
    }

    let features = topojson.feature(data, data.objects.countries).features;

    let origin;

    data.objects.countries.geometries.forEach((d, i) => {
      d.properties.centroid = path.centroid(features[i]);
      if (d.properties.name === 'Finland') origin = path.centroid(features[i]);
    });

    data.objects.countries.geometries.sort((a, b) => {
      return d3.ascending(a.properties.centroid[1], b.properties.centroid[1]);
    });

    let arrSorted = [],
      countryNameLang = {};
    for (let i = 0; i < data.objects.countries.geometries.length; i++) {
      arrSorted.push(data.objects.countries.geometries[i].properties);
      countryNameLang[data.objects.countries.geometries[i].properties.name] =
        data.objects.countries.geometries[i].properties.CountryName;
    }
    countryNameLang['World'] = {
      EN: 'World',
      FI: 'Maailma',
    };
    countryNameLang['International Missions'] = {
      EN: 'International Missions',
      FI: 'Kansainväliset lähetystöt',
    };
    let intlMissionText = {
      EN: 'Exports to UN mandated or other international missions',
      FI:
        'Vienti YK:n ja muiden kansainvälisten järjestöjen rauhanturva- ja humanitaarisen avustustoiminnan käyttöön',
    };
    arrSorted.sort(function(x, y) {
      return (
        y['data'][selectedYear]['TotalCountry'] -
        x['data'][selectedYear]['TotalCountry']
      );
    });

    //Drawing Map
    let finlandG = zoomGroup.append('g').attr('class', 'finlandGroup');
    finlandG
      .selectAll('.Finland')
      .data(topojson.feature(data, data.objects.countries).features)
      .enter()
      .filter(d => d.properties.name === 'Finland')
      .append('path')
      .attr('class', 'Finland')
      .attr('d', path)
      .attr('fill', '#2D80B5')
      .attr('opacity', 1)
      .style('cursor', 'pointer')
      .attr('stroke-width', 0.5)
      .on('click', clickedFinland)
      .on('mouseover', hoverFinland)
      .on('mouseout', mouseOutFinland)
      .transition()
      .duration(1250)
      .attr('opacity', 1)
      .attr(
        'fill',
        d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
      );
    zoomGroup
      .selectAll('.countryGroup')
      .data(topojson.feature(data, data.objects.countries).features)
      .enter()
      .filter(
        d => d.properties.name !== null && d.properties.name !== 'Finland',
      )
      .append('g')
      .attr(
        'class',
        d =>
          `countryGroup ${d.properties.CountryName.EN
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}`,
      );
    d3
      .selectAll('.countryGroup')
      .append('path')
      .attr(
        'class',
        d =>
          `land ${d.properties.CountryName.EN
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}`,
      )
      .attr('d', path)
      .attr(
        'fill',
        d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
      )
      .attr('opacity', 0.15)
      .attr('stroke', d => {
        if (d.properties.name === 'Somalia') {
          return 'none';
        }
        return '#fff';
      })
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .attr('pointer-events', 'none')
      .on('mouseover', d => {
        let cntryname = d.properties.CountryName.EN;
        hover(cntryname, d3.event.x, d3.event.y);
      })
      .on('click', clicked)
      .on('mouseout', mouseOut)
      .transition()
      .duration(1250)
      .attr('opacity', 1)
      .attr(
        'fill',
        d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
      );
    zoomGroup
      .selectAll('.intlMissionsGroup')
      .data(intlMissions)
      .enter()
      .append('g')
      .attr('class', 'intlMissionsGroup')
      .style('cursor', 'pointer')
      .on('mouseover', hoverIntl)
      .on('mouseout', mouseOut)
      .on('click', clicked);
    d3
      .selectAll('.intlMissionsGroup')
      .append('text')
      .attr('x', wid / 2)
      .attr('y', hght - 32)
      .attr('font-size', 9)
      .attr('font-weight', 700)
      .attr('font-family', 'Source Sans Pro')
      .text(intlMissionText[langSelected])
      .attr('text-anchor', 'middle')
      .attr('fill', '#aaa');
    zoomGroup
      .append('rect')
      .attr('class', 'initCivBar')
      .attr('x', origin[0] - 1.5)
      .attr('width', 3)
      .attr('height', hScale(totalExport[0][selectedYear]['Civilian']))
      .attr('y', () => {
        let y1 = hScale(totalExport[0][selectedYear]['Civilian']);
        return origin[1] - y1;
      })
      .attr('fill', civilianColor)
      .transition()
      .duration(
        d =>
          2000 *
          totalExport[0][selectedYear]['Civilian'] /
          totalExport[0][selectedYear]['Total'],
      )
      .attr('y', origin[1])
      .attr('height', 0);
    zoomGroup
      .append('rect')
      .attr('class', 'initMilBars')
      .attr('x', origin[0] - 1.5)
      .attr('width', 3)
      .attr('height', hScale(totalExport[0][selectedYear]['Military']))
      .attr('y', () => {
        let y1 = hScale(totalExport[0][selectedYear]['Civilian']),
          y2 = hScale(totalExport[0][selectedYear]['Military']);
        return origin[1] - y1 - y2;
      })
      .attr('fill', defenceColor)
      .transition()
      .delay(
        2000 *
          totalExport[0][selectedYear]['Civilian'] /
          totalExport[0][selectedYear]['Total'],
      )
      .duration(
        500 *
          totalExport[0][selectedYear]['Military'] /
          totalExport[0][selectedYear]['Total'],
      )
      .attr('y', d => {
        let y1 = hScale(totalExport[0][selectedYear]['Civilian']);
        return origin[1] - y1;
      })
      .attr('height', 0);

    zoomGroup
      .selectAll('.animatedCircle')
      .data(data.objects.countries.geometries)
      .enter()
      .filter(d => d.properties.data[selectedYear]['TotalCountry'] > 0)
      .append('line')
      .attr('class', 'animatedCircle')
      .attr('r', 2)
      .attr('stroke', '#2D80B5')
      .attr('opacity', 1)
      .attr('stroke-dasharray', '5, 10')
      .attr('x1', origin[0])
      .attr('y1', origin[1])
      .attr('x2', origin[0])
      .attr('y2', origin[1])
      .transition()
      .duration(1000)
      .attr('x2', d => d.properties.centroid[0])
      .attr('y2', d => d.properties.centroid[1])
      .transition()
      .duration(1000)
      .attr('x1', d => d.properties.centroid[0])
      .attr('y1', d => d.properties.centroid[1])
      .on('end', drawBars(endYear.toString()));

    function clicked(d) {
      finlandIsClicked = false;
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('.connectorLineIntl').style('display', 'none');
      d3
        .selectAll('.Finland')
        .attr('opacity', 1)
        .attr(
          'fill',
          d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
        );
      if (d.properties !== null && d.properties !== undefined) {
        let countryClicked = d.properties.CountryName.EN;
        if (active.country === countryClicked && active.state) {
          active.state = false;
          mapSVG
            .transition()
            .duration(500)
            .call(Zoom.transform, d3.zoomIdentity);
          d3
            .selectAll('.intlMissionsGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          d3
            .selectAll('.countryGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);

          updateSidebar(
            'World',
            selectedYear,
            totalExport[0][selectedYear]['Total'],
            totalExport[0][selectedYear]['Military'],
            totalExport[0][selectedYear]['Civilian'],
            totalExport,
          );
        } else {
          active.state = true;
          active.country = countryClicked;

          let bounds = path.bounds(d),
            dx = bounds[1][0] - bounds[0][0],
            dy = bounds[1][1] - bounds[0][1],
            x = (bounds[0][0] + bounds[1][0]) / 2,
            y = (bounds[0][1] + bounds[1][1]) / 2,
            scale = Math.max(
              1,
              Math.min(8, 0.9 / Math.max(dx / wid, dy / hght)),
            ),
            translate = [wid / 2 - scale * x, hght / 2 - scale * y];

          mapSVG
            .transition()
            .duration(500)
            .call(
              Zoom.transform,
              d3.zoomIdentity
                .translate(translate[0], translate[1])
                .scale(scale),
            );
        }
        let values;
        d3
          .selectAll(
            `.${countryClicked
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}`,
          )
          .each(function(d) {
            if (
              d.properties.name != 'Alaska (United States of America)' ||
              d.properties.name != 'France (Sub Region)'
            )
              values = d;
          });
        let dataForLineGraph = [{}];
        for (let g = startYear; g <= endYear; g++) {
          let totalObject = {
            Year: g,
            Total: 0,
            Military: 0,
            Civilian: 0,
          };
          totalObject.Military =
            values.properties.data[g.toString()].CountryMilatary;
          totalObject.Civilian =
            values.properties.data[g.toString()].CivilianArmsTotal;
          totalObject.Total = totalObject.Military + totalObject.Civilian;
          dataForLineGraph[0][g.toString()] = totalObject;
        }

        d3
          .selectAll('.intlMissionsGroup')
          .transition()
          .duration(200)
          .attr('opacity', 0.2);
        let keyIndx;
        switch (armstype) {
          case 'total':
            keyIndx = 'TotalCountry';
            break;
          case 'CountryMilatary':
            keyIndx = 'CountryMilatary';
            break;
          case 'CivilianArmsTotal':
            keyIndx = 'CivilianArmsTotal';
            break;
        }
        if (values.properties.data[selectedYear][keyIndx] > 0) {
          d3
            .selectAll(
              `.${values.properties.CountryName.EN
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}connector`,
            )
            .style('display', 'inline');
          d3
            .selectAll('.Finland')
            .attr('opacity', 1)
            .attr('fill', '#2D80B5');
        }
        updateSidebar(
          countryClicked,
          selectedYear,
          values.properties.data[selectedYear].TotalCountry,
          values.properties.data[selectedYear].CountryMilatary,
          values.properties.data[selectedYear].CivilianArmsTotal,
          dataForLineGraph,
        );
      } else {
        if (active.country === 'International Missions' && active.state) {
          active.state = false;
          d3
            .selectAll('.intlMissionsGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          updateSidebar(
            'World',
            selectedYear,
            totalExport[0][selectedYear]['Total'],
            totalExport[0][selectedYear]['Military'],
            totalExport[0][selectedYear]['Civilian'],
            totalExport,
          );
        } else {
          active.state = true;
          active.country = 'International Missions'; // updated for d3 v4
          d3
            .selectAll('.intlMissionsGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          if (armstype === 'total' || armstype === 'CountryMilatary') {
            d3
              .selectAll('.Finland')
              .attr('opacity', 1)
              .attr('fill', '#2D80B5');
            d3
              .selectAll('.countryGroup')
              .transition()
              .duration(300)
              .attr('opacity', d => {
                if (d.properties.data[selectedYear]['IntlMissionMilatary'] > 0)
                  return 1;
                else return 0.15;
              });
            d3.selectAll('.connectorLineIntl').style('display', d => {
              if (d.properties.data[selectedYear]['IntlMissionMilatary'] > 0)
                return 'inline';
              else return 'none';
            });
            d3
              .selectAll(
                `.${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}connector`,
              )
              .style('display', 'inline');
          }
          updateSidebar(
            'International Missions',
            selectedYear,
            intlMissions[0][selectedYear].Total,
            intlMissions[0][selectedYear].Total,
            0,
            intlMissions,
          );
        }
      }
    }
    function hoverFinland() {
      console.log(finlandIsClicked, finlandIsHover);
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('.connectorLineIntl').style('display', 'none');
      updateSidebar(
        'World',
        selectedYear,
        totalExport[0][selectedYear]['Total'],
        totalExport[0][selectedYear]['Military'],
        totalExport[0][selectedYear]['Civilian'],
        totalExport,
      );

      finlandIsHover = true;
      d3
        .selectAll('.Finland')
        .attr('opacity', 1)
        .attr('fill', '#2D80B5');
      let keyIndx;
      switch (armstype) {
        case 'total':
          keyIndx = 'TotalCountry';
          break;
        case 'CountryMilatary':
          keyIndx = 'CountryMilatary';
          break;
        case 'CivilianArmsTotal':
          keyIndx = 'CivilianArmsTotal';
          break;
      }
      d3
        .selectAll('.countryGroup')
        .transition()
        .duration(200)
        .attr('opacity', d => {
          if (d.properties.data[selectedYear][keyIndx] > 0) {
            return 1;
          } else return 0.15;
        });
      d3
        .selectAll('.land')
        .transition()
        .duration(200)
        .attr('opacity', d => {
          if (d.properties.data[selectedYear][keyIndx] > 0) {
            return 1;
          } else return 1;
        });
      d3
        .selectAll('.connectorLine')
        .transition()
        .duration(200)
        .style('display', d => {
          if (d.properties !== null && d.properties !== undefined) {
            if (d.properties.data[selectedYear][keyIndx] > 0) {
              return 'inline';
            } else return 'none';
          } else {
            if (keyIndx != 'CivilianArmsTotal') {
              return 'inline';
            } else return 'none';
          }
        });
    }
    function mouseOutFinland() {
      finlandIsHover = false;
      d3.selectAll('.connectorLine').style('display', 'none');
      if (finlandIsClicked) {
        d3.selectAll('.connectorLine').style('display', 'none');
        d3.selectAll('.connectorLineIntl').style('display', 'none');
        updateSidebar(
          'World',
          selectedYear,
          totalExport[0][selectedYear]['Total'],
          totalExport[0][selectedYear]['Military'],
          totalExport[0][selectedYear]['Civilian'],
          totalExport,
        );
        d3.selectAll('.countryGroup').attr('opacity', 1);
        d3.selectAll('.land').attr('opacity', 1);

        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr(
            'fill',
            d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
          );
      }
    }
    function clickedFinland() {
      active.state = false;
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('.connectorLineIntl').style('display', 'none');
      d3
        .selectAll('.Finland')
        .attr('opacity', 1)
        .attr(
          'fill',
          d => colorList[d.properties.data[selectedYear]['GPI']['GPIBand']],
        );
      updateSidebar(
        'World',
        selectedYear,
        totalExport[0][selectedYear]['Total'],
        totalExport[0][selectedYear]['Military'],
        totalExport[0][selectedYear]['Civilian'],
        totalExport,
      );
      mapSVG
        .transition()
        .duration(500)
        .call(Zoom.transform, d3.zoomIdentity);
      let countryClicked = 'Finland';
      if (finlandIsClicked) {
        active.state = false;
        finlandIsClicked = false;
        d3
          .selectAll('.intlMissionsGroup')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        d3
          .selectAll('.countryGroup')
          .transition()
          .duration(200)
          .attr('opacity', 1);
        d3
          .selectAll('.land')
          .transition()
          .duration(200)
          .attr('opacity', 1);
      } else {
        finlandIsClicked = true;
        d3
          .selectAll('.Finland')
          .attr('opacity', 1)
          .attr('fill', '#2D80B5');
        let keyIndx, displayStyle;
        switch (armstype) {
          case 'total':
            keyIndx = 'TotalCountry';
            displayStyle = 'inline';
            break;
          case 'CountryMilatary':
            keyIndx = 'CountryMilatary';
            displayStyle = 'inline';
            break;
          case 'CivilianArmsTotal':
            keyIndx = 'CivilianArmsTotal';
            displayStyle = 'none';
            break;
        }
        d3.selectAll('.countryGroup').attr('opacity', d => {
          console.log(d, selectedYear);
          if (d.properties.data[selectedYear][keyIndx] > 0) {
            return 1;
          } else return 0.15;
        });
        d3.selectAll('.land').attr('opacity', d => {
          if (d.properties.data[selectedYear][keyIndx] > 0) {
            return 1;
          } else return 1;
        });
        d3.selectAll('.connectorLine').style('display', d => {
          if (d.properties !== null && d.properties !== undefined) {
            if (d.properties.data[selectedYear][keyIndx] > 0) {
              return 'inline';
            } else return 'none';
          } else {
            if (keyIndx != 'CivilianArmsTotal') {
              return 'inline';
            } else return 'none';
          }
        });
        d3
          .selectAll('.International_Missionsconnector')
          .style('display', displayStyle);
      }
    }
    //End Drawing Map

    for (let k = 0; k < 5; k++) {
      d3
        .selectAll(`.Country${k + 1}`)
        .html(
          `${k + 1}. ${data.objects.countries.geometries[k].properties
            .CountryName[langSelected]}`,
        );
    }
    for (let k = 0; k < 5; k++) {
      d3
        .selectAll(`.Value${k + 1}`)
        .html(
          `${formatEuros(
            data.objects.countries.geometries[k].properties.data[selectedYear][
              'TotalCountry'
            ],
          )}`,
        );
    }

    updateSidebar(
      'World',
      selectedYear,
      totalExport[0][selectedYear]['Total'],
      totalExport[0][selectedYear]['Military'],
      totalExport[0][selectedYear]['Civilian'],
      totalExport,
    );

    for (let i = startYear; i <= endYear; i++) {
      document.getElementById(i.toString()).onclick = function(event) {
        currentYear = i;
        selectedYear = i.toString();
        play = false;
        clearInterval(timer);
        changeYear(i.toString());
      };
      document.getElementById(i.toString()).onmouseover = function(event) {
        if (!play) changeYear(i.toString());
      };
      document.getElementById(i.toString()).onmouseleave = function(event) {
        if (!play) changeYear(selectedYear);
      };
    }

    d3.selectAll('.play-button').on('click', () => {
      let duration = 1500;
      if (play) {
        play = false;
        clearInterval(timer);
      } else {
        play = true;
        if (currentYear > endYear) {
          currentYear = startYear;
        }
        timer = setInterval(() => {
          currentYear++;
          if (currentYear > endYear) {
            currentYear = startYear;
          }
          selectedYear = currentYear.toString();
          changeYear(currentYear.toString());
        }, duration);
      }
    });
    d3.selectAll("input[name='countryList']").on('change', () => {
      armstype = d3
        .select('input[name="countryList"]:checked')
        .property('value');
      redrawBars(
        d3.select('input[name="countryList"]:checked').property('value'),
        selectedYear,
      );

      if (!active.state) {
        if (finlandIsClicked) {
          updateSidebar(
            'World',
            selectedYear,
            totalExport[0][selectedYear]['Total'],
            totalExport[0][selectedYear]['Military'],
            totalExport[0][selectedYear]['Civilian'],
            totalExport,
          );
        } else {
          d3
            .selectAll('.countryGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          d3
            .selectAll('.intlMissionsGroup')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          updateSidebar(
            'World',
            selectedYear,
            totalExport[0][selectedYear]['Total'],
            totalExport[0][selectedYear]['Military'],
            totalExport[0][selectedYear]['Civilian'],
            totalExport,
          );
        }
      } else {
        if (active.country !== 'International Missions') {
          let values;
          d3
            .selectAll(
              `.${active.country
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}`,
            )
            .each(function(d) {
              if (
                d.properties.name != 'Alaska (United States of America)' ||
                d.properties.name != 'France (Sub Region)'
              )
                values = d;
            });
          let dataForLineGraph = [{}];
          for (let g = startYear; g <= endYear; g++) {
            let totalObject = {
              Year: g,
              Total: 0,
              Military: 0,
              Civilian: 0,
            };
            totalObject.Military =
              values.properties.data[g.toString()].CountryMilatary;
            totalObject.Civilian =
              values.properties.data[g.toString()].CivilianArmsTotal;
            totalObject.Total = totalObject.Military + totalObject.Civilian;
            dataForLineGraph[0][g.toString()] = totalObject;
          }
          d3
            .selectAll('.intlMissionsGroup')
            .transition()
            .duration(200)
            .attr('opacity', 0.2);
          updateSidebar(
            active.country,
            selectedYear,
            values.properties.data[selectedYear].TotalCountry,
            values.properties.data[selectedYear].CountryMilatary,
            values.properties.data[selectedYear].CivilianArmsTotal,
            dataForLineGraph,
          );
        } else {
          updateSidebar(
            'International Missions',
            selectedYear,
            intlMissions[0][selectedYear].Total,
            intlMissions[0][selectedYear].Total,
            0,
            intlMissions,
          );
        }
      }
    });
  } // End drawMap()

  render() {
    if (
      window.timeline &&
      window.nav &&
      window.sidebar &&
      this.state.saferGlobeData
    ) {
      return <div>{this.drawMap(this.props.saferGlobeData)}</div>;
    } else {
      return <div style={{ textAlign: 'center' }}>Loading Map...</div>;
    }
  }
}

DataMap.propTypes = {
  gpiYear: PropTypes.number.isRequired,
  displayData: PropTypes.func.isRequired,
};

export default DataMap;
