var Mongoose = require('mongoose');
var Express = require('express');
var BodyParser = require('body-parser');

var SwaggerBuilder = require('./swagger-builder.js');

var SELECT = '-_id -__v'
var FIELDS = {};
SELECT.split(' ').forEach(function(field) {
  if (field.indexOf('-') === 0) {
    FIELDS[field.substring(1)] = false;
  } else {
    FIELDS[field] = true;
  }
})

/** API **/

var API = function(options) {
  if (typeof options === 'string') options =  {databaseURL: options};
  this.router = Express.Router();
  this.router.use(BodyParser.json());
  this.mongoose = Mongoose.createConnection(options.databaseURL);
  this.swaggerBuilder = new SwaggerBuilder(options.swagger);
}
module.exports = API;
API.Schema = Mongoose.Schema;

API.prototype.define = function(label, schema) {
  this.swaggerBuilder.addDefinition(label, schema);
  if (Object.keys(this).indexOf(label) !== -1) {
    throw new Error("Invalid label " + label + "\nLabel is restricted or already defined")
  }
  this[label] = new Definition(this, label, schema);
}

API.prototype.swagger = function() {
  var self = this;
  arguments = Array.prototype.slice.call(arguments);
  var path = arguments[0];
  var middleware = arguments.splice(1);
  var options  = typeof middleware[0] === 'object' ? middleware.shift() : {};
  middleware.unshift(path);
  middleware.push(function(req, res, next) {
    res.json(self.swaggerBuilder.swagger);
  })
  self.router.get.apply(self.router, middleware);
}

/** Definition **/

var Definition = function(api, label, schema) {
  this.api = api;
  this.label = label;
  this.db = api.mongoose.model(label, new Mongoose.Schema(schema));
}

var getRouteFunction = function(method, many) {
  return function() {
    var self = this;
    arguments = Array.prototype.slice.call(arguments);
    var path = arguments[0];
    var expressPath = path.replace(/{(.*)}/g, ':$1');
    var middleware = arguments.splice(1);
    var options  = typeof middleware[0] === 'object' ? middleware.shift() : {};
    self.api.swaggerBuilder.addRoute({
      method: method,
      path: path,
      collection: self.label,
      many: many
    }, options.swagger);
    var dbAction = function(req, res, next) {
      var query = req.query;
      for (key in req.params) {
        query[key] = req.params[key];
      }
      if (method === 'get') {
        var find = many ? self.db.find : self.db.findOne;
        find.apply(self.db, [query, SELECT]).exec(function(err, thing) {
          if (err) res.status(500).json({error: err.toString()})
          else if (!thing) res.status(404).json({error: 'Not Found'})
          else res.json(thing);
        })
      } else if (method === 'post') {
        var docs = many ? req.body : [req.body];
        self.db.collection.insert(docs, function(err, docs) {
          if (err) res.status(500).json({error: err.toString()})
          else res.json({success: true})
        })
      } else if (method === 'patch') {
        if (many) {
          self.db.update(query, req.body, {multi: true}).select(SELECT).exec(function(err) {
            if (err) res.status(500).json({error: err.toString()});
            else res.json({success: true});
          })
        } else {
          self.db.findOneAndUpdate(query, req.body, {new: true}).select(SELECT).exec(function(err, thing) {
            if (err) res.status(500).json({error: err.toString()});
            else if (!thing) res.status(404).json({error: 'Not Found'});
            else res.json(thing);
          });
        }
      } else if (method === 'delete') {
        var remove = many ? self.db.remove : self.db.findOneAndRemove;
        remove.apply(self.db, [query]).exec(function(err, thing) {
          if (err) res.status(500).json({error: err.toString()});
          else if (!thing) res.status(404).json({error: 'Not Found'});
          else res.json({success: true});
        })
      }
    }
    var firstAction = function(req, res, next) {
      next();
    }
    middleware.push(dbAction);
    middleware.unshift(firstAction);
    middleware.unshift(expressPath);
    this.api.router[method].apply(this.api.router, middleware);
  }
}

var methods = ['get', 'patch', 'post', 'delete'];
methods.forEach(function(method) {
  Definition.prototype[method] = getRouteFunction(method);
  Definition.prototype[method + 'Many'] = getRouteFunction(method, true)
})
