var Path = require('path');

var Jammin = require('../index.js');
var API = new Jammin.API();

API.module('/validator', {module: require('validator')});
API.module('/files', {
  async: true,
  module: require('fs'),
}, function(req, res, next) {
  req.jammin.arguments[0] = Path.join('/', req.jammin.arguments[0]);
  req.jammin.arguments[0] = Path.join(__dirname, 'modules-files', req.jammin.arguments[0]);
  next();
})

var NestedModule = {
  foo: function() {return 'foo'},
  nest: {
    bar: function() {return 'bar'},
    baz: function() {return 'baz'}
  }
}
API.module('/nest', {module: NestedModule});

var ErrorModule = {
  throwError: function() {
    throw new Error("thrown");
  },
  callbackError: function(callback) {
    callback({message: "callback"});
  }
}
API.module('/error', {module: ErrorModule, async: true})

var App = require('express')();
App.use(API.router);

App.use(function(err, req, res, next) {
  if (err) console.log('Error found');
  next();
})

var Server = null;
module.exports.listen = function(port) {
  console.log('listening: ' + port);
  Server = App.listen(port || 3000);
}
module.exports.close = function() {
  Server.close();
}
