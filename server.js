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
function Movies(title, released_on,total_votes,average_votes,popularity, image_url,overview){
  this.title = title;
  this.released_on = released_on;
  this.total_votes = total_votes;
  this.average_votes = average_votes;
  this.popularity = popularity;
  this.image_url = image_url;
  this.overview = overview;
}
//Yelp
function Yelp(name,image_url,price,rating,url){
  this.name = name;
  this.image_url = image_url;
  this.price = price;
  this.rating = rating;
  this.url = url;
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
  try{
    let sqlStatement = 'SELECT * FROM movies WHERE latitude =$1 and longitude =$2;';
    let values = [city.latitude,city.longitude];
    client.query(sqlStatement,values)
      .then( (data) =>{
        if(data.rows > 0 ){
          // Data coming from DB: title, released_on,total_votes,average_votes,popularity, img_url,overview
          let movies = data.rows.map(ele=> new Event(ele.title,ele.released_on,ele.total_votes,ele.average_votes,ele.popularity,ele.image_url,ele.overview));
          //console.log('Old Events',event);
          response.send(movies);
        }
        else{
          let url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&language=en-US&query=${city.search_query}&page=1&include_adult=false`;

          superagent.get(url)
            .end( (err,movieResponse) => {
              let data = movieResponse.body.results;
              let movies = data.map( (ele) => new Movies(ele.title,ele.release_date,ele.vote_count,ele.vote_average,ele.popularity,'https://image.tmdb.org/t/p/w185_and_h278_bestv2'+ele.backdrop_path,ele.overview)
              );
              //console.log(movies);
              //putting data in DB
              movies.forEach( ele=> {
                // Data going from DB: title, released_on, total_votes, average_votes, popularity, image_url, overview, latitude, longitude
                let insertStatement = 'INSERT INTO movies (title, released_on, total_votes, average_votes,popularity, image_url,overview, latitude, longitude) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9);';
                let insertValues = [ele.title, ele.released_on, ele.total_votes, ele.average_votes,ele.popularity, ele.image_url, ele.overview, city.latitude, city.longitude];
                client.query(insertStatement,insertValues);
              });//forEach to insert into db
              response.send(movies);
            });//.end of super agent
        }// else no data then we inserting into DB
      }); // .then after the query
  }//try end
  catch(error){
    console.log('In movies , error is : ', error);
  }
});
//YELP API
app.get('/yelp', (request,response) => {
  let url = `https://api.yelp.com/v3/businesses/search?location=${city.search_query}`;
  superagent.get(url).set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .end( (err,yelpRes) => {
      let data = yelpRes.body.businesses;
      //name,image_url,price,rating,url
      let yelp = data.map( (ele) => new Yelp(ele.name,ele.image_url,ele.price,ele.rating,ele.url));
      //console.log('Going Front END: ',yelp);
      response.send(yelp);
      
    });
});
//Handling all the paths
app.use('*', (request, response) => response.send('Sorry, that route does not exist.'));
//Listening to the port
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
