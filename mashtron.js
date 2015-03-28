var Cylon = require("cylon"),
    fs = require('fs'),
    StatsD = require('node-statsd'),
    client = new StatsD(),
    prob =  "/home/pi/temp1",
    Twitter = require('twitter'),
    twitMention = process.env.TWITTER_MENTION_NAME,
    twit = new Twitter({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    }),
    celsiusToFahrenheit = function (c) {
      var f = c * 9/5 + 32
      return f;
    }
    parseProbResults = function (data) {
      return (parseInt(data.split("t=")[1])) / 1000;
    },
    currentMashTemp = 0,
    receipe = {
      name: "Belgian Golden Strong Ale",
      url: "https://www.brewtoad.com/recipes/belgian-golden-strong-ale-21",
      mashTemp: 168.9,
      mashTime: 75
    },
    currentStep = "starting",
    currentTime = null;


Cylon.robot({
  connections: {
    raspi: { adaptor: 'raspi' }
  },


  work: function(my) {

    every((10).second(), function() {
      my.readTemp(prob, function (temp) {
        console.log(temp);
        currentMashTemp = temp;
        client.gauge('mash_temperature', temp);
      });

    });

    every((10).second(), function() {

      console.log(currentStep);

      currentTime = new Date().getTime();

      if (currentStep === "starting") {
        my.readTemp(prob, function (temp) {
          my.sayTweet("Hey " + twitMention + ", Let's brew " + receipe.name + " today. " + receipe.url);
        });
        currentStep = "heating-water-start";
      }

      if (currentStep === "heating-water-start")  {
        my.sayTweet("Bringing water to a temperature of " + receipe.mashTemp + "℉. " + twitMention);
        currentStep = "heating-water-inprogress";
      }

      if (currentMashTemp >= receipe.mashTemp && currentStep === "heating-water-inprogress")  {
        my.sayTweet("Water is up to strike temperature of " + receipe.mashTemp + "℉. " + twitMention);
        currentStep = "heating-water-done";
      }

      if (currentStep === "heating-water-done")  {
        my.sayTweet("Water is at strike temperature of " + currentMashTemp + "℉, it's time to add the grains. " + twitMention);
        currentStep = "mashing-start";
      }

      if (currentStep === "mashing-start")  {
        receipe.mashTimeEnd = new Date().getTime() + (receipe.mashTime * 60000)
        my.sayTweet("Water is at strike temperature, it's time to add the grains. " + twitMention);
        currentStep = "mashing-timer";
      }

      if (currentStep === "mashing-timer" && receipe.mashTimeEnd <= currentTime)  {
        currentStep = "mashing-done";
      }

      if (currentStep === "mashing-done")  {
        my.sayTweet("Mashing is done, time to remove the grains and start the boil. " + twitMention);
        currentStep = "mashing-complete";
      }

    });
  },

  sayTweet: function(msg) {
    console.log("Sending message to twitter.");
    twit.post('statuses/update', {status: msg},  function(error, params, response){

      if(error) {
        console.log(error)
      }

    });
  },

  readTemp: function (probPath, probCallback) {
    fs.readFile(probPath, 'utf8', function (err,data) {
      if (err) {
        return console.log(err);
      }
      if (data.indexOf("NO") > -1) {
        console.log("Unable to read sensor");
      } else {
        var tempCelsius = parseProbResults(data),
        tempFahrenheit = celsiusToFahrenheit(tempCelsius);

        probCallback(tempFahrenheit);

      }

    });

  }


}).start();
