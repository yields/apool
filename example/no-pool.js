
var phantom = require('node-phantom');
var app = require('express')();
var codes = require('./codes');

require('./test');

phantom.create(function(err, p){
  if (err) throw err;
  phantom = p;
});

app.get('/', function(req, res){
  phantom.createPage(function(err, page){
    if (err) return req.next(err);
    page.open('http://127.0.0.1:4000', function(err, status){
      if (err) return req.next(err);
      var code = codes[status];
      res.send(code, status);
    });
  });
});

app.listen(3000, function(){
  console.log('app is listening on 3000');
});
