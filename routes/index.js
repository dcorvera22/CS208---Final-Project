var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { pageTitle: 'Welcome', activePage: 'home' });
});

/* GET menu page. */
router.get('/menu', function(req, res, next) {
  res.render('menu', { pageTitle: 'Menu', activePage: 'menu' });
});

/* GET about us page. */
router.get('/about', function(req, res, next) {
  res.render('about', { pageTitle: 'About Us', activePage: 'about' });
});

/* GET customer comments page. */
router.get('/comments', function(req, res, next) {
  res.render('comments', { pageTitle: 'Customer Comments', activePage: 'comments' });
});

module.exports = router;
