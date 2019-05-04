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
function Forecast(forecast, time,lat,long,created_at) {
  this.forecast = forecast;
  this.time = time;
  this.latitude = lat;
  this.longitude = long;
  this.created_at = created_at;
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

/* all the functions */
//Error Handler
function handleError(err,res) {
  if (res) { res.status(500).send('Sorry, something went wrong');
  }
}
// delete the table
const delRowData = (tableName) =>{
  let sql = `DELETE FROM ${tableName} WHERE latitude =$1 and longitude =$2;`;
  let value  = [city.latitude,city.longitude];
  client.query(sql,value);
  console.log('Delete succesfull');
};
//Call api and enter new Data
const enterNewData = (tableName,data) =>{
  //console.log(data);
  let row =  Object.values(data[0]);
  let valuesString = '';
  if(row.length===5){
    valuesString='$1,$2,$3,$4,$5';
  }
  let sql = `INSERT INTO ${tableName} VALUES (${valuesString});`;
  data.forEach( (ele) => {
    let values=[];
    row =  Object.values(ele);
    row.forEach( rEle => {
      values.push(rEle);
    });//read all the data for that object
    //console.log('BData1', valuesArr);
    client.query(sql,values);
  });
  console.log('Inserted new data in DB');
};
//check to see if it time yet
const timeCheck = (tableName,dataCreated) =>{
  //weather API gets called every 30 sec
  const weatherTimeOut = 30* 1000;
  //movie API gets called every week
  const movieTimeOut = 7 * 24 * 60 * 60* 1000;
  //movie API gets called every hour
  const yelpTimeOut = 60 * 60 * 1000;
  let rightNow = Date.now();
  let timeOut;
  //based on the table we select correct timeout value
  if(tableName ==='weather') {
    timeOut = weatherTimeOut;
  }
  else if(tableName==='movie'){
    timeOut = movieTimeOut
  }
  else{
    timeout = yelpTimeOut;
  }
  //
  console.log(tableName);
  console.log(rightNow);
  console.log(dataCreated);
  console.log(timeOut);
  if(rightNow - dataCreated > timeOut){
    return true;
  }
  else{
    return false;
  }
};
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
          //checking to see if data is with the time frame
          if(timeCheck('weather',data.rows[0].created_at)){
            //if it has passed the time frame, get new data from API
            //delete previous data
            console.log('Deleting old weather DB');
            delRowData('weather');
            //get new data
            let geoCodeURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${city.latitude},${city.longitude}`;
            let myForecast;
            //console.log('newWeather');
            superagent.get(geoCodeURL).end( (err, googleAPIresponse) => {
              let data = googleAPIresponse.body;
              let daily = Object.entries(data)[6];
              let dailyData = daily[1].data;//hourly day forecast
              myForecast = dailyData.map(element => {
                let date = new Date(element.time * 1000).toDateString();
                return new Forecast(element.summary, date, city.latitude, city.longitude, Date.now());
              });
              //update the database with new data
              enterNewData('weather',myForecast);
              //send data to front-end
              response.send(myForecast);
            });
          }//else we just show values from DB
          else{
            let weather = data.rows.map(ele=> new Forecast(ele.forecast,ele.time,ele.latitude,ele.longitude));
            //console.log('oldWeather', weather);
            response.send(weather);
          }//else
        }//if there is no data in DB
        else{
          console.log('we deleting new db1');
          let geoCodeURL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${city.latitude},${city.longitude}`;
          //console.log('newWeather');
          superagent.get(geoCodeURL).end( (err, googleAPIresponse) => {
            let data = googleAPIresponse.body;
            let daily = Object.entries(data)[6];
            let dailyData = daily[1].data;//hourly day forecast
            let myForecast = dailyData.map(element => {
              let date = new Date(element.time * 1000).toDateString();
              //forecast,time,long,lat,created_time
              return new Forecast(element.summary, date, city.latitude, city.longitude, Date.now());
            });
            myForecast.forEach(ele=> {
              let insertStatement = 'INSERT INTO weather ( forecast,time,latitude,longitude,created_at) VALUES ($1,$2,$3,$4,$5);';
              let insertValues = [ele.forecast, ele.time, ele.latitude, ele.longitude, Date.now()];
              client.query(insertStatement,insertValues);
            });
            response.send(myForecast);
          });
        }
      });
  }
  catch (error) {
    console.log('Error on weather, error:  ', error);
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
  try{
    //name,image_url,price,rating,url
    let sqlStatement = 'SELECT * FROM yelp WHERE latitude =$1 and longitude =$2;';
    let values = [city.latitude,city.longitude];
    client.query(sqlStatement,values)
      .then( (data) =>{
        if(data.rows > 0 ){
          //name,image_url,price,rating,url
          let yelp = data.rows.map(ele=> new Yelp(ele.name, ele.image_url, ele.price, ele.rating,ele.url));
          //console.log('Old Events',event);
          response.send(yelp);
        }//if data
        else{
          let url = `https://api.yelp.com/v3/businesses/search?location=${city.search_query}`;
          superagent.get(url).set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
            .end( (err,yelpRes) => {
              let data = yelpRes.body.businesses;
              //name,image_url,price,rating,url
              let yelp = data.map( (ele) => new Yelp(ele.name,ele.image_url,ele.price,ele.rating,ele.url));
              //console.log('Going Front END: ',yelp);
              //putting data in DB
              yelp.forEach( ele=> {
                // Data going from DB://name,image_url,price,rating,url, lat, long
                let insertStatement = 'INSERT INTO yelp (name, image_url, price, rating, url,latitude, longitude) VALUES ($1,$2,$3,$4,$5,$6,$7);';
                let insertValues = [ele.name, ele.image_url, ele.price, ele.rating, ele.url, city.latitude, city.longitude];
                client.query(insertStatement,insertValues);
              });//forEach to insert into db
              response.send(yelp);
            });//.end super-agent
          //name,image_url,price,rating,url
        }//no data in DB
      });//.then from query
  }//try end
  catch(error){
    console.log('Error is from yelp section: ', error);
  } // catch end
});
//Handling all the paths
app.use('*', (request, response) => response.send('Sorry, that route does not exist.'));
//Listening to the port
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
