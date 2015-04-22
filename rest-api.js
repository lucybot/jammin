var Mongoose = require('mongoose');
var Express = require('express');

var API = function(options) {
  if (typeof options === 'string') options =  {databaseURL: options};
  this.router = Express.Router();
  this.mongoose = Mongoose.createConnection(options.databaseURL);
  this.definitions = {};
}
module.exports = API;

var Definition = function(api, model) {
  this.api = api;
  this.db = model;
}

API.Schema = Mongoose.Schema;

API.prototype.define = function(label, schema) {
  // TODO: add schema to swagger
  // TODO: blacklist labels like 'prototype' and 'apply'
  this[label] = new Definition(this, this.mongoose.model(label, schema));
}

var getRouteFunction = function(method, many) {
  return function() {
    arguments = Array.prototype.slice.call(arguments);
    var path = arguments[0];
    var middleware = arguments.splice(1, arguments.length);
    var options  = typeof middleware[0] === 'object' ? middleware.shift() : {};
    // TODO: add endpoint to swagger
    var dbAction = function(req, res, next) {
      res.json({success: true})
    }
    middleware.push(dbAction);
    this.api.router[method].apply(this.api.router, middleware);
  }
}

var methods = ['get', 'put', 'post', 'delete'];
methods.forEach(function(method) {
  Definition.prototype[method] = getRouteFunction(method);
  Definition.prototype[method + 'Many'] = getRouteFunction(method, true)
})
