var FS = require('fs');
var Request = require('request');
var Expect = require('chai').expect;
var Petstore = require('./petstore-server.js');

var SWAGGER_GOLDEN_FILE = __dirname + '/golden/petstore.swagger.json';
var BASE_URL = 'http://127.0.0.1:3333/api';

var USER_1 = {username: 'user1', password: 'jabberwocky'}
var USER_2 = {username: 'user2', password: 'cabbagesandkings'}

var PETS = [
  {id: 0, name: "Pet0", owner: USER_1.username, animalType: "dog"},
  {id: 1, name: "Pet1", owner: USER_1.username, animalType: "gerbil"},
  {id: 2, name: "Pet2", owner: USER_2.username, animalType: "dog"},
  {id: 3, name: "Pet3", owner: USER_1.username, animalType: "cat"},
  {id: 4, name: "Pet4", owner: USER_1.username, animalType: "cat"},
  {id: 5, name: "Pet5", owner: USER_1.username, animalType: "unknown"}
];
PETS.forEach(function(pet) {
  pet.vaccinations = [];
});

var VACCINATIONS = [{name: 'Rabies', date: '1987-09-23T00:00:00.000Z'}];

var CurrentPets = [];

var successResponse = function(expectedBody, done) {
  if (!done) {
    done = expectedBody;
    expectedBody = {success: true};
  }
  return function(err, res, body) {
    if (body.error) console.log(body.error);
    Expect(err).to.equal(null);
    Expect(res.statusCode).to.equal(200);
    Expect(body.error).to.equal(undefined);
    if (!expectedBody) {
      Expect(body.success).to.equal(true);
    } else {
      if (Array.isArray(expectedBody)) {
        Expect(body).to.deep.have.members(expectedBody);
        Expect(expectedBody).to.deep.have.members(body);
      } else {
        Expect(body).to.deep.equal(expectedBody);
      }
    }
    done();
  }
}

var failResponse = function(statusCode, done) {
  return function(err, res, body) {
    Expect(err).to.equal(null);
    Expect(res.statusCode).to.equal(statusCode);
    Expect(body.error).to.not.equal(null);
    done();
  }
}

