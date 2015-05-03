var Async = require('async');

var Jammin = require('../index.js');
var Validator = new Jammin.Client({
  module: require('validator'),
  basePath: '/validator',
  host: 'http://127.0.0.1:3333',
})
var RemoteFS = new Jammin.Client({
  basePath: '/files',
  host: 'http://127.0.0.1:3333',
  module: {create: require('fs').writeFile}
})

var Server = require('./modules-server.js');

var Expect = require('chai').expect;

describe('Validator', function() {
  before(function() {
    Server.listen(3333);
  })
  after(function() {
    Server.close();
  })

  it('should validate email', function(done) {
    Async.parallel([
      function(callback) {
        Validator.isEmail('foo@bar.com', function(err, isEmail) {
          Expect(err).to.equal(null);
          Expect(isEmail).to.equal(true);
          callback();
        });
      },
      function(callback) {
        Validator.isEmail('foobar.com', function(err, isEmail) {
          Expect(err).to.equal(null);
          Expect(isEmail).to.equal(false);
          callback();
        });
      }
    ], done);
  });
});

describe('RemoteFS', function() {
  before(function() {
    Server.listen(3333);
  });

  it('should allow creating files', function(done) {
    RemoteFS.create('/foo.txt', 'hello world', function(err) {
      Expect(err).to.equal(null);
      done();
    });
  });
});
