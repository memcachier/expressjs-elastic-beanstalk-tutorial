var createError = require('http-errors');
var express = require('express');
var path = require('path');
var memjs = require('memjs');
var bodyParser = require('body-parser');
var session = require('express-session');
var MemcachedStore = require('connect-memjs')(session);

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session config
app.use(session({
  secret: 'ClydeIsASquirrel',
  resave: 'false',
  saveUninitialized: 'false',
  store: new MemcachedStore({
    servers: [process.env.MEMCACHIER_SERVERS],
    prefix: '_session_'
  })
}));

/* ADD THE APP.JS CODE HERE! */
var mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
  failover: true,  // default: false
  timeout: 1,      // default: 0.5 (seconds)
  keepAlive: true  // default: false
})

// Super simple algorithm to find largest prime <= n
var calculatePrime = function(n){
  var prime = 1;
  for (var i = n; i > 1; i--) {
    var is_prime = true;
    for (var j = 2; j < i; j++) {
      if (i % j == 0) {
        is_prime = false;
        break;
      }
    }
    if (is_prime) {
      prime = i;
      break;
    }
  }
  return prime;
}


var validate = function(req, res, next) {
  if(req.query.n) {
    number = parseInt(req.query.n, 10);
    if(isNaN(number) || number < 1 || number > 10000){
      res.render('index', {error: 'Please submit a valid number between 1 and 10000.'});
      return;
    }
    req.query.n = number;
  }
  next();
}

var cacheView = function(req, res, next) {
  var view_key = '_view_cache_' + req.originalUrl || req.url;
  mc.get(view_key, function(err, val) {
    if(err == null && val != null) {
      // Found the rendered view -> send it immediately
      res.send(val.toString('utf8'));
      return;
    }
    // Cache the rendered view for future requests
    res.sendRes = res.send
    res.send = function(body){
      mc.set(view_key, body, {expires:0}, function(err, val){/* handle error */})
      res.sendRes(body);
    }
    next();
  });
}

// Set up the GET route
app.get('/', validate, cacheView, function (req, res) {
  if(req.query.n) {
    var prime;
    var prime_key = 'prime.' + req.query.n;
    // Look in cache
    mc.get(prime_key, function(err, val) {
      if(err == null && val != null) {
        // Found it!
        prime = parseInt(val)
      }
      else {
        // Prime not in cache (calculate and store)
        prime = calculatePrime(req.query.n)
        mc.set(prime_key, '' + prime, {expires:0}, function(err, val){/* handle error */})
      }
      // Render view with prime
      res.render('index', {
        n: req.query.n, prime: prime, likes: likes[req.query.n] || 0
      });
    })
  }
  else {
    // Render view without prime
    res.render('index', {});
  }
});

// Like storage (in a serious app you should use a permanent storage like a database)
var likes = {}

app.post('/', function (req, res) {
  mc.delete('_view_cache_/?n=' + req.body.n, function(err, val){/* handle error */});
  likes[req.query.n] = (likes[req.query.n] || 0) + 1
  res.redirect('/?n=' + req.query.n)
});

/* END DIY CODE*/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
