# We be Jammin'

## Installation
```npm install jammin```

**Note: Jammin is still in alpha. Not all features have been implemented.**

## About
Jammin is the fastest way to build a JSON REST API with Node, Express, and MongoDB. It consists of a light-weight wrapper around Mongoose and an Express router to expose HTTP methods.

## Usage

```js
var App = require('express')();
var Jammin = require('jammin');
var API = new Jammin('mongodb://<username>:<password>@<mongodb_host>');

var PetSchema = new Jammin.Schema({
  name: String
});

API.define('pet', PetSchema);
API.pet.get('/pets');
API.pet.put('/pets');

App.use('/api', API);
App.listen(3000);
```

### GET
Jammin will use ```req.params``` and ```req.query``` to find an item the database.
```js
API.pet.get('/pet/{name}');
```

### POST
Jammin will use ```req.body``` to create a new item in the database.
```js
API.pet.post('/pet');
```

### PUT
Jammin will use ```req.params``` and ```req.query``` to find an item in the database, and use ```req.body``` to update that item.
```js
API.pet.put('/pet/{name}');
```

### DELETE
Jammin will use ```req.params``` and ```req.query``` to remove an item from the database.
```js
API.pet.delete('/pet/{name}');
```

### Middleware
You can use middleware to intercept Jammin requests, alter the request, perform authentication, etc.
The example below alters ```req.query``` to construct a complex Mongo query from user inputs.
```js
// Searches pets by name using parameter 'q', e.g. GET api.pets.com/search/pets?q=fido
API.pet.getMany('/search/pets', function(req, res, next) {
  req.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
})
```

### Swagger
Serve a [Swagger specification](http://swagger.io) for your API at the specified path. You can use this to document your API via [Swagger UI](https://github.com/swagger-api/swagger-ui) or a [LucyBot portal](https://lucybot.com)
```js
API.swagger('/swagger.json');
```
Jammin will fill out the technical details of your spec, but you can provide additional information:
```
var API = new Jammin({
  databaseURL: DatabaseURL,
  swagger: {
    info: {title: 'Pet Store'},
    host: 'api.example.com',
    basePath: '/api'
  }
});
```

## Extended Usage

```js

var Hash = require('password-hash');
var App = require('express')();

var DatabaseURL = 'mongodb://<username>:<password>@<mongodb_host>';
var Jammin = require('jammin')
var API = new Jammin({
  databaseURL: DatabaseURL,
  swagger: {
    info: {title: 'Pet Store'},
    host: 'api.example.com',
    basePath: '/api'
  }
});

// Jammin.Schema is an alias for Mongoose.Schema
var UserSchema = new Jammin.Schema({
  username: {type: String, required: true, unique: true, match: /^\w+$/},
  password_hash: {type: String, required: true},
})
var PetSchema = new Jammin.Schema({
  id: {type: Number, required: true, unique: true},
  name: String,
  owner: {type: Jammin.Schema.ObjectId, ref: 'User'},
  animalType: String,
  imageURLs: [String]
})

// define is an alias for Mongoose.model
API.define('pet', PetSchema);
API.define('user', UserSchema);

// Gets a pet by id
API.pet.get('/pets/{id}');

// Creates a new user
API.user.post('/user', function(req, res, next) {
  req.body.password_hash = Hash.generate(req.body.password);
  next();
});

// Searches pets by name
API.pet.getMany('/search/pets', {
  parameters: [{name: 'q', in: 'query', type: 'string'}]
}, function(req, res, next) {
  var userQuery = Util._extend({}, req.query);
  req.query = {
    name: { "$regex": new RegExp(userQuery.q) }
  };
  next();
})

// Middleware for authenticating the request
var authenticateUser = function(req, res, next) {
  var query = {
    username: req.headers['username'],
  };
  API.user.db.findOne(query, function(err, user) {
    if (err) {
      res.status(500).json({error: err.toString()})
    } else if (!user) {
      res.status(401).json({error: "Unknown user:" + query.username});
    } else if (!Hash.verify(req.headers['password'], user.password_hash)) {
      res.status(401).json({error: "Invalid password for " + query.username}) 
    } else {
      req.user = user;
      next();
    }
  }) 
}

// Creates a new pet
API.pet.post('/pets', authenticateUser, function(req, res, next) {
  req.body.owner = req.user._id;
  next();
});

// Deletes a pet.
API.pet.delete('/pets/{id}', authenticateUser, function(req, res, next) {
  req.query = {
    id: req.params.id,
    // By setting 'owner', we ensure the user can only delete his own pets.
    owner: req.user._id
  };
  next();
});
App.use('/api', API.router);
App.listen(3000);

```
