
var app = require('express')();

app.get('/', function(_, res){
  res.send('<h1>test!</h1>');
});

app.listen(4000, function(){
  console.log('test app is on 4000');
});
