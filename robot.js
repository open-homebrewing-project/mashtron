var Cylon = require('cylon'),
    fs = require('fs'),
    StatsD = require('node-statsd'),
    client = new StatsD(),
    Twitter = require('twitter'),
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
    };

Cylon.robot({
  probPath: "/home/pi/temp2",
  name: "MashTron",
  recipe: {
    name: "Weizenbock Halfie",
    url: "https://www.brewtoad.com/recipes/weizenbock-halfie-jz",
    mashTemp: 168.9,
    mashTime: 60
  },
  notify: {
    name: "@AgentO3"
  },
  currentTemp: 0,
  currentStep: "startup",
  connections: {
    robot: { adaptor: "loopback" }
  },

  work: function(my) {
    // Startup MashTron
    my.robot.emit("start");

    //Sample the temp every x seconds
    every((10).seconds(), function(){
      my.sampleTemp(my);


      my.when(my.currentTemp > 75 && my.currentStep === "startup", function(){
          my.robot.emit(my.currentStep);

      });

      my.when(my.currentTemp >= my.recipe.mashTemp && my.currentStep === "heating-water",
      function(){
          my.robot.emit(my.currentStep);
      })

      client.gauge('mash_temperature', my.currentTemp);

      console.log("Current step is " + my.currentStep);
      console.log("Current temp is " + my.currentTemp);

    });

    my.robot.once("startup", function(){
      my.sendMessage("Hey " + my.notify.name + ", Let's brew " + my.recipe.name + " today. " + my.recipe.url);
      my.currentStep = "heating-water";
    });

    my.robot.once("heating-water", function(){
      my.sendMessage("Water is up to strike temperature of " + my.recipe.mashTemp + "℉. " + my.notify.name);
      my.currentStep = "mashing-start";
      my.robot.emit(my.currentStep);
    });

    my.robot.once("mashing-start", function(){
      my.sleep((180).seconds());
      my.sendMessage("Starting mashing for " + my.recipe.mashTime
      + "mins. " + my.notify.name);

      after((my.recipe.mashTime * 60).seconds(), function(){
        my.sendMessage("Mashing is done, time to remove the grains and start the boil. " + my.notify.name);
        my.currentStep = "mashing-done";
        my.robot.emit(my.currentStep);
      });
    });

    my.robot.once("mashing-done", function(){
      console.log("Mashing process is done shutting down MashTron.")
      Cylon.halt();
    });
  },

  when: function(exp, callBack){
    if (exp) {
      callBack()
    };
  },

  sampleTemp: function(my) {
    var data = fs.readFileSync(my.probPath, 'utf8');

    if (data.indexOf("NO") > -1) {
        console.log("Unable to read sensor");
    } else {
      var tempCelsius = parseProbResults(data),
      tempFahrenheit = celsiusToFahrenheit(tempCelsius);

      my.currentTemp = tempFahrenheit;
    }

  },

  sendMessage: function(msg) {
    console.log("msg");
    twit.post('statuses/update', {status: msg},  function(error, params, response){

      if(error) {
        console.log(error)
      }

    });
  },

  sleep: function sleep(ms) {
    var start = Date.now(),
        i;

    while(Date.now() < start + ms) {
      i = 0;
    }
  },
}).start();
