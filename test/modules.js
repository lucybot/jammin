var Async = require('async');
var Request = require('request');

var Jammin = require('../index.js');
var Validator = new Jammin.Client({
  module: require('validator'),
  basePath: '/validator',
  host: 'http://127.0.0.1:3333',
})
var RemoteFS = new Jammin.Client({
  basePath: '/files',
  host: 'http://127.0.0.1:3333',
  module: require('fs')
})

var Server = require('./modules-server.js');

var Expect = require('chai').expect;

var FILES = [{
  in_filename: 'hello.txt',
  out_filename: 'hello.txt',
  contents: 'Hello world'
}, {
  in_filename: '../../jailbreak.txt',
  out_filename: 'jailbreak.txt',
  contents: 'JAILBREAK',
}, {
  in_filename: 'via_api.txt',
  out_filename: 'via_api.txt',
  contents: 'This file was created via an HTTP call'
}]

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
    RemoteFS.writeFile(FILES[0].in_filename, FILES[0].contents, function(err) {
      Expect(err).to.equal(null);
      done();
    });
  });

  it('should not create files outside of directory', function(done) {
    RemoteFS.writeFile(FILES[1].in_filename, FILES[1].contents, function(err) {
      Expect(err).to.equal(null);
      done();
    })
  });

  it('should allow creating files by API', function(done) {
    Request({
      url: 'http://127.0.0.1:3333/files/writeFile?path=' + FILES[2].in_filename,
      method: 'post',
      body: {
        data: FILES[2].contents
      },
      json: true,
    }, function(err, resp, body) {
      Expect(err).to.equal(null);
      done();
    })
  });

  it('should allow getting files', function(done) {
    Async.parallel(FILES.map(function(file) {
      return function(callback) {
        RemoteFS.readFile(file.out_filename, 'utf8', function(err, contents) {
          Expect(err).to.equal(null);
          Expect(contents).to.equal(file.contents);
          callback();
        });
      }
    }), function(err) {
      done();
    })
  })
});
