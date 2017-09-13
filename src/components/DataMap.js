import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import * as topojson from 'topojson';
import * as d3GeoProjection from 'd3-geo-projection';
import { csv } from 'd3-request';
import output from './../data/output-v4.json';
import gpi from './../data/gpi_2008-2016_v1.csv';
import saferGlobe from './../data/safer-globe.csv';
import saferGlobeJson from './../data/data.json';
import formatEuros from '../utils/formatEuros';

import './../styles/components/Tooltip.css';

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
      countryData: output,
      gpiData: null,
      gpiYear: 2016,
      saferGlobeData: null,
      saferGlobeDataV2: null,
    };
  }

  componentWillReceiveProps(newGPIYear) {
    if (this.state.gpiYear !== newGPIYear.gpiYear) {
      this.setState({ gpiYear: newGPIYear.gpiYear });
    }
  }

  shouldComponentUpdate() {
    if (this.state.saferGlobeData && this.props.gpiYear) {
      return false;
    } else {
      return true;
    }
  }

  componentWillMount() {
    csv(gpi, (error, data) => {
      if (error) {
        this.setState({ loadError: true });
      }
      this.setState({ gpiData: data });
    });
    csv(saferGlobe, (error, data) => {
      if (error) {
        this.setState({ loadError: true });
      }
      this.setState({ saferGlobeData: data });
    });
    this.setState({ saferGlobeDataV2: saferGlobeJson });
    this.setState({ gpiYear: this.props.gpiYear });
  }

  drawMap(displayData) {
    let totalExport = [{}];
    let intlMissions = [{}];
    d3.select('.map-container').html('');

    const wid = Math.max(1024, window.innerWidth),
      hght = window.innerHeight - 65 - 30;

    let scl = 215 * wid / 1440;

    let armstype = 'total';

    let active = { state: false, country: '' },
      mouseHover = { state: false, country: '' };

    let play = false, timer;
    /*
    let tooltipFigure = figure =>
      (parseFloat(figure) / 1000000).toFixed(2).toString().replace('.', ',');
    */
    let hScale = d3.scaleLinear().domain([0, 60000000]).range([2, 175]);

    let projection = d3GeoProjection
      .geoRobinson()
      .scale(scl)
      .translate([wid / 1.85, hght / 1.8]);

    let path = d3.geoPath().projection(projection);

    let Zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', zoomed);
    function drawArc(a, b) {
      if (b[0] < a[0]) {
        let dx = a[0] - b[0],
          dy = a[1] - b[1],
          dr = Math.sqrt(dx * dx + dy * dy);
        return (
          'M' +
          b[0] +
          ',' +
          b[1] +
          'A' +
          dr +
          ',' +
          dr +
          ' 0 0,1 ' +
          a[0] +
          ',' +
          a[1]
        );
      } else {
        let dx = b[0] - a[0],
          dy = b[1] - a[1],
          dr = Math.sqrt(dx * dx + dy * dy);
        return (
          'M' +
          a[0] +
          ',' +
          a[1] +
          'A' +
          dr +
          ',' +
          dr +
          ' 0 0,1 ' +
          b[0] +
          ',' +
          b[1]
        );
      }
    }
    function zoomed() {
      d3.selectAll('.land').attr('stroke-width', 0.5 / d3.event.transform.k);
      zoomGroup.attr('transform', d3.event.transform); // updated for d3 v4
    }
    d3.select('.map-container__reset').on('click', () => {
      mapSVG.transition().duration(500).call(Zoom.transform, d3.zoomIdentity);
    });

    function drawBars(yrs) {
      zoomGroup
        .selectAll('.connectorLine')
        .data(dataV2)
        .enter()
        .append('path')
        .attr('class', 'connectorLine')
        .attr('d', d => {
          let path = drawArc(d.centroid, origin);
          return path;
        })
        .attr(
          'id',
          d =>
            `${d.name
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}connector`,
        )
        .attr('opacity', 1)
        .attr('fill', 'none')
        .attr('stroke-width', 1)
        .attr('stroke', '#2D80B5')
        .style('display', 'none');
      zoomGroup
        .selectAll('.civBars')
        .data(dataV2)
        .enter()
        .append('rect')
        .attr('class', 'civBars')
        .attr(
          'id',
          d =>
            `${d.name
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}civBar`,
        )
        .attr('x', d => d.centroid[0] - 1.5)
        .attr('width', 3)
        .attr('y', d => d.centroid[1])
        .attr('height', 0)
        .attr('fill', civilianColor)
        .on('mouseover', d => {
          hover(d.name, d3.event.x, d3.event.y);
        })
        .transition()
        .delay(2000)
        .duration(
          d =>
            500 *
            d.years[yrs]['CivilianArmsTotal'] /
            d.years[yrs]['TotalCountry'],
        )
        .attr('height', d => {
          if (d.years[yrs]['CivilianArmsTotal'] === 0) return 0;
          return hScale(d.years[yrs]['CivilianArmsTotal']);
        })
        .attr('y', d => {
          let y1 = hScale(d.years[yrs]['CivilianArmsTotal']);
          if (d.years[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
          return d.centroid[1] - y1;
        });

      zoomGroup
        .selectAll('.milBars')
        .data(dataV2)
        .enter()
        .append('rect')
        .attr('class', 'milBars')
        .attr(
          'id',
          d =>
            `${d.name
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}milBar`,
        )
        .attr('x', d => d.centroid[0] - 1.5)
        .attr('width', 3)
        .attr('y', d => {
          let y1 = hScale(d.years[yrs]['CivilianArmsTotal']);
          if (d.years[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
          return d.centroid[1] - y1;
        })
        .attr('height', 0)
        .attr('fill', defenceColor)
        .on('mouseover', d => {
          hover(d.name, d3.event.x, d3.event.y);
        })
        .transition()
        .delay(
          d =>
            2000 +
            500 *
              d.years[yrs]['CivilianArmsTotal'] /
              d.years[yrs]['TotalCountry'],
        )
        .duration(
          d =>
            500 *
            d.years[yrs]['CountryMilatary'] /
            d.years[yrs]['TotalCountry'],
        )
        .attr('height', d => {
          if (d.years[yrs]['CountryMilatary'] === 0) return 0;
          return hScale(d.years[yrs]['CountryMilatary']);
        })
        .attr('y', d => {
          let y1 = hScale(d.years[yrs]['CivilianArmsTotal']),
            y2 = hScale(d.years[yrs]['CountryMilatary']);
          if (d.years[yrs]['CivilianArmsTotal'] === 0) y1 = 0;
          if (d.years[yrs]['CountryMilatary'] === 0) y2 = 0;
          return d.centroid[1] - y1 - y2;
        });

      zoomGroup
        .selectAll('.intlmissionsbar')
        .data(intlMissions)
        .enter()
        .append('rect')
        .attr('class', 'intlmissionsbar')
        .attr('x', wid / 2)
        .attr('width', 4)
        .attr('y', hght - 42)
        .attr('height', 0)
        .attr('fill', defenceColor)
        .on('mouseover', hoverIntl)
        .on('click', clicked)
        .style('cursor', 'pointer')
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
    }
    function changeYear(yrs) {
      selectedYear = yrs;
      d3.selectAll('.data-list-total__year').html(yrs);
      document.getElementsByClassName('active')[0].classList.remove('active');
      document.getElementById(yrs).classList.add('active');
      currentYear = parseInt(yrs, 10) + 1;
      if (mouseHover.state) {
        updateSideBarYear(mouseHover.country, selectedYear);
        d3.selectAll('.land').transition().duration(200).attr('fill', d => {
          let cntryName = d.properties.name;
          if (d.properties.name === 'Alaska (United States of America)') {
            cntryName = 'United States of America';
          }
          if (d.properties.name === 'France (Sub Region)') {
            cntryName = 'France';
          }
          if (d3.keys(gpiObject).indexOf(cntryName) !== -1) {
            if (gpiObject[cntryName][yrs] === -1) return '#dddddd';
            else return threshold(gpiObject[cntryName][yrs]);
          } else return '#dddddd';
        });
      }
      if (active.state && !mouseHover.state) {
        updateSideBarYear(active.country, selectedYear);
        d3.selectAll('.land').transition().duration(200).attr('fill', d => {
          let cntryName = d.properties.name;
          if (d.properties.name === 'Alaska (United States of America)') {
            cntryName = 'United States of America';
          }
          if (d.properties.name === 'France (Sub Region)') {
            cntryName = 'France';
          }
          if (d3.keys(gpiObject).indexOf(cntryName) !== -1) {
            if (gpiObject[cntryName][yrs] === -1) return '#dddddd';
            else return threshold(gpiObject[cntryName][yrs]);
          } else return '#dddddd';
        });
      }
      if (!active.state && !mouseHover.state) {
        updateSideBarYear('World', selectedYear);
        d3
          .selectAll('.land')
          .transition()
          .duration(200)
          .attr('fill', d => {
            let cntryName = d.properties.name;
            if (d.properties.name === 'Alaska (United States of America)') {
              cntryName = 'United States of America';
            }
            if (d.properties.name === 'France (Sub Region)') {
              cntryName = 'France';
            }
            if (d3.keys(gpiObject).indexOf(cntryName) !== -1) {
              if (gpiObject[cntryName][yrs] === -1) return '#dddddd';
              else return threshold(gpiObject[cntryName][yrs]);
            } else return '#dddddd';
          })
          .attr('fill-opacity', d => {
            let cntryname = d.properties.name;
            if (d.properties.name === 'Alaska (United States of America)') {
              cntryname = 'United States of America';
            }
            if (d.properties.name === 'France (Sub Region)') {
              cntryname = 'France';
            }
            let indx = dataV2CountryList.indexOf(cntryname);
            if (armstype === 'total') {
              if (dataV2[indx].years[selectedYear]['TotalCountry'] > 0)
                return 0.7;
              else return 0.15;
            }
            if (armstype === 'defence') {
              if (dataV2[indx].years[selectedYear]['CountryMilatary'] > 0)
                return 0.7;
              else return 0.15;
            }
            if (armstype === 'civilian') {
              if (dataV2[indx].years[selectedYear]['CivilianArmsTotal'] > 0)
                return 0.7;
              else return 0.15;
            }
          });
      }
      if (armstype === 'total') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) return 0;
            return hScale(d.years[selectedYear]['CivilianArmsTotal']);
          })
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            return d.centroid[1] - y1;
          });
        d3
          .selectAll('.milBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CountryMilatary'] === 0) return 0;
            return hScale(d.years[selectedYear]['CountryMilatary']);
          })
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']),
              y2 = hScale(d.years[selectedYear]['CountryMilatary']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            if (d.years[selectedYear]['CountryMilatary'] === 0) y2 = 0;
            return d.centroid[1] - y1 - y2;
          });
        d3
          .selectAll('.intlmissionsbar')
          .transition()
          .duration(500)
          .attr('y', d => {
            let y1 = hScale(d[selectedYear]['Total']);
            if (d[selectedYear]['Total'] === 0) y1 = 0;
            return hght - 42 - y1;
          })
          .attr('height', d => {
            if (d[selectedYear]['Total'] === 0) return 0;
            return hScale(d[selectedYear]['Total']);
          });
      }
      if (armstype === 'civilian') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) return 0;
            return hScale(d.years[selectedYear]['CivilianArmsTotal']);
          })
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            return d.centroid[1] - y1;
          });
        d3
          .selectAll('.milBars')
          .transition()
          .duration(500)
          .attr('height', 0)
          .attr('y', d => d.centroid[1]);
        d3
          .selectAll('.intlmissionsbar')
          .transition()
          .duration(500)
          .attr('y', hght - 42)
          .attr('height', 0);
      }
      if (armstype === 'defence') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(500)
          .attr('height', 0)
          .attr('y', d => d.centroid[1]);
        d3
          .selectAll('.milBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CountryMilatary'] === 0) return 0;
            return hScale(d.years[selectedYear]['CountryMilatary']);
          })
          .attr('y', d => {
            let y2 = hScale(d.years[selectedYear]['CountryMilatary']);
            if (d.years[selectedYear]['CountryMilatary'] === 0) y2 = 0;
            return d.centroid[1] - y2;
          });
        d3
          .selectAll('.intlmissionsbar')
          .transition()
          .duration(500)
          .attr('y', d => {
            let y1 = hScale(d[selectedYear]['Total']);
            if (d[selectedYear]['Total'] === 0) y1 = 0;
            return hght - 42 - y1;
          })
          .attr('height', d => {
            if (d[selectedYear]['Total'] === 0) return 0;
            return hScale(d[selectedYear]['Total']);
          });
      }
    }

    function redrawBars(val) {
      if (val === 'total') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) return 0;
            return hScale(d.years[selectedYear]['CivilianArmsTotal']);
          })
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            return d.centroid[1] - y1;
          });
        d3
          .selectAll('.intlmissionsbar')
          .transition()
          .duration(500)
          .attr('y', d => {
            let y1 = hScale(d[selectedYear]['Total']);
            if (d[selectedYear]['Total'] === 0) y1 = 0;
            return hght - 42 - y1;
          })
          .attr('height', d => {
            if (d[selectedYear]['Total'] === 0) return 0;
            return hScale(d[selectedYear]['Total']);
          });
        d3
          .selectAll('.milBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CountryMilatary'] === 0) return 0;
            return hScale(d.years[selectedYear]['CountryMilatary']);
          })
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']),
              y2 = hScale(d.years[selectedYear]['CountryMilatary']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            if (d.years[selectedYear]['CountryMilatary'] === 0) y2 = 0;
            return d.centroid[1] - y1 - y2;
          });
      }
      if (val === 'civilian') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) return 0;
            return hScale(d.years[selectedYear]['CivilianArmsTotal']);
          })
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            return d.centroid[1] - y1;
          });
        d3
          .selectAll('.milBars')
          .transition()
          .duration(500)
          .attr('height', 0)
          .attr('y', d => {
            let y1 = hScale(d.years[selectedYear]['CivilianArmsTotal']);
            if (d.years[selectedYear]['CivilianArmsTotal'] === 0) y1 = 0;
            return d.centroid[1] - y1;
          });
        d3
          .selectAll('.intlmissionsbar')
          .transition()
          .duration(500)
          .attr('y', hght - 42)
          .attr('height', 0);
      }
      if (val === 'defence') {
        d3
          .selectAll('.civBars')
          .transition()
          .duration(500)
          .attr('height', 0)
          .attr('y', d => d.centroid[1]);
        d3
          .selectAll('.milBars')
          .transition()
          .duration(500)
          .attr('height', d => {
            if (d.years[selectedYear]['CountryMilatary'] === 0) return 0;
            return hScale(d.years[selectedYear]['CountryMilatary']);
          })
          .attr('y', d => {
            let y2 = hScale(d.years[selectedYear]['CountryMilatary']);
            if (d.years[selectedYear]['CountryMilatary'] === 0) y2 = 0;
            return d.centroid[1] - y2;
          });
        d3
          .selectAll('.intlmissionsbar')
          .transition()
          .duration(500)
          .attr('y', d => {
            let y1 = hScale(d[selectedYear]['Total']);
            if (d[selectedYear]['Total'] === 0) y1 = 0;
            return hght - 42 - y1;
          })
          .attr('height', d => {
            if (d[selectedYear]['Total'] === 0) return 0;
            return hScale(d[selectedYear]['Total']);
          });
      }
    }
    function updateSideBarYear(cntryNm, yrs) {
      let lineChartwidth = 308,
        lineChartMargin = { top: 0, right: 25, bottom: 0, left: 40 };
      let totalVal = 0, defenceVal = 0, civilianVal = 0;
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
        totalVal = totalExport[0][selectedYear]['Total'];
        defenceVal = totalExport[0][selectedYear]['Military'];
        civilianVal = totalExport[0][selectedYear]['Civilian'];
      }
      if (cntryNm === 'International Missions') {
        totalVal = intlMissions[0][selectedYear].Total;
        defenceVal = intlMissions[0][selectedYear].Total;
        civilianVal = 0;
      }
      if (cntryNm !== 'World' && cntryNm !== 'International Missions') {
        let values = d3
          .select(
            `#${cntryNm
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}milBar`,
          )
          .datum();
        totalVal = values.years[selectedYear].TotalCountry;
        defenceVal = values.years[selectedYear].CountryMilatary;
        civilianVal = values.years[selectedYear].CivilianArmsTotal;
      }
      if (cntryNm != 'International Missions') {
        if (armstype === 'total') {
          d3.selectAll('.totalLine').attr('opacity', 0.8);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return (
              y['years'][selectedYear]['TotalCountry'] -
              x['years'][selectedYear]['TotalCountry']
            );
          });
          let rank = 'NA', bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['years'][selectedYear]['TotalCountry'] === totalVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['years'][selectedYear]['MilataryComment'] +
                '<br>' +
                arrSorted[i]['years'][selectedYear]['CivilianArmsComment'];
              break;
            }
          }
          if (totalVal === 0) {
            d3.selectAll('.country-rank').html('');
          } else {
            if (rank === 1) {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for total arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            } else {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for total arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            }
          }
          d3.selectAll('.key-points').html(bullets);
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
              arrSorted[k - 1].years[selectedYear].CountryMilatary *
              100 /
              totalExport[0][yrs]['Total'],
              percentCiv1 =
                arrSorted[k - 1].years[selectedYear].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3.select('.top-countries__name' + k).html(arrSorted[k - 1].name);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(arrSorted[k - 1].years[selectedYear].TotalCountry),
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
        if (armstype === 'civilian') {
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.1);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return (
              y['years'][selectedYear]['CivilianArmsTotal'] -
              x['years'][selectedYear]['CivilianArmsTotal']
            );
          });
          let rank = 'NA', bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['years'][selectedYear]['CivilianArmsTotal'] ===
              civilianVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['years'][selectedYear]['CivilianArmsComment'];
              break;
            }
          }
          if (civilianVal === 0) {
            d3.selectAll('.country-rank').html('');
          } else {
            if (rank === 1) {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for civilian arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            } else {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for civilian arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            }
          }
          d3.selectAll('.key-points').html(bullets);

          d3.selectAll('.data-list-total__name').html(cntryNm);
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
                arrSorted[k - 1].years[selectedYear].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3.select('.top-countries__name' + k).html(arrSorted[k - 1].name);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(
                  arrSorted[k - 1].years[selectedYear].CivilianArmsTotal,
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
        if (armstype === 'defence') {
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.1);
          arrSorted.sort(function(x, y) {
            return (
              y['years'][selectedYear]['CountryMilatary'] -
              x['years'][selectedYear]['CountryMilatary']
            );
          });
          let rank = 'NA', bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['years'][selectedYear]['CountryMilatary'] ===
              defenceVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets = arrSorted[i]['years'][selectedYear]['MilataryComment'];
              break;
            }
          }
          if (defenceVal === 0) {
            d3.selectAll('.country-rank').html('');
          } else {
            if (rank === 1) {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for military arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            } else {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for military arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            }
          }
          d3.selectAll('.key-points').html(bullets);

          d3.selectAll('.data-list-total__name').html(cntryNm);
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
              arrSorted[k - 1].years[selectedYear].CountryMilatary *
              100 /
              totalExport[0][yrs]['Total'],
              percentCiv1 = 0;
            d3.select('.top-countries__name' + k).html(arrSorted[k - 1].name);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(
                  arrSorted[k - 1].years[selectedYear].CountryMilatary,
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
        if (armstype === 'total') {
          intlMissions[0][selectedYear].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html('Countries where missions took place')
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
            .data(intlMissions[0][selectedYear].Countries)
            .enter()
            .append('tr')
            .attr('class', 'country-row');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => d[0])
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
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
        if (armstype === 'civilian') {
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html('Countries where missions took place')
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.1);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
        if (armstype === 'defence') {
          intlMissions[0][selectedYear].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html('Countries where missions took place')
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
            .data(intlMissions[0][selectedYear].Countries)
            .enter()
            .append('tr')
            .attr('class', 'country-row');
          d3
            .selectAll('.country-row')
            .append('th')
            .html(d => d[0])
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
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.1);
          d3.selectAll('.data-list-total__name').html(cntryNm);
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

        if (armstype === 'total' || armstype === 'defence') {
          d3.selectAll('.intlMissionsConnector').remove();
          d3.selectAll('.land').attr('fill-opacity', 0.1);
          for (
            let i = 0;
            i < intlMissions[0][selectedYear]['Countries'].length;
            i++
          ) {
            let cntryName = intlMissions[0][selectedYear]['Countries'][i][0];
            d3
              .selectAll(
                `#${cntryName
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .attr('fill-opacity', 0.8);
          }
          zoomGroup
            .selectAll('.intlMissionsConnector')
            .data(intlMissions[0][selectedYear]['Countries'])
            .enter()
            .append('line')
            .attr('class', 'intlMissionsConnector')
            .attr('x1', origin[0])
            .attr('y1', origin[1])
            .attr('x2', d => {
              let cntryName = d[0];
              return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[0];
            })
            .attr('y2', d => {
              let cntryName = d[0];
              return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[1];
            })
            .attr('stroke', '#2D80B5')
            .attr('opacity', 0.5);
        } else {
          d3.selectAll('.intlMissionsConnector').remove();
          d3.selectAll('.land').attr('fill-opacity', 0.15);
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
              y['years'][selectedYear]['TotalCountry'] -
              x['years'][selectedYear]['TotalCountry']
            );
          });
          let rank = 'NA', bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['years'][selectedYear]['TotalCountry'] === totalVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['years'][selectedYear]['MilataryComment'] +
                '<br>' +
                arrSorted[i]['years'][selectedYear]['CivilianArmsComment'];
              break;
            }
          }
          if (totalVal === 0) {
            d3.selectAll('.country-rank').html('');
          } else {
            if (rank === 1) {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for total arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            } else {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for total arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            }
          }
          d3.selectAll('.key-points').html(bullets);
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
              arrSorted[k - 1].years[selectedYear].CountryMilatary *
              100 /
              totalExport[0][yrs]['Total'],
              percentCiv1 =
                arrSorted[k - 1].years[selectedYear].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3.select('.top-countries__name' + k).html(arrSorted[k - 1].name);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(arrSorted[k - 1].years[selectedYear].TotalCountry),
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
        if (armstype === 'civilian') {
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.1);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          arrSorted.sort(function(x, y) {
            return (
              y['years'][selectedYear]['CivilianArmsTotal'] -
              x['years'][selectedYear]['CivilianArmsTotal']
            );
          });
          let rank = 'NA', bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['years'][selectedYear]['CivilianArmsTotal'] ===
              civilianVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets =
                arrSorted[i]['years'][selectedYear]['CivilianArmsComment'];
              break;
            }
          }
          if (civilianVal === 0) {
            d3.selectAll('.country-rank').html('');
          } else {
            if (rank === 1) {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for civilian arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            } else {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for civilian arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            }
          }
          d3.selectAll('.key-points').html(bullets);

          d3.selectAll('.data-list-total__name').html(cntryNm);
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
                arrSorted[k - 1].years[selectedYear].CivilianArmsTotal *
                100 /
                totalExport[0][yrs]['Total'];
            d3.select('.top-countries__name' + k).html(arrSorted[k - 1].name);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(
                  arrSorted[k - 1].years[selectedYear].CivilianArmsTotal,
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
        if (armstype === 'defence') {
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.1);
          arrSorted.sort(function(x, y) {
            return (
              y['years'][selectedYear]['CountryMilatary'] -
              x['years'][selectedYear]['CountryMilatary']
            );
          });
          let rank = 'NA', bullets = '';
          for (let i = 0; i < arrSorted.length; i++) {
            if (
              arrSorted[i]['years'][selectedYear]['CountryMilatary'] ===
              defenceVal
            ) {
              rank = i + 1;
            }
            if (arrSorted[i]['name'] === cntryNm) {
              bullets = arrSorted[i]['years'][selectedYear]['MilataryComment'];
              break;
            }
          }
          if (defenceVal === 0) {
            d3.selectAll('.country-rank').html('');
          } else {
            if (rank === 1) {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for military arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            } else {
              d3
                .selectAll('.country-rank')
                .html(
                  '<span style="font-weight:700">' +
                    cntryNm +
                    "'s</span> rank for military arms imports from Finland was <span style='font-weight:700'>" +
                    rank +
                    '</span> in the year ' +
                    selectedYear +
                    '.',
                );
            }
          }
          d3.selectAll('.key-points').html(bullets);

          d3.selectAll('.data-list-total__name').html(cntryNm);
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
              arrSorted[k - 1].years[selectedYear].CountryMilatary *
              100 /
              totalExport[0][yrs]['Total'],
              percentCiv1 = 0;
            d3.select('.top-countries__name' + k).html(arrSorted[k - 1].name);
            d3
              .select('.top-countries__name--sum' + k)
              .html(
                formatEuros(
                  arrSorted[k - 1].years[selectedYear].CountryMilatary,
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
            .html('Countries where missions took place')
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
            .html(d => d[0])
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
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
        if (armstype === 'civilian') {
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html('Countries where missions took place')
            .style('font-size', '1rem')
            .style('font-family', 'Source Sans Pro')
            .style('margin', '0 0 0.5rem 0');
          d3.selectAll('.country-table').remove();
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.1);
          d3.selectAll('.civilianLine').attr('opacity', 0.8);
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
        if (armstype === 'defence') {
          dataForLine[0][selectedYear].Countries.sort((a, b) => {
            return d3.descending(a[1], b[1]);
          });
          d3.selectAll('.key-points-head').remove();
          d3
            .selectAll('.key-points')
            .append('div')
            .attr('class', 'key-points-head')
            .html('Countries where missions took place')
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
            .html(d => d[0])
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
          d3.selectAll('.totalLine').attr('opacity', 0.1);
          d3.selectAll('.defenceLine').attr('opacity', 0.8);
          d3.selectAll('.civilianLine').attr('opacity', 0.1);
          d3.selectAll('.data-list-total__name').html(cntryNm);
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
        if (armstype === 'total' || armstype === 'defence') {
          d3.selectAll('.intlMissionsConnector').remove();
          for (
            let i = 0;
            i < intlMissions[0][selectedYear]['Countries'].length;
            i++
          ) {
            let cntryName = intlMissions[0][selectedYear]['Countries'][i][0];
            d3
              .selectAll(
                `#${cntryName
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .transition()
              .duration(300)
              .attr('fill-opacity', 0.8);
          }
          zoomGroup
            .selectAll('.intlMissionsConnector')
            .data(intlMissions[0][selectedYear]['Countries'])
            .enter()
            .append('line')
            .attr('class', 'intlMissionsConnector')
            .attr('x1', origin[0])
            .attr('y1', origin[1])
            .attr('x2', d => {
              let cntryName = d[0];
              return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[0];
            })
            .attr('y2', d => {
              let cntryName = d[0];
              return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[1];
            })
            .attr('stroke', '#2D80B5')
            .attr('opacity', 0.5);
        } else {
          d3.selectAll('.intlMissionsConnector').remove();
          d3.selectAll('.land').attr('fill-opacity', 0.15);
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
      d3
        .selectAll('.land')
        .transition()
        .duration(200)
        .attr('fill-opacity', 0.1);
      if (armstype === 'total' || armstype === 'defence') {
        for (
          let i = 0;
          i < intlMissions[0][selectedYear]['Countries'].length;
          i++
        ) {
          let cntryName = intlMissions[0][selectedYear]['Countries'][i][0];
          d3
            .selectAll(
              `#${cntryName
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}`,
            )
            .transition()
            .duration(300)
            .attr('fill-opacity', 0.8);
        }
        zoomGroup
          .selectAll('.intlMissionsConnector')
          .data(intlMissions[0][selectedYear]['Countries'])
          .enter()
          .append('line')
          .attr('class', 'intlMissionsConnector')
          .attr('x1', origin[0])
          .attr('y1', origin[1])
          .attr('x2', origin[0])
          .attr('y2', origin[1])
          .transition()
          .duration(300)
          .attr('x2', d => {
            let cntryName = d[0];
            return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[0];
          })
          .attr('y2', d => {
            let cntryName = d[0];
            return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[1];
          })
          .attr('stroke', '#2D80B5')
          .attr('opacity', 0.5);
      }
      d3.selectAll('rect').transition().duration(200).attr('opacity', 0.3);
      d3
        .selectAll('.intlmissionsbar')
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
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('#FinlandOverlay').style('display', 'none');
      d3.selectAll('.intlMissionsConnector').remove();
      mouseHover.state = true;
      mouseHover.country = cntryNm;
      console.log(mouseHover);
      d3
        .selectAll('.land')
        .transition()
        .duration(200)
        .attr('fill-opacity', 0.1);
      let values = d3
        .select(
          `#${cntryNm
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}milBar`,
        )
        .datum();
      d3
        .select(
          `#${cntryNm
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}`,
        )
        .transition()
        .duration(200)
        .attr('fill-opacity', 0.8);
      d3.selectAll('rect').transition().duration(200).attr('opacity', 0.3);
      d3
        .select(
          `#${cntryNm
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}milBar`,
        )
        .transition()
        .duration(200)
        .attr('opacity', 1);
      d3
        .select(
          `#${cntryNm
            .replace(/ /g, '_')
            .replace('(', '_')
            .replace(')', '_')
            .replace("'", '_')
            .replace('.', '_')}civBar`,
        )
        .transition()
        .duration(200)
        .attr('opacity', 1);

      if (cntryNm === 'United States of America') {
        d3
          .select('#Alaska__United_States_of_America_')
          .transition()
          .duration(200)
          .attr('fill-opacity', 0.8);
      }

      if (cntryNm === 'France') {
        d3
          .select('#France__Sub_Region_')
          .transition()
          .duration(200)
          .attr('fill-opacity', 0.8);
      }
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
        totalObject.Military = values.years[g.toString()].CountryMilatary;
        totalObject.Civilian = values.years[g.toString()].CivilianArmsTotal;
        totalObject.Total = totalObject.Military + totalObject.Civilian;
        dataForLineGraph[0][g.toString()] = totalObject;
      }
      d3
        .selectAll('.intlmissionsbartext')
        .transition()
        .duration(200)
        .attr('opacity', 0.2);
      if (armstype === 'total') {
        if (values.years[selectedYear].TotalCountry > 0) {
          d3
            .selectAll(
              `#${values.name
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}connector`,
            )
            .style('display', 'inline');
          d3.selectAll('#FinlandOverlay').style('display', 'inline');
        }
      }
      if (armstype === 'defence') {
        if (values.years[selectedYear].CountryMilatary > 0) {
          d3
            .selectAll(
              `#${values.name
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}connector`,
            )
            .style('display', 'inline');
          d3.selectAll('#FinlandOverlay').style('display', 'inline');
        }
      }
      if (armstype === 'civilian') {
        if (values.years[selectedYear].CivilianArmsTotal > 0) {
          d3
            .selectAll(
              `#${values.name
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}connector`,
            )
            .style('display', 'inline');
          d3.selectAll('#FinlandOverlay').style('display', 'inline');
        }
      }
      updateSidebar(
        cntryNm,
        selectedYear,
        values.years[selectedYear].TotalCountry,
        values.years[selectedYear].CountryMilatary,
        values.years[selectedYear].CivilianArmsTotal,
        dataForLineGraph,
      );
    }

    d3.selectAll('.country-data-container').on('mouseover', () => {
      mouseHover.state = false;
      if (active.state) {
        if (active.country !== 'International Missions') {
          let values = d3
            .select(
              `#${active.country
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}milBar`,
            )
            .datum();
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.1);
          d3
            .selectAll(
              `#${active.country
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}`,
            )
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.8);
          d3.selectAll('rect').transition().duration(200).attr('opacity', 0.3);
          d3
            .select(
              `#${active.country
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}milBar`,
            )
            .transition()
            .duration(200)
            .attr('opacity', 1);
          d3
            .select(
              `#${active.country
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}civBar`,
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
            totalObject.Military = values.years[g.toString()].CountryMilatary;
            totalObject.Civilian = values.years[g.toString()].CivilianArmsTotal;
            totalObject.Total = totalObject.Military + totalObject.Civilian;
            dataForLineGraph[0][g.toString()] = totalObject;
          }
          d3
            .selectAll('.intlmissionsbartext')
            .transition()
            .duration(200)
            .attr('opacity', 0.2);
          updateSidebar(
            active.country,
            selectedYear,
            values.years[selectedYear].TotalCountry,
            values.years[selectedYear].CountryMilatary,
            values.years[selectedYear].CivilianArmsTotal,
            dataForLineGraph,
          );
        } else {
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.1);
          d3
            .selectAll('.intlmissionsbar')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          d3
            .selectAll('.intlmissionsbartext')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          if (armstype === 'total' || armstype === 'defence') {
            for (
              let i = 0;
              i < intlMissions[0][selectedYear]['Countries'].length;
              i++
            ) {
              let cntryName = intlMissions[0][selectedYear]['Countries'][i][0];
              d3
                .selectAll(
                  `#${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}`,
                )
                .transition()
                .duration(300)
                .attr('fill-opacity', 0.8);
            }
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
      } else {
        d3
          .selectAll('.land')
          .transition()
          .duration(500)
          .attr('fill-opacity', d => {
            let cntryname = d.properties.name;
            if (d.properties.name === 'Alaska (United States of America)') {
              cntryname = 'United States of America';
            }
            if (d.properties.name === 'France (Sub Region)') {
              cntryname = 'France';
            }
            let indx = dataV2CountryList.indexOf(cntryname);
            if (armstype === 'total') {
              if (dataV2[indx].years[selectedYear]['TotalCountry'] > 0)
                return 0.8;
              else return 0.15;
            }
            if (armstype === 'defence') {
              if (dataV2[indx].years[selectedYear]['CountryMilatary'] > 0)
                return 0.8;
              else return 0.15;
            }
            if (armstype === 'civilian') {
              if (dataV2[indx].years[selectedYear]['CivilianArmsTotal'] > 0)
                return 0.8;
              else return 0.15;
            }
          });
        d3.selectAll('rect').attr('opacity', 1);
        d3
          .selectAll('.intlmissionsbartext')
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
    });

    let mapSVG = d3
      .select('.map-container')
      .append('svg')
      .attr('width', wid)
      .attr('height', hght)
      .attr('class', 'svg-map');

    mapSVG.call(Zoom);

    let zoomGroup = mapSVG.append('g');
    d3.select('.data-map-container').style('pointer-events', 'none');

    zoomGroup
      .append('rect')
      .attr('class', 'bg')
      .attr('width', wid)
      .attr('height', hght)
      .style('fill', 'none')
      .attr('pointer-events', 'none')
      .on('mouseover', () => {
        mouseHover.state = false;
        d3.selectAll('.connectorLine').style('display', 'none');
        d3.selectAll('#FinlandOverlay').style('display', 'none');
        d3.selectAll('.intlMissionsConnector').remove();
        if (!active.state) {
          d3
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr('fill-opacity', d => {
              let cntryname = d.properties.name;
              if (d.properties.name === 'Alaska (United States of America)') {
                cntryname = 'United States of America';
              }
              if (d.properties.name === 'France (Sub Region)') {
                cntryname = 'France';
              }
              let indx = dataV2CountryList.indexOf(cntryname);
              if (armstype === 'total') {
                if (dataV2[indx].years[selectedYear]['TotalCountry'] > 0)
                  return 0.7;
                else return 0.15;
              }
              if (armstype === 'defence') {
                if (dataV2[indx].years[selectedYear]['CountryMilatary'] > 0)
                  return 0.7;
                else return 0.15;
              }
              if (armstype === 'civilian') {
                if (dataV2[indx].years[selectedYear]['CivilianArmsTotal'] > 0)
                  return 0.7;
                else return 0.15;
              }
            });
          d3.selectAll('rect').transition().duration(200).attr('opacity', 1);
          d3
            .selectAll('.intlmissionsbartext')
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
            .selectAll('.land')
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.1);

          if (active.country !== 'International Missions') {
            let values = d3
              .select(
                `#${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}milBar`,
              )
              .datum();
            d3
              .select(
                `#${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}`,
              )
              .transition()
              .duration(200)
              .attr('fill-opacity', 0.8);
            d3
              .selectAll('rect')
              .transition()
              .duration(200)
              .attr('opacity', 0.3);
            d3
              .select(
                `#${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}milBar`,
              )
              .transition()
              .duration(200)
              .attr('opacity', 1);
            d3
              .select(
                `#${active.country
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}civBar`,
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
              totalObject.Military = values.years[g.toString()].CountryMilatary;
              totalObject.Civilian =
                values.years[g.toString()].CivilianArmsTotal;
              totalObject.Total = totalObject.Military + totalObject.Civilian;
              dataForLineGraph[0][g.toString()] = totalObject;
            }
            d3
              .selectAll('.intlmissionsbartext')
              .transition()
              .duration(200)
              .attr('opacity', 0.2);
            d3.selectAll('.intlMissionsConnector').remove();
            if (armstype === 'total') {
              if (values.years[selectedYear].TotalCountry > 0) {
                d3
                  .selectAll(
                    `#${values.name
                      .replace(/ /g, '_')
                      .replace('(', '_')
                      .replace(')', '_')
                      .replace("'", '_')
                      .replace('.', '_')}connector`,
                  )
                  .style('display', 'inline');
                d3.selectAll('#FinlandOverlay').style('display', 'inline');
              }
            }
            if (armstype === 'defence') {
              if (values.years[selectedYear].CountryMilatary > 0) {
                d3
                  .selectAll(
                    `#${values.name
                      .replace(/ /g, '_')
                      .replace('(', '_')
                      .replace(')', '_')
                      .replace("'", '_')
                      .replace('.', '_')}connector`,
                  )
                  .style('display', 'inline');
                d3.selectAll('#FinlandOverlay').style('display', 'inline');
              }
            }
            if (armstype === 'civilian') {
              if (values.years[selectedYear].CivilianArmsTotal > 0) {
                d3
                  .selectAll(
                    `#${values.name
                      .replace(/ /g, '_')
                      .replace('(', '_')
                      .replace(')', '_')
                      .replace("'", '_')
                      .replace('.', '_')}connector`,
                  )
                  .style('display', 'inline');
                d3.selectAll('#FinlandOverlay').style('display', 'inline');
              }
            }
            updateSidebar(
              active.country,
              selectedYear,
              values.years[selectedYear].TotalCountry,
              values.years[selectedYear].CountryMilatary,
              values.years[selectedYear].CivilianArmsTotal,
              dataForLineGraph,
            );
          } else {
            d3
              .selectAll('rect')
              .transition()
              .duration(200)
              .attr('opacity', 0.3);
            d3
              .selectAll('.intlmissionsbar')
              .transition()
              .duration(200)
              .attr('opacity', 1);
            d3
              .selectAll('.intlmissionsbartext')
              .transition()
              .duration(200)
              .attr('opacity', 1);

            if (armstype === 'total' || armstype === 'defence') {
              for (
                let i = 0;
                i < intlMissions[0][selectedYear]['Countries'].length;
                i++
              ) {
                let cntryName =
                  intlMissions[0][selectedYear]['Countries'][i][0];
                d3
                  .selectAll(
                    `#${cntryName
                      .replace(/ /g, '_')
                      .replace('(', '_')
                      .replace(')', '_')
                      .replace("'", '_')
                      .replace('.', '_')}`,
                  )
                  .transition()
                  .duration(300)
                  .attr('fill-opacity', 0.8);
              }
              zoomGroup
                .selectAll('.intlMissionsConnector')
                .data(intlMissions[0][selectedYear]['Countries'])
                .enter()
                .append('line')
                .attr('class', 'intlMissionsConnector')
                .attr('x1', origin[0])
                .attr('y1', origin[1])
                .attr('x2', d => {
                  let cntryName = d[0];
                  return dataV2[dataV2CountryList.indexOf(cntryName)]
                    .centroid[0];
                })
                .attr('y2', d => {
                  let cntryName = d[0];
                  return dataV2[dataV2CountryList.indexOf(cntryName)]
                    .centroid[1];
                })
                .attr('stroke', '#2D80B5')
                .attr('opacity', 0.5);
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
      })
      .on('click', () => {
        mapSVG.transition().duration(500).call(Zoom.transform, d3.zoomIdentity);
        active.state = false;
        d3.selectAll('.connectorLine').style('display', 'none');
        d3.selectAll('#FinlandOverlay').style('display', 'none');
        d3.selectAll('.intlMissionsConnector').remove();
        d3
          .selectAll('.land')
          .transition()
          .duration(200)
          .attr('fill-opacity', d => {
            let cntryname = d.properties.name;
            if (d.properties.name === 'Alaska (United States of America)') {
              cntryname = 'United States of America';
            }
            if (d.properties.name === 'France (Sub Region)') {
              cntryname = 'France';
            }
            let indx = dataV2CountryList.indexOf(cntryname);
            if (armstype === 'total') {
              if (dataV2[indx].years[selectedYear]['TotalCountry'] > 0)
                return 0.7;
              else return 0.15;
            }
            if (armstype === 'defence') {
              if (dataV2[indx].years[selectedYear]['CountryMilatary'] > 0)
                return 0.7;
              else return 0.15;
            }
            if (armstype === 'civilian') {
              if (dataV2[indx].years[selectedYear]['CivilianArmsTotal'] > 0)
                return 0.7;
              else return 0.15;
            }
          });
        d3.selectAll('rect').transition().duration(200).attr('opacity', 1);
        d3
          .selectAll('.intlmissionsbartext')
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
    let domain = [1, 1.47, 1.91, 2.37, 2.9, 6]; // Domain to define bins for GPI
    /*
    let colorList = [
      '#999999',
      '#C6E9F0',
      '#A7D3E5',
      '#7FA2CE',
      '#7A6CA8',
      '#7D2F6A',
    ];
    let colorList = [
      '#999999',
      '#fcfad9',
      '#c1e0b1',
      '#3db3c3',
      '#215fac',
      '#1f2357',
    ];
    */
    let ibmColor = {
      ultramarine: {
        '1': '#e7e9f7',
        '10': '#d1d7f4',
        '20': '#b0bef3',
        '30': '#89a2f6',
        '40': '#648fff',
        '50': '#3c6df0',
        '60': '#3151b7',
        '70': '#2e3f8f',
        '80': '#252e6a',
        '90': '#20214f',
      },
      blue: {
        '1': '#e1ebf7',
        '10': '#c8daf4',
        '20': '#a8c0f3',
        '30': '#79a6f6',
        '40': '#5392ff',
        '50': '#2d74da',
        '60': '#1f57a4',
        '70': '#25467a',
        '80': '#1d3458',
        '90': '#19273c',
      },
      cerulean: {
        '1': '#deedf7',
        '10': '#c2dbf4',
        '20': '#95c4f3',
        '30': '#56acf2',
        '40': '#009bef',
        '50': '#047cc0',
        '60': '#175d8d',
        '70': '#1c496d',
        '80': '#1d364d',
        '90': '#1b2834',
      },
      aqua: {
        '1': '#d1f0f7',
        '10': '#a0e3f0',
        '20': '#71cddd',
        '30': '#00b6cb',
        '40': '#12a3b4',
        '50': '#188291',
        '60': '#17616b',
        '70': '#164d56',
        '80': '#13393e',
        '90': '#122a2e',
      },
      teal: {
        '1': '#c0f5e8',
        '10': '#8ee9d4',
        '20': '#40d5bb',
        '30': '#00baa1',
        '40': '#00a78f',
        '50': '#008673',
        '60': '#006456',
        '70': '#124f44',
        '80': '#133a32',
        '90': '#122b26',
      },
      green: {
        '1': '#cef3d1',
        '10': '#89eda0',
        '20': '#57d785',
        '30': '#34bc6e',
        '40': '#00aa5e',
        '50': '#00884b',
        '60': '#116639',
        '70': '#12512e',
        '80': '#123b22',
        '90': '#112c1b',
      },
      lime: {
        '1': '#d7f4bd',
        '10': '#b4e876',
        '20': '#95d13c',
        '30': '#81b532',
        '40': '#73a22c',
        '50': '#5b8121',
        '60': '#426200',
        '70': '#374c1a',
        '80': '#283912',
        '90': '#1f2a10',
      },
      yellow: {
        '1': '#fbeaae',
        '10': '#fed500',
        '20': '#e3bc13',
        '30': '#c6a21a',
        '40': '#b3901f',
        '50': '#91721f',
        '60': '#70541b',
        '70': '#5b421a',
        '80': '#452f18',
        '90': '#372118',
      },
      gold: {
        '1': '#f5e8db',
        '10': '#ffd191',
        '20': '#ffb000',
        '30': '#e39d14',
        '40': '#c4881c',
        '50': '#9c6d1e',
        '60': '#74521b',
        '70': '#5b421c',
        '80': '#42301b',
        '90': '#2f261c',
      },
      orange: {
        '1': '#f5e8de',
        '10': '#fdcfad',
        '20': '#fcaf6d',
        '30': '#fe8500',
        '40': '#db7c00',
        '50': '#ad6418',
        '60': '#814b19',
        '70': '#653d1b',
        '80': '#482e1a',
        '90': '#33241c',
      },
      peach: {
        '1': '#f7e7e2',
        '10': '#f8d0c3',
        '20': '#faad96',
        '30': '#fc835c',
        '40': '#fe6100',
        '50': '#c45433',
        '60': '#993a1d',
        '70': '#782f1c',
        '80': '#56251a',
        '90': '#3a201b',
      },
      red: {
        '1': '#f7e6e6',
        '10': '#fccec7',
        '20': '#ffaa9d',
        '30': '#ff806c',
        '40': '#ff5c49',
        '50': '#e62325',
        '60': '#aa231f',
        '70': '#83231e',
        '80': '#5c1f1b',
        '90': '#3e1d1b',
      },
      magenta: {
        '1': '#f5e7eb',
        '10': '#f5cedb',
        '20': '#f7aac3',
        '30': '#f87eac',
        '40': '#ff509e',
        '50': '#dc267f',
        '60': '#a91560',
        '70': '#831b4c',
        '80': '#5d1a38',
        '90': '#401a29',
      },
      purple: {
        '1': '#f7e4fb',
        '10': '#efcef3',
        '20': '#e4adea',
        '30': '#d68adf',
        '40': '#cb71d7',
        '50': '#c22dd5',
        '60': '#9320a2',
        '70': '#71237c',
        '80': '#501e58',
        '90': '#3b1a40',
      },
      violet: {
        '1': '#ece8f5',
        '10': '#e2d2f4',
        '20': '#d2b5f0',
        '30': '#bf93eb',
        '40': '#b07ce8',
        '50': '#9753e1',
        '60': '#7732bb',
        '70': '#602797',
        '80': '#44216a',
        '90': '#321c4c',
      },
      indigo: {
        '1': '#e9e8ff',
        '10': '#dcd4f7',
        '20': '#c7b6f7',
        '30': '#ae97f4',
        '40': '#9b82f3',
        '50': '#785ef0',
        '60': '#5a3ec8',
        '70': '#473793',
        '80': '#352969',
        '90': '#272149',
      },
      gray: {
        '1': '#eaeaea',
        '10': '#d8d8d8',
        '20': '#c0bfc0',
        '30': '#a6a5a6',
        '40': '#949394',
        '50': '#777677',
        '60': '#595859',
        '70': '#464646',
        '80': '#343334',
        '90': '#272727',
      },
      'cool-gray': {
        '1': '#e3ecec',
        '10': '#d0dada',
        '20': '#b8c1c1',
        '30': '#9fa7a7',
        '40': '#8c9696',
        '50': '#6f7878',
        '60': '#535a5a',
        '70': '#424747',
        '80': '#343334',
        '90': '#272727',
      },
      'warm-gray': {
        '1': '#efe9e9',
        '10': '#e2d5d5',
        '20': '#ccbcbc',
        '30': '#b4a1a1',
        '40': '#9e9191',
        '50': '#7d7373',
        '60': '#5f5757',
        '70': '#4b4545',
        '80': '#373232',
        '90': '#2a2626',
      },
      'neutral-white': {
        '1': '#fcfcfc',
        '2': '#f9f9f9',
        '3': '#f6f6f6',
        '4': '#f3f3f3',
      },
      'cool-white': {
        '1': '#fbfcfc',
        '2': '#f8fafa',
        '3': '#f4f7f7',
        '4': '#f0f4f4',
      },
      'warm-white': {
        '1': '#fdfcfc',
        '2': '#fbf8f8',
        '3': '#f9f6f6',
        '4': '#f6f3f3',
      },
      black: {
        '100': '#000',
      },
      white: {
        '0': '#fff',
      },
    };
    let colorList2 = [
      '#dddddd',
      ibmColor['teal']['1'],
      ibmColor['teal']['10'],
      ibmColor['teal']['20'],
      ibmColor['teal']['30'],
      ibmColor['teal']['40'],
    ];
    let colorList1 = [
      '#dddddd',
      '#d5e1ec',
      '#b7bfe6',
      '#9f9cc1',
      '#89659f',
      '#82197c',
    ];

    let colorList3 = [
      '#dddddd',
      '#e7e7bf',
      '#fed199',
      '#e9a57a',
      '#cd7d6b',
      '#a75a61',
    ];
    let colorList = [
      '#dddddd',
      '#D5E1EC',
      '#B7BFD6',
      '#9F9CC1',
      '#89659F',
      '#82197C',
    ];

    let civilianColor = '#785ef0', defenceColor = '#fe6100';

    let threshold = d3.scaleThreshold().domain(domain).range(colorList);

    let dataV2 = this.state.saferGlobeDataV2;
    const startYear = parseInt(d3.keys(dataV2[0].years)[0], 10),
      endYear = parseInt(d3.keys(dataV2[0].years).slice(-1)[0], 10);
    let gpiObject = {};
    let currentYear = parseInt(d3.keys(dataV2[0].years).slice(-1)[0], 10),
      selectedYear = d3.keys(dataV2[0].years).slice(-1)[0];
    for (let i = 0; i < this.state.gpiData.length; i++) {
      gpiObject[this.state.gpiData[i].country] = {};
      for (let k = startYear; k <= endYear; k++) {
        gpiObject[this.state.gpiData[i].country][k.toString()] = +this.state
          .gpiData[i][k.toString()];
      }
    }

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
      for (let k = 0; k < dataV2.length; k++) {
        totalObject.Military =
          dataV2[k]['years'][g.toString()].MilataryMaterielTotal +
          dataV2[k]['years'][g.toString()].IntlMissionMilatary +
          totalObject.Military;
        totalObject.Civilian =
          dataV2[k]['years'][g.toString()].CivilianArmsTotal +
          totalObject.Civilian;
        intlMissionsObject.Total =
          dataV2[k]['years'][g.toString()].IntlMissionMilatary +
          intlMissionsObject.Total;
        if (dataV2[k]['years'][g.toString()].IntlMissionMilatary !== 0) {
          intlMissionsObject.Countries.push([]);
          intlMissionsObject.Countries[
            intlMissionsObject.Countries.length - 1
          ].push(dataV2[k].name);
          intlMissionsObject.Countries[
            intlMissionsObject.Countries.length - 1
          ].push(dataV2[k]['years'][g.toString()].IntlMissionMilatary);
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

      let totalForLine = [], defenceForLine = [], civilianForLine = [];

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

      let totalForLine = [], defenceForLine = [], civilianForLine = [];

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

    let features = topojson.feature(
      this.state.countryData,
      this.state.countryData.objects.countries,
    ).features;
    let countryList = [], dataV2CountryList = [];
    let origin;
    features.forEach((d, i) => {
      countryList.push(d.properties.name);
    });

    dataV2.forEach((d, i) => {
      let indx = countryList.indexOf(d.name);
      d.centroid = path.centroid(features[indx]);
      if (d.name === 'Finland') origin = path.centroid(features[indx]);
    });

    dataV2.sort((a, b) => {
      return d3.ascending(a.centroid[1], b.centroid[1]);
    });

    dataV2.forEach((d, i) => {
      dataV2CountryList.push(d.name);
    });

    let arrSorted = [];
    for (let i = 0; i < dataV2.length; i++) {
      arrSorted.push(dataV2[i]);
    }
    arrSorted.sort(function(x, y) {
      return (
        y['years'][selectedYear]['TotalCountry'] -
        x['years'][selectedYear]['TotalCountry']
      );
    });

    //Drawing Map
    zoomGroup
      .selectAll('.land')
      .data(
        topojson.feature(
          this.state.countryData,
          this.state.countryData.objects.countries,
        ).features,
      )
      .enter()
      .filter(d => d.properties.name !== null)
      .append('path')
      .attr('class', 'land')
      .attr('id', function(d) {
        return d.properties.name
          .replace(/ /g, '_')
          .replace('(', '_')
          .replace(')', '_')
          .replace("'", '_')
          .replace('.', '_'); // Giving different ID to each country path so it can be called later
      })
      .attr('d', path)
      .attr('fill', d => {
        let cntryName = d.properties.name;
        if (d.properties.name === 'Alaska (United States of America)') {
          cntryName = 'United States of America';
        }
        if (d.properties.name === 'France (Sub Region)') {
          cntryName = 'France';
        }
        if (cntryName === 'Finland') {
          return '#2D80B5';
        }
        if (d3.keys(gpiObject).indexOf(cntryName) !== -1) {
          if (gpiObject[cntryName][selectedYear] === -1) return '#dddddd';
          else return threshold(gpiObject[cntryName][selectedYear]);
        } else return '#dddddd';
      })
      .attr('fill-opacity', d => {
        if (d.properties.name === 'Finland') {
          return 1;
        } else return 0.1;
      })
      .attr('stroke', d => {
        if (d.properties.name === 'Somalia') {
          return 'none';
        }
        return '#fff';
      })
      .style('cursor', 'pointer')
      .attr('stroke-width', 0.5)
      .attr('pointer-events', 'none')
      .on('mouseover', d => {
        let cntryname = d.properties.name;
        if (d.properties.name === 'Alaska (United States of America)') {
          cntryname = 'United States of America';
        }
        if (d.properties.name === 'France (Sub Region)') {
          cntryname = 'France';
        }
        hover(cntryname, d3.event.x, d3.event.y);
      })
      .on('click', clicked)
      .transition()
      .duration(2500)
      .attr('fill', d => {
        let cntryName = d.properties.name;
        if (d.properties.name === 'Alaska (United States of America)') {
          cntryName = 'United States of America';
        }
        if (d.properties.name === 'France (Sub Region)') {
          cntryName = 'France';
        }
        if (d3.keys(gpiObject).indexOf(cntryName) !== -1) {
          if (gpiObject[cntryName][selectedYear] === -1) return '#dddddd';
          else return threshold(gpiObject[cntryName][selectedYear]);
        } else return '#dddddd';
      })
      .attr('fill-opacity', d => {
        let cntryname = d.properties.name;
        if (d.properties.name === 'Alaska (United States of America)') {
          cntryname = 'United States of America';
        }
        if (d.properties.name === 'France (Sub Region)') {
          cntryname = 'France';
        }
        let indx = dataV2CountryList.indexOf(cntryname);
        if (armstype === 'total') {
          if (dataV2[indx].years[selectedYear]['TotalCountry'] > 0) return 0.7;
          else return 0.15;
        }
        if (armstype === 'defence') {
          if (dataV2[indx].years[selectedYear]['CountryMilatary'] > 0)
            return 0.7;
          else return 0.15;
        }
        if (armstype === 'civilian') {
          if (dataV2[indx].years[selectedYear]['CivilianArmsTotal'] > 0)
            return 0.7;
          else return 0.15;
        }
      });
    zoomGroup
      .selectAll('.overlay')
      .data(
        topojson.feature(
          this.state.countryData,
          this.state.countryData.objects.countries,
        ).features,
      )
      .enter()
      .filter(d => d.properties.name === 'Finland')
      .append('path')
      .attr('class', 'overlay')
      .attr('id', 'FinlandOverlay')
      .attr('d', path)
      .attr('fill', '#2D80B5')
      .style('display', 'none')
      .on('mouseover', () => {
        d3.selectAll('.connectorLine').style('display', 'none');
        d3.selectAll('#FinlandOverlay').style('display', 'none');
      });
    zoomGroup
      .selectAll('.intlmissionsbartext')
      .data(intlMissions)
      .enter()
      .append('text')
      .attr('class', 'intlmissionsbartext')
      .attr('x', wid / 2)
      .attr('y', hght - 32)
      .attr('font-size', 9)
      .attr('font-weight', 700)
      .attr('font-family', 'Source Sans Pro')
      .text('Export to international peace mission')
      .attr('text-anchor', 'middle')
      .attr('fill', '#aaa')
      .style('cursor', 'pointer')
      .on('mouseover', hoverIntl)
      .on('click', clicked);
    zoomGroup
      .selectAll('.initCivBar')
      .data(dataV2)
      .enter()
      .filter(d => d.name == 'Finland')
      .append('rect')
      .attr('class', 'initCivBar')
      .attr('x', d => d.centroid[0] - 1.5)
      .attr('width', 3)
      .attr('height', hScale(totalExport[0][selectedYear]['Civilian']))
      .attr('y', d => {
        let y1 = hScale(totalExport[0][selectedYear]['Civilian']);
        return d.centroid[1] - y1;
      })
      .attr('fill', civilianColor)
      .transition()
      .duration(
        d =>
          2000 *
          totalExport[0][selectedYear]['Civilian'] /
          totalExport[0][selectedYear]['Total'],
      )
      .attr('y', d => d.centroid[1])
      .attr('height', 0);

    zoomGroup
      .selectAll('.initMilBars')
      .data(dataV2)
      .enter()
      .filter(d => d.name == 'Finland')
      .append('rect')
      .attr('class', 'initMilBars')
      .attr('x', d => d.centroid[0] - 1.5)
      .attr('width', 3)
      .attr('height', hScale(totalExport[0][selectedYear]['Military']))
      .attr('y', d => {
        let y1 = hScale(totalExport[0][selectedYear]['Civilian']),
          y2 = hScale(totalExport[0][selectedYear]['Military']);
        return d.centroid[1] - y1 - y2;
      })
      .attr('fill', defenceColor)
      .transition()
      .delay(
        d =>
          2000 *
          totalExport[0][selectedYear]['Civilian'] /
          totalExport[0][selectedYear]['Total'],
      )
      .duration(
        d =>
          500 *
          totalExport[0][selectedYear]['Military'] /
          totalExport[0][selectedYear]['Total'],
      )
      .attr('y', d => {
        let y1 = hScale(totalExport[0][selectedYear]['Civilian']);
        return d.centroid[1] - y1;
      })
      .attr('height', 0);

    zoomGroup
      .selectAll('.animatedCircle')
      .data(dataV2)
      .enter()
      .filter(d => d.years[selectedYear]['TotalCountry'] > 0)
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
      .attr('x2', d => d.centroid[0])
      .attr('y2', d => d.centroid[1])
      .transition()
      .duration(1000)
      .attr('x1', d => d.centroid[0])
      .attr('y1', d => d.centroid[1])
      .on('end', drawBars(endYear.toString()));
    function clicked(d) {
      d3.selectAll('.connectorLine').style('display', 'none');
      d3.selectAll('.intlMissionsConnector').remove();
      d3.selectAll('#FinlandOverlay').style('display', 'none');
      if (d.properties != null) {
        let countryClicked = d.properties.name;
        if (d.properties.name === 'Alaska (United States of America)') {
          countryClicked = 'United States of America';
        }
        if (d.properties.name === 'France (Sub Region)') {
          countryClicked = 'France';
        }
        if (active.country === countryClicked && active.state) {
          active.state = false;
          mapSVG
            .transition()
            .duration(500)
            .call(Zoom.transform, d3.zoomIdentity);
          d3
            .selectAll('.intlmissionsbartext')
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
            ); // updated for d3 v4
        }
        let values = d3
          .select(
            `#${countryClicked
              .replace(/ /g, '_')
              .replace('(', '_')
              .replace(')', '_')
              .replace("'", '_')
              .replace('.', '_')}milBar`,
          )
          .datum();
        let dataForLineGraph = [{}];
        for (let g = startYear; g <= endYear; g++) {
          let totalObject = {
            Year: g,
            Total: 0,
            Military: 0,
            Civilian: 0,
          };
          totalObject.Military = values.years[g.toString()].CountryMilatary;
          totalObject.Civilian = values.years[g.toString()].CivilianArmsTotal;
          totalObject.Total = totalObject.Military + totalObject.Civilian;
          dataForLineGraph[0][g.toString()] = totalObject;
        }

        d3
          .selectAll('.intlmissionsbartext')
          .transition()
          .duration(200)
          .attr('opacity', 0.2);
        if (armstype === 'total') {
          if (values.years[selectedYear].TotalCountry > 0) {
            d3
              .selectAll(
                `#${values.name
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}connector`,
              )
              .style('display', 'inline');
            d3.selectAll('#FinlandOverlay').style('display', 'inline');
          }
        }
        if (armstype === 'defence') {
          if (values.years[selectedYear].CountryMilatary > 0) {
            d3
              .selectAll(
                `#${values.name
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}connector`,
              )
              .style('display', 'inline');
            d3.selectAll('#FinlandOverlay').style('display', 'inline');
          }
        }
        if (armstype === 'civilian') {
          if (values.years[selectedYear].CivilianArmsTotal > 0) {
            d3
              .selectAll(
                `#${values.name
                  .replace(/ /g, '_')
                  .replace('(', '_')
                  .replace(')', '_')
                  .replace("'", '_')
                  .replace('.', '_')}connector`,
              )
              .style('display', 'inline');
            d3.selectAll('#FinlandOverlay').style('display', 'inline');
          }
        }
        updateSidebar(
          countryClicked,
          selectedYear,
          values.years[selectedYear].TotalCountry,
          values.years[selectedYear].CountryMilatary,
          values.years[selectedYear].CivilianArmsTotal,
          dataForLineGraph,
        );
      } else {
        if (active.country === 'International Missions' && active.state) {
          active.state = false;
          d3.selectAll('.intlMissionsConnector').remove();
          d3
            .selectAll('.intlmissionsbartext')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          d3
            .selectAll('.intlmissionsbar')
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
          d3.selectAll('.intlMissionsConnector').remove();
          active.state = true;
          active.country = 'International Missions'; // updated for d3 v4
          d3
            .selectAll('.intlmissionsbar')
            .transition()
            .duration(200)
            .attr('opacity', 1);
          d3
            .selectAll('.intlmissionsbartext')
            .transition()
            .duration(200)
            .attr('opacity', 1);

          if (armstype === 'total' || armstype === 'defence') {
            for (
              let i = 0;
              i < intlMissions[0][selectedYear]['Countries'].length;
              i++
            ) {
              let cntryName = intlMissions[0][selectedYear]['Countries'][i][0];
              d3
                .selectAll(
                  `#${cntryName
                    .replace(/ /g, '_')
                    .replace('(', '_')
                    .replace(')', '_')
                    .replace("'", '_')
                    .replace('.', '_')}`,
                )
                .attr('fill-opacity', 0.8);
            }
            zoomGroup
              .selectAll('.intlMissionsConnector')
              .data(intlMissions[0][selectedYear]['Countries'])
              .enter()
              .append('line')
              .attr('class', 'intlMissionsConnector')
              .attr('x1', origin[0])
              .attr('y1', origin[1])
              .attr('x2', d => {
                let cntryName = d[0];
                return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[0];
              })
              .attr('y2', d => {
                let cntryName = d[0];
                return dataV2[dataV2CountryList.indexOf(cntryName)].centroid[1];
              })
              .attr('stroke', '#2D80B5')
              .attr('opacity', 0.5);
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
    //End Drawing Map

    for (let k = 0; k < 5; k++) {
      d3.selectAll(`.Country${k + 1}`).html(`${k + 1}. ${dataV2[k].name}`);
    }
    for (let k = 0; k < 5; k++) {
      d3
        .selectAll(`.Value${k + 1}`)
        .html(`${formatEuros(dataV2[k].years[selectedYear]['TotalCountry'])}`);
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
        play = false;
        clearInterval(timer);
        changeYear(i.toString());
      };
    }

    d3.selectAll('.play-button').on('click', () => {
      let duration = 1500;
      if (play) {
        play = false;
        clearInterval(timer);
      } else {
        console.log('hello', play);
        play = true;
        if (currentYear > endYear) {
          currentYear = startYear;
        }
        timer = setInterval(() => {
          if (currentYear > endYear) {
            currentYear = startYear;
          }
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
      );

      if (!active.state) {
        d3
          .selectAll('.land')
          .transition()
          .duration(200)
          .attr('fill-opacity', d => {
            let cntryname = d.properties.name;
            if (d.properties.name === 'Alaska (United States of America)') {
              cntryname = 'United States of America';
            }
            if (d.properties.name === 'France (Sub Region)') {
              cntryname = 'France';
            }
            let indx = dataV2CountryList.indexOf(cntryname);
            if (armstype === 'total') {
              if (dataV2[indx].years[selectedYear]['TotalCountry'] > 0)
                return 0.7;
              else return 0.15;
            }
            if (armstype === 'defence') {
              if (dataV2[indx].years[selectedYear]['CountryMilatary'] > 0)
                return 0.7;
              else return 0.15;
            }
            if (armstype === 'civilian') {
              if (dataV2[indx].years[selectedYear]['CivilianArmsTotal'] > 0)
                return 0.7;
              else return 0.15;
            }
          });
        d3
          .selectAll('.intlmissionsbartext')
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
        if (active.country !== 'International Missions') {
          let values = d3
            .select(
              `#${active.country
                .replace(/ /g, '_')
                .replace('(', '_')
                .replace(')', '_')
                .replace("'", '_')
                .replace('.', '_')}milBar`,
            )
            .datum();
          let dataForLineGraph = [{}];
          for (let g = startYear; g <= endYear; g++) {
            let totalObject = {
              Year: g,
              Total: 0,
              Military: 0,
              Civilian: 0,
            };
            totalObject.Military = values.years[g.toString()].CountryMilatary;
            totalObject.Civilian = values.years[g.toString()].CivilianArmsTotal;
            totalObject.Total = totalObject.Military + totalObject.Civilian;
            dataForLineGraph[0][g.toString()] = totalObject;
          }
          d3
            .selectAll('.intlmissionsbartext')
            .transition()
            .duration(200)
            .attr('opacity', 0.2);
          updateSidebar(
            active.country,
            selectedYear,
            values.years[selectedYear].TotalCountry,
            values.years[selectedYear].CountryMilatary,
            values.years[selectedYear].CivilianArmsTotal,
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
      this.state.countryData &&
      this.state.gpiData &&
      this.state.saferGlobeData
    ) {
      return (
        <div>
          {this.drawMap(this.props.displayData)}
        </div>
      );
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
