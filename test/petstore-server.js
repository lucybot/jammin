var FS = require('fs');
var Hash = require('password-hash');
var App = require('express')();
App.use(require('cors')());

module.exports.listen = function(port) {
  App.listen(port || 3000);
}

module.exports.dropAllEntries = function(callback) {
  API.Pet.db.remove({}, function(err) {
    API.User.db.remove({}, function(err) {
      callback();
    })
  })
}

var DatabaseURL = JSON.parse(FS.readFileSync('./creds/mongo.json', 'utf8')).url;
var Jammin = require('../index.js')
var API = new Jammin({
  databaseURL: DatabaseURL,
  swagger: {
    info: {title: 'Pet Store', version: '0.1'},
    host: 'api.example.com',
    basePath: '/api',
    securityDefinitions: {
      username: { name: 'username', in: 'header', type: 'string'},
      password: { name: 'password', in: 'header', type: 'string'}
    },
    definitions: {
      User: {
        properties: {
          username: {type: 'string'},
        }
      },
    }
  }
});

var UserSchema = {
  username: {type: String, required: true, unique: true, match: /^\w+$/},
  password_hash: {type: String, required: true},
}

var PetSchema = {
  id: {type: Number, required: true, unique: true},
  name: String,
  owner: String,
  animalType: {type: String, default: 'unknown'},
  vaccinations: [{
    name: String,
    date: Date
  }]
}

var authenticateUser = function(req, res, next) {
  var query = {
    username: req.headers['username'],
  };
  API.User.db.findOne(query, function(err, user) {
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

var SwaggerLogin = {
  swagger: {
    security: {username: [], password: []},
  }
}

API.define('Pet', PetSchema);
API.define('User', UserSchema);

// Creates a new user.
API.User.post('/user', {
  swagger: {
    parameters: [{
        name: 'body',
        in: 'body',
        schema: {
          properties: {
            username: {type: 'string'},
            password: {type: 'string'}
          }
      }
    }]
  }
}, function(req, res, next) {
  req.body.password_hash = Hash.generate(req.body.password);
  next();
});

// Gets a pet by id.
API.Pet.get('/pets/{id}');

// Gets an array of pets that match the query.
API.Pet.getMany('/pets');

// Searches pets by name
API.Pet.getMany('/search/pets', {
  swagger: {
    description: "Search all pets by name",
    parameters: [
      {name: 'q', in: 'query', type: 'string', description: 'Any regex'}
    ]
  }
}, function(req, res, next) {
  req.query = {
    name: { "$regex": new RegExp(req.query.q) }
  };
  next();
})

API.Pet.post('/pets/{id}', SwaggerLogin, authenticateUser, function(req, res, next) {
  req.body.owner = req.user.username;
  req.body.id = req.params.id;
  next();
})

// Creates one or more new pets.
API.Pet.postMany('/pets', SwaggerLogin, authenticateUser, function(req, res, next) {
  if (!Array.isArray(req.body)) req.body = [req.body];
  req.body.forEach(function(pet) {
    pet.owner = req.user.username;
  });
  next();
});

// Setting req.query.owner ensures that only the logged-in user's
// pets will be returned by any queries Jammin makes to the DB.
var enforceOwnership = function(req, res, next) {
  req.query.owner = req.user.username;
  next();
}

// Changes a pet.
API.Pet.patch('/pets/{id}', SwaggerLogin, authenticateUser, enforceOwnership);

// Changes every pet that matches the query.
API.Pet.patchMany('/pets', SwaggerLogin, authenticateUser, enforceOwnership);

// Deletes a pet by ID.
API.Pet.delete('/pets/{id}', SwaggerLogin, authenticateUser, enforceOwnership);

// Deletes every pet that matches the query.
API.Pet.deleteMany('/pets', SwaggerLogin, authenticateUser, enforceOwnership);

API.router.get('/pet_count', function(req, res) {
  API.Pet.getMany(req, res, function(pets) {
    res.json({count: pets.length})
  })
})

API.Pet.getMany('/pet_types', {mapItem: function(pet) {return pet.animalType}})

API.swagger('/swagger.json');

App.use('/api', API.router);
