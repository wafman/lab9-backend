DROP TABLE location;
DROP TABLE weather ; 
DROP TABLE events; 
DROP TABLE movies;
DROP TABLE yelp;

CREATE TABLE location(
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_query VARCHAR(255),
  search_query VARCHAR(255)
);
CREATE TABLE weather(
  forecast VARCHAR(255),
  time VARCHAR(255),
  latitude DECIMAL,
  longitude DECIMAL,
  created_at BIGINT
);
CREATE TABLE events(
  link VARCHAR(255),
  eventName VARCHAR(255),
  eventDate VARCHAR(255),
  summary VARCHAR(255),
  latitude DECIMAL,
  longitude DECIMAL
);
CREATE TABLE movies(
  --title, released_on, total_votes, average_votes, popularity, image_url, overview, latitude, longitude
  title VARCHAR(50),
  released_on VARCHAR(20),
  total_votes DECIMAL,
  average_votes DECIMAL,
  popularity DECIMAL,
  image_url VARCHAR(255),
  overview TEXT,
  latitude DECIMAL,
  longitude DECIMAL
);
CREATE TABLE yelp (
  --name,image_url,price,rating,url
  name VARCHAR(50),
  image_url VARCHAR(100),
  price VARCHAR(10),
  rating DECIMAL,
  url VARCHAR(255),
  latitude DECIMAL,
  longitude DECIMAL
);