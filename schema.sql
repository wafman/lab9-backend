CREATE TABLE location(
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_query VARCHAR(255),
  search_query VARCHAR(255)
);
CREATE TABLE weather(
  forcast VARCHAR(255),
  timeT VARCHAR(255),
  latitude DECIMAL,
  longitude DECIMAL
);
CREATE TABLE events(
  link VARCHAR(255),
  eventName VARCHAR(255),
  eventDate DATE,
  summary VARCHAR(255),
  latitude DECIMAL,
  longitude DECIMAL
);