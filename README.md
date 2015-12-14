# Verson 1.0 Preview
**This README is for the upcoming 1.0 version**

To see documentation for the version on npm (0.2.1) visit
[README-v0.md](README-v0.md)

## Installation
```npm install lucybot/jammin```

## About
Jammin is the fastest way to build REST APIs in NodeJS. It consists of:
* A light-weight wrapper around [Mongoose](http://mongoosejs.com/) to perform database operations
* An Express router to link database operations to HTTP operations

Jammin is built for [Express](http://expressjs.com/) and is fully extensible via **middleware** to support things like authentication, sanitization, and resource ownership.

Use ```API.addModel()``` to add an existing Mongoose model. You can attach HTTP routes to each model that will use ```req.params``` and ```req.query``` to query the database and ```req.body``` to update it.

## Quickstart

```js
var App = require('express')();
var Mongoose = require('mongoose');
var Jammin = require('jammin');
var API = new Jammin.API('mongodb://<username>:<password>@<mongodb_host>');

var PetSchema = {
  name: String,
  age: Number
};

var Pet = Mongoose.model('Pet', PetSchema);
API.addModel('Pet', Pet);
API.Pet.get('/pets/:name');
API.Pet.post('/pets');

App.use('/v0', API.router);
App.listen(3000);
```

```bash
> curl -X POST $HOST/v0/pets -d '{"name": "Lucy", "age": 2}'
{"success": true}
> curl $HOST/v0/pets/Lucy
{"name": "Lucy", "age": 2}
```

## Documentation

### Database Operations

**GET**
```get()``` will use ```req.params``` and ```req.query``` to **find an item** or array of items in the database.
```js
API.Pet.get('/pet/:name');
API.Pet.getMany('/pets')
```
**POST**
```post()``` will use ```req.body``` to **create a new item** or set of items in the database.
```js
API.Pet.post('/pets');
API.Pet.postMany('/pets');
```
**PATCH**
```patch()``` will use ```req.params``` and ```req.query``` to find an item or set of items in the database, and use ```req.body``` to **update those items**.
```js
API.Pet.patch('/pets/:name');
API.Pet.patchMany('/pets');
```
**PUT**
```put()``` will use ```req.params``` and ```req.query``` to find an item or set of items in the database, and use ```req.body``` to **update those items, or create a new item** if none exists
```js
API.Pet.put('/pets/:name');
API.Pet.putMany('/pets');
```
**DELETE**
```delete()``` will use ```req.params``` and ```req.query``` to **remove an item** or set of items from the database
```js
API.Pet.delete('/pets/:name');
API.Pet.deleteMany('/pets');
```

### Schemas and Validation
See the documentation for [Mongoose Schemas](http://mongoosejs.com/docs/guide.html) for the full set of features.
#### Require fields
```js
var PetSchema = {
  name: {type: String, required: true}
}
```
#### Hide fields
```js
var UserSchema = {
  username: String,
  password_hash: {type: String, select: false}
}
```

### Middleware
You can use middleware to intercept database calls, alter the request, perform authentication, etc.

Change ```req.jammin.query``` to alter how Jammin selects items from the database (GET, PATCH, PUT, DELETE).

Change ```req.jammin.document``` to alter the document Jammin will insert into the database (POST, PATCH, PUT).

Change ```req.jammin.method``` to alter how Jammin interacts with the database.

Jammin also comes with prepackaged middleware to support the following Mongoose operations:

`limit`, `sort`, `skip`, `projection`, `populate`, `select`

#### Examples
```js
var J = require('jammin').middleware

// The following are all equivalent
API.Pet.getMany('/pets', J.limit(20), J.sort('+name'));
API.Pet.getMany('/pets', J({limit: 20, sort: '+name'}));
API.Pet.getMany('/pets', function(req, res, next) {
  req.jammin.limit = 20;
  req.jammin.sort = '+name';
  next();
})

```

The example below alters ```req.query``` to construct a complex Mongo query from user inputs.
```js
API.Pet.getMany('/search/pets', function(req, res, next) {
  req.jammin.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
});
```
A more complex example achieves lazy deletion:
```js
API.router.use('/pets', function(req, res, next) {
  if (req.method === 'DELETE') {
    req.jammin.method = 'PATCH';
    req.jammin.document = {deleted: true};
  } else if (req.method === 'GET') {
    req.jammin.query.deleted = {"$ne": true};
  } else if (req.method === 'POST' || req.method === 'PUT') {
    req.jammin.document.deleted = false;
  }
  next();
}
```
Or resource ownership:
```js
var setOwnership = function(req, res, next) {
  req.jammin.document.owner = req.user.username;
  next();
}
var ownersOnly = function(req, res, next) {
  req.jammin.query.owner = {"$eq": req.user.username};
  next();
}
API.Pets.get('/pets');
API.Pets.post('/pets', setOwnership);
API.Pets.patch('/pets/:id', ownersOnly);
API.Pets.delete('/pets/:id', ownersOnly);
```
You can also use middleware to alter calls to module functions. This function sanitizes calls to fs:
```js
API.module('/files', {module: require('fs'), async: true}, function(req, res, next) {
  if (req.path.indexOf('Sync') !== -1) return res.status(400).send("Synchronous functions not allowed");
  // Remove path traversals
  req.jammin.arguments[0] = Path.join('/', req.jammin.arguments[0]);
  // Make sure all operations are inside __dirname/user_files
  req.jammin.arguments[0] = Path.join(__dirname, 'user_files', req.jammin.arguments[0]);
  next();
});
```
