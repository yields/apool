
var phantom = require('node-phantom');
var app = require('express')();
var codes = require('./codes');
var pool = require('..')(100);
require('./test');

phantom.create(function(err, p){
  if (err) throw err;
  pool.constructor(function(done){
    p.createPage(done);
  });
  pool.populate(50);
});

pool.destructor(function(page){
  page.close();
});

app.get('/', function(req, res){
  pool.acquire(function(err, page){
    if (err) return req.next(err);
    if (null == page) return res.send(503, ''); // Service Unavailable (timeout)
    page.open('http://127.0.0.1:4000', function(err, status){
      if (err) return req.next(err);
      var code = codes[status];
      res.send(code, status);
      pool.return(page);
    });
  }, 5000); // 5s timeout
});

app.listen(3000, function(){
  console.log('app is listening on 3000');
});
