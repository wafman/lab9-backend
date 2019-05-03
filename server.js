'use strict';

require('dotenv').config();

//required libaries
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');
//Global Location Variable
var city;

const app = express();
//PORT for the sever to operate
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static('./public'));

//sql
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

/*Constructos*/
//constructor for Location
function GEOloc(query, fmtQ, lat, long) {
  this.search_query = query;
  this.formatted_query = fmtQ;
  this.latitude = lat;
  this.longitude = long;

}
//constructor for weather
function Forecast(forecast, time,long,lat) {
  this.forecast = forecast;
  this.time = time;
  this.longitude = long;
  this.latitude = lat;
}
//constructor for eventsdemo
function Event(link,name,event_date,summary,long,lat){
  this.link = link;
  this.name = name;
  this.event_date = event_date;
  this.summary = summary;
  this.longitude = long;
  this.latitude = lat;
}
//Error Handler
function handleError(err,res) {
  if (res) { res.status(500).send('Sorry, something went wrong');
  }
}
//Movies
function Movies(title, released_on,total_votes,average_votes,popularity, img_url,overview){
  this.title = title;
  this.released_on = released_on;
  this.total_votes = total_votes;
  this.average_votes = average_votes;
  this.popularity = popularity;
  this.img_url = img_url;
  this.overview = overview;
}
//checking to see if the servre is working
app.get('/', (request, response) => {
  response.send('server works');
});
//location
app.get('/location', (request, response) => {
  //query
  let locQuery = request.query.data;
  let sqlStatement = 'SELECT * FROM location WHERE search_query =$1;';
  let values = [ locQuery ];
  client.query(sqlStatement,values)
    .then( (data) => {
      if( (data.rowCount) > 0){
        response.send(data.rows[0]);
        city = data.rows[0];
        console.log('my old city', city);
      }
      else{
        let geoCodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${locQuery}&key=${process.env.GOOGLE_API}`;

        superagent.get(geoCodeURL)
          .end( (err, googleAPIresponse) => {
            let data = googleAPIresponse.body;
            city = new GEOloc(locQuery, data.results[0].formatted_address, data.results[0].geometry.location.lat, data.results[0].geometry.location.lng);
            let insertStatement = 'INSERT INTO location ( search_query,formatted_query, latitude, longitude ) VALUES ( $1 , $2, $3, $4);';
            let insertValues = [ city.search_query, city.formatted_query, city.latitude,city.longitude];
            client.query(insertStatement,insertValues);
            response.send(city);
            if(err){
              handleError(err);
            }
          });
      }
    });
});
//Weather
app.get('/weather', (request, response) => {
  try {
    let sqlStatement = 'SELECT * FROM weather WHERE latitude =$1 and longitude =$2;';
    //console.log('City is', city);
    let values = [city.latitude, city.longitude];
    client.query(sqlStatement,values)
      .then( (data) =>{
        if( (data.rowCount) > 0){
          let weather = data.rows.map(ele=> new Forecast(ele.forcast,ele.timet,ele.latitude,ele.longitude));
          //console.log('oldWeather', weather);
          response.send(weather);
        }
        else{
          let geoCodeURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${city.latitude},${city.longitude}`;
          //console.log('newWeather');
          superagent.get(geoCodeURL).end( (err, googleAPIresponse) => {
            let data = googleAPIresponse.body;
            let daily = Object.entries(data)[6];
            let dailyData = daily[1].data;//hourly day forecast
            let myForecast = dailyData.map(element => {
              let date = new Date(element.time * 1000).toDateString();
              return new Forecast(element.summary, date,city.longitude,city.latitude);
            });
            myForecast.forEach(ele=> {
              let insertStatement = 'INSERT INTO weather ( forcast,timeT,latitude,longitude) VALUES ($1,$2,$3,$4);';
              let insertValues = [ele.forecast,ele.time,ele.latitude,ele.longitude];
              client.query(insertStatement,insertValues);
            });
            response.send(myForecast);
          });
        }
      });
  }
  catch (error) {
    handleError(error);
  }
});
//EventBrite
app.get('/events',(request,response)=>{
  try{
    //console.log('events');
    let sqlStatement = 'SELECT * FROM events WHERE latitude =$1 and longitude =$2;';
    let values = [city.latitude,city.longitude];
    client.query(sqlStatement,values)
      .then( (data) =>{
        if( (data.rowCount) > 0){
          let event = data.rows.map(ele=> new Event(ele.link,ele.eventname,ele.eventdate,ele.summary,ele.longitude,ele.latitude));
          //console.log('Old Events',event);
          response.send(event);
        }
        else{
          let geoCodeURL = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${city.longitude}&location.latitude=${city.latitude}&expand=venue`;

          superagent.get(geoCodeURL).set('Authorization', `Bearer ${process.env.EVENTBRITE_API_KEY}`)
            .end( (err, googleAPIresponse) => {
              let events = googleAPIresponse.body.events;
              let resultEvents = events.map(value=>{
                let name = value.name.text;
                let link = value.url;
                let eventDate = new Date(value.start.local).toDateString();
                let summary = value.summary;
                return new Event(link,name,eventDate,summary,city.longitude,city.latitude);
              });
              //console.log('New events', resultEvents);
              resultEvents.forEach( ele=> {
                let insertStatement = 'INSERT INTO events (link, eventName, eventDate,summary,latitude,longitude) VALUES ($1,$2,$3,$4,$5,$6);';
                let insertValues = [ele.link,ele.name,ele.event_date,ele.summary,ele.latitude,ele.longitude];
                client.query(insertStatement,insertValues);
              });
              response.send(resultEvents);
            });
        }
      });
  }
  catch(error){
    response.send(error);
  }
});
//Movie DB
app.get('/movies',(request,response) =>{
  //console.log('Our query',city.search_query);
  let url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&language=en-US&query=${city.search_query}&page=1&include_adult=false`;

  superagent.get(url)
    .end( (err,movieResponse) => {
      let data = movieResponse.body.results;
      let movies = [];
      data.forEach( (ele) => movies.push(new Movies(ele.title,ele.release_date,ele.vote_count,ele.vote_average,ele.popularity,ele.backdrop_path,ele.overview))
      );
      response.send(movies);
    });
});
//YELP API

//Handling all the paths
app.use('*', (request, response) => response.send('Sorry, that route does not exist.'));
//Listening to the port
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
