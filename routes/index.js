var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  // Render view with prime
  res.render('index', {
    n: req.query.n, prime: prime, likes: likes[req.query.n] || 0
  });
});

module.exports = router;