describe('Petstore', function() {
  before(function(done) {
    Petstore.listen(3333);
    Petstore.dropAllEntries(done);
  });

  it('should allow new users', function(done) {
    Request.post({
      url: BASE_URL + '/users',
      body: USER_1,
      json: true
    }, successResponse(null, done));
  });

  it('should not show password_hash', function(done) {
    Request.get({
      url: BASE_URL + '/users',
      json: true,
    }, successResponse([{username: USER_1.username}], done))
  });

  it('should not allow duplicate user names', function(done) {
    Request.post({
      url: BASE_URL + '/users',
      body: USER_1,
      json: true
    }, failResponse(500, done));
  })

  it('should allow a second user', function(done) {
    Request.post({
      url: BASE_URL + '/users',
      body: USER_2,
      json: true
    }, successResponse(null, done));
  })

  it('should allow new pets', function(done) {
    CurrentPets.push(PETS[1]);
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 1, name: PETS[1].name, animalType: PETS[1].animalType},
      headers: USER_1,
      json: true
    }, successResponse(null, done));
  })

  it('should allow a second pet', function(done) {
    CurrentPets.push(PETS[2]);
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 2, name: PETS[2].name, animalType: PETS[2].animalType},
      headers: USER_2,
      json: true
    }, successResponse(null, done));
  })

  it('should upsert on post', function(done) {
    PETS[2].name = 'Goose';
    Request.post({
      url: BASE_URL + '/pets/' + PETS[2].id,
      body: PETS[2],
      headers: USER_2,
      json: true
    }, successResponse(null, done))
  })

  it('should not allow modifications from wrong user', function(done) {
    Request({
      method: 'patch',
      url: BASE_URL + '/pets/1',
      headers: USER_2,
      json: true
    }, failResponse(404, done)); // TODO: should be 401
  })

  it('should allow modifications to pet', function(done) {
    PETS[1].name = 'Loosey';
    Request({
      method: 'patch',
      url: BASE_URL + '/pets/1',
      headers: USER_1,
      body: {name: PETS[1].name},
      json: true
    }, successResponse(done));
  })

  it('should allow searching', function(done) {
    Request.get({
      url: BASE_URL + '/search/pets',
      qs: {q: 'oose'},
      json: true
    }, successResponse([PETS[1], PETS[2]], done))
  })

  it('should not allow duplicate pets', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 1, name: 'Goose'},
      headers: USER_1,
      json: true
    }, failResponse(500, done))
  })

  it('should not allow new pets without auth', function(done) {
    Request.post({
      url: BASE_URL + '/pets',
      body: {id: 55, name: 'Goose'},
      json: true
    }, failResponse(401, done));
  })

  it('should not allow deletes without auth', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/1',
      json: true
    }, failResponse(401, done));
  })

  it('should not allow deletes from wrong user', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/1',
      headers: USER_2,
      json: true
    }, failResponse(404, done)); // TODO: should return 401
  });

  it('should not reflect bad delete', function(done) {
    Request.get({
      url: BASE_URL + '/pets/1',
      json: true
    }, successResponse(PETS[1], done));
  })

  it('should not allow deletes with wrong password', function(done) {
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/1',
      headers: {
        username: USER_1.username,
        password: USER_2.password
      },
      json: true
    }, failResponse(401, done));
  })

  it('should allow deletes from owner', function(done) {
    CurrentPets.shift();
    Request({
      method: 'delete',
      url: BASE_URL + '/pets/1',
      headers: USER_1,
      json: true
    }, successResponse(null, done));
  })

  it('should allow batched adds of pets', function(done) {
    CurrentPets.unshift(PETS[3], PETS[4], PETS[5]);
    Request.post({
      url: BASE_URL + '/pets',
      headers: USER_1,
      body: [PETS[3], PETS[4], PETS[5]],
      json: true
    }, successResponse(null, done))
  })

  it('should allow batched modification of pets', function(done) {
    CurrentPets.forEach(function(pet) {
      if (pet.owner == USER_1.username && pet.animalType === 'cat') pet.animalType = 'dog';
    });
    Request({
      method: 'patch',
      url: BASE_URL + '/pets',
      headers: USER_1,
      qs: {
        animalType: 'cat'
      },
      body: {
        animalType: 'dog'
      },
      json: true
    }, successResponse(null, done))
  })

  it('should reflect batched modification', function(done) {
    Request.get({
      url: BASE_URL + '/pets',
      qs: {
        animalType: 'dog'
      },
      json: true
    }, successResponse(CurrentPets.filter(function(pet) {return pet.animalType === 'dog'}), done))
  })

  it('should support pet_count', function(done) {
    Request.get({
      url: BASE_URL + '/pet_count',
      json: true
    }, successResponse({count: CurrentPets.length}, done));
  });

  it('should support mapItem to get pet types', function(done) {
    Request.get({
      url: BASE_URL + '/pet_types',
      json: true,
    }, successResponse(CurrentPets.map(function(pet) {return pet.animalType}), done));
  })

  it('should allow adding a vaccination', function(done) {
    PETS[3].vaccinations = VACCINATIONS;
    Request.patch({
      url: BASE_URL + '/pets/3',
      headers: USER_1,
      body: {vaccinations: VACCINATIONS},
      json: true,
    }, successResponse(done))
  })

  it('should reflect added vaccination', function(done) {
    Request.get({
      url: BASE_URL + '/pets/3',
      json: true,
    }, successResponse(PETS[3], done));
  })

  it('should allow batched deletes of pets', function(done) {
    CurrentPets = CurrentPets.filter(function(pet) {return pet.animalType !== 'dog'});
    Request({
      method: 'delete',
      url: BASE_URL + '/pets',
      headers: USER_1,
      qs: {
        animalType: "dog"
      },
      json: true
    }, successResponse(null, done))
  })

  it('should serve swagger docs', function(done) {
    Request.get({
      url: BASE_URL + '/swagger.json',
      json: true
    }, function(err, res, body) {
      Expect(err).to.equal(null);
      if (process.env.WRITE_GOLDEN) {
        console.log("Writing new golden file!");
        FS.writeFileSync(SWAGGER_GOLDEN_FILE, JSON.stringify(body, null, 2));
      } else {
        var golden = JSON.parse(FS.readFileSync(SWAGGER_GOLDEN_FILE, 'utf8'));
        Expect(body).to.deep.equal(golden);
      }
      done();
    })
  })
})
