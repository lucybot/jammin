# We be Jammin'

```npm install jammin```

** Note: Jammin is still in alpha. Not all features have been implemented. **

Jammin' is the fastest way to build a JSON REST API with Node, Express, and MongoDB.

Jammin' is a light-weight wrapper around Mongoose

## Example Usage

```js

var Hash = require('password-hash');
var App = require('express')();
App.use(require('body-parser').json());

var DatabaseURL = 'mongodb://<username>:<password>@<mongodb_host>';
var Jammin = require('../rest-api.js')
var API = new Jammin(DatabaseURL);

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
