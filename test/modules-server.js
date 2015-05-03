var Path = require('path');

var Jammin = require('../index.js');
var API = new Jammin.API();

API.module('/validator', {module: require('validator')});
API.module('/files', {
  async: true,
  module: {create: require('fs').writeFile}
}, function(req, res, next) {
  req.jammin.arguments[0] = Path.join(__dirname, 'modules-files', req.jammin.arguments[0]);
  next();
})

var App = require('express')();
App.use(API.router);

var Server = null;
module.exports.listen = function(port) {
  console.log('listening: ' + port);
  Server = App.listen(port || 3000);
}
module.exports.close = function() {
  Server.close();
}
