var Async = require('async');
var Mongoose = require('mongoose');
var BodyParser = require('body-parser');
var PathToRegexp = require('path-to-regexp');

var Definition = module.exports = function(api, label, model) {
  this.api = api;
  this.label = label;
  this.db = this.model = model;
}

var METHODS = ['get', 'patch', 'put', 'post', 'delete'];
var TO_OBJ_OPTIONS = {
  versionKey: false,
  setters: true,
  getters: true,
  virtuals: false,
}

Definition.prototype.queryDB = function(method, many, jammin, options, callback) {
  var self = this;
  var query = jammin.query;
  var doc = jammin.document;
  if (method === 'get') {
    var find = many ? self.db.find : self.db.findOne;
    var run = find.apply(self.db, [query, jammin.projection]).select(options.select || '').populate(options.populate || '');
    if (jammin.populate) {
      if (Array.isArray(jammin.populate)) run.populate(jammin.populate[0], jammin.populate[1]);
      else run.populate(jammin.populate);
    }
    if (jammin.select) run.select(jammin.select);
    if (jammin.sort) run.sort(jammin.sort);
    if (jammin.limit) run.limit(jammin.limit);
    if (jammin.skip) run.skip(jammin.skip);
    run.exec(callback);
  } else if (method === 'post') {
    var docs = many ? doc : [doc];
    console.log('posting', docs);
    Async.parallel(docs.map(function(doc) {
      return function(callback) {
        var toAdd = new self.db(doc);
        toAdd.save(function(err, newDoc) {
          console.log('saved');
          callback(err, newDoc);
        });
      }
    }), function(err, results) {
      callback(err, many ? results : results[0]);
    })
  } else if (method === 'put') {
    var docs = many ? doc : [doc];
    Async.parallel(docs.map(function(doc) {
      return function(callback) {
        self.db.findOneAndUpdate(query, doc, {upsert: true, new: true, runValidators: true}).exec(callback);
      }
    }), function(err, docs) {
      if (!err && !many) docs = docs[0];
      callback(err, docs)
    });
  } else if (method === 'patch') {
    if (many) {
      // TODO: setters are not called here.
      self.db.update(query, doc, {multi: true, runValidators: true}).exec(function(err) {
        callback(err, {success: true});
      })
    } else {
      self.db.findOne(query).exec(function(err, oldDoc) {
        if (err || !oldDoc) return callback(err, oldDoc);
        for (var key in doc) {
          oldDoc[key] = doc[key];
          oldDoc.markModified(key);
        }
        oldDoc.save(callback);
      })
    }
  } else if (method === 'delete') {
    var remove = many ? self.db.remove : self.db.findOneAndRemove;
    remove.apply(self.db, [query]).exec(function(err, thing) {
      callback(err, thing);
    })
  } else {
    throw new Error("Unsupported method:" + method);
  }
}

var getRouteFunction = function(method, many) {
  // Can be called with (path[, middleware...]) or (req, res, callback);
  return function() {
    var self = this;
    arguments = Array.prototype.slice.call(arguments);
    var isMiddleware = typeof arguments[0] !== 'string';
    var sendResponse = !isMiddleware || arguments.length === 2;
    var options = sendResponse && typeof arguments[1] === 'object' ? arguments[1] : {};
    var dbAction = function(req, res, next) {
      var useMethod = isMiddleware ? method : req.jammin.method;
      self.queryDB(useMethod, many, req.jammin, options, function(err, thing) {
        if (err) res.status(500).json({error: err.toString()});
        else if (!thing) res.status(404).json({error: 'Not Found'})
        else if (sendResponse && (useMethod === 'get' || useMethod === 'post' || useMethod === 'put')) {
          if (many) thing = thing.map(function(t) { return t.toJSON(TO_OBJ_OPTIONS) });
          else thing = thing.toJSON(TO_OBJ_OPTIONS);
          if (options.mapItem) {
            if (many) thing = thing.map(options.mapItem);
            else thing = options.mapItem(thing);
          }
          res.json(thing);
        }
        else if (sendResponse) return res.json({success: true})
        else next(thing);
      })
    }
    // If we get (req, res, callback) instead of a path, just apply
    // dbAction. Otherwise delegate to the router.
    if (isMiddleware) return dbAction.apply(self, arguments);
    
    arguments = Array.prototype.slice.call(arguments);
    var expressPath = arguments[0];
    var keys = [];
    PathToRegexp(expressPath, keys);
    var swaggerPath = expressPath;
    keys.forEach(function(key) {
      swaggerPath = swaggerPath.replace(':' + key.name, '{' + key.name + '}');
    });
    var middleware = arguments.splice(1);
    if (typeof middleware[0] === 'object') middleware.shift();
    if (options.swagger) options.swagger = JSON.parse(JSON.stringify(options.swagger));
    self.api.swaggerBuilder.addRoute({
      method: method,
      path: swaggerPath,
      collection: self.label,
      many: many
    }, options.swagger);
    middleware.push(dbAction);
    middleware.unshift(expressPath);
    this.api.router[method].apply(this.api.router, middleware);
  }
}

METHODS.forEach(function(method) {
  Definition.prototype[method] = getRouteFunction(method);
  Definition.prototype[method + 'Many'] = getRouteFunction(method, true)
})
