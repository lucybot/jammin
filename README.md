## Installation
```npm install jammin```

**Note: Jammin is still in alpha. Not all features have been implemented.**

*Unimplemented features are tagged with ```TODO```*

## About
Jammin is the fastest way (that I know of) to build a JSON REST API with Node, Express, and MongoDB. It consists of a light-weight wrapper around [Mongoose](http://mongoosejs.com/) for database operations and an [Express](http://expressjs.com/) router to expose HTTP methods. It is fully extensible via middleware to support things like authentication, resource ownership, and complex queries.

## Usage

```js
var App = require('express')();
var Jammin = require('jammin');
var API = new Jammin('mongodb://<username>:<password>@<mongodb_host>');

var PetSchema = new Jammin.Schema({
  name: String,
  age: Number
});

API.define('pet', PetSchema);
API.pet.get('/pets/{name}');
API.pet.post('/pets');

App.use('/api', API);
App.listen(3000);
```

```bash
> curl -X POST 127.0.0.1:3000/pets -d '{"name": "Lucy", "age": 2}'
{"success": true}
> curl 127.0.0.1:3000/pets/Lucy
{"name": "Lucy", "age": 2}
```

### GET
Jammin will use ```req.params``` and ```req.query``` to **find an item** the database.
```js
API.pet.get('/pet/{name}');
```
Use ```getMany``` to return an array of matching documents.
```js
API.pet.getMany('/pet')
```

### POST
Jammin will use ```req.body``` to **create a new item** in the database.
```js
API.pet.post('/pets');
```
Use ```postMany``` to accept an array of items to be created.
```js
API.pet.postMany('/pets');
```

### PUT
Jammin will use ```req.params``` and ```req.query``` to find an item in the database, and use ```req.body``` to **update that item**.
```js
API.pet.put('/pets/{name}');
```
Use ```putMany``` to update every matching item in the database.
```js
API.pet.putMany('/pets');
```

### DELETE
Jammin will use ```req.params``` and ```req.query``` to **remove an item** from the database.
```js
API.pet.delete('/pets/{name}');
```
Use deleteMany to delete every matching item in the database.
```js
API.pet.deleteMany('/pets');
```

### Middleware
You can use middleware to intercept database calls, alter the request, perform authentication, etc.
The example below alters ```req.query``` to construct a complex Mongo query from user inputs.
```js
API.pet.getMany('/search/pets', function(req, res, next) {
  req.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
})
```

### Swagger ```TODO```
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
  swagger: {
    parameters: [{name: 'q', in: 'query', type: 'string'}]
  }
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
