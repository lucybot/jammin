var Hash = require('password-hash');

var App = require('express')();

var DatabaseURL = 'mongodb://admin:password@ds035448.mongolab.com:35448/lou-test'
var Lou = require('../rest-api.js')
var API = new Lou(DatabaseURL);

var UserSchema = new Lou.Schema({
  username: {type: String, required: true, unique: true, match: /^\w+$/},
  password_hash: {type: String, required: true},
})

var PetSchema = new Lou.Schema({
  id: {type: Number, required: true},
  name: String,
  owner: {type: Number, ref: 'User'},
  animalType: String,
  imageURLs: [String]
})

var authenticateUser = function(req, res, next) {
  var query = {
    username: req.get('username'),
    hash: Hash.generate(req.get('password'))
  };
  API.people.db.find(query, function(err, user) {
    if (err) {
      res.status(401).end()
    } else {
      req.user = user;
      next();
    }
  }) 
}

API.define('pet', PetSchema);
API.define('people', UserSchema);

// Creates a new user
API.people.post('/user', function(req, res, next) {
  req.body.password_hash = Hash.generate(req.body.password);
  next();
});

// Gets a pet by id
API.pet.get('/pets/{id}');

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
API.pet.post('/pets', {auto_increment: 'id'}, authenticateUser);

// Delete's a pet.
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
