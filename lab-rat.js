var config = require('./config');

var http = require('http');//standard web server
var terminal = require('shelljs/global');

var FTPClient = require('ftp');
var fs = require('fs');

var server;

var _imageDir = "images";
var _imageType = ".jpg";
var _timePicWasTaken = 0;//used later
var _minTimeBetweenPics = 30000;//5 minutes


var _ipAddress = '127.0.0.1';
var _port = 1337;

function init(){
	//SEE IF WE ARE ALREADY RUNNING
	if(!server){
		//SETUP the HTTP server
		server = http.createServer(function (req, res) {
			//make sure they are making the right request
			if (req.url === '/takePhoto') {
			
				req.addListener('end', function () {
					step1();//let's start this thing
					
					res.writeHead(200, {'Content-Type': 'text/plain'});
					res.end('TAKING PICTURE');        
			    });
			}else{
			    res.writeHead(200, {'Content-Type': 'text/plain'});
			    res.end('Wrong URL');
			}
		}).listen(_port, _ipAddress);
		
		return 'Server running at http://' + _ipAddress + ':' + _port;
	}
	return 'ERROR: SERVER ALREADY RUNNING!';
}
		
function step1(){
	
	console.log("#STEP 1 - attempt");
	//get the timestamp we need
	var newTimeStamp = new Date().getTime();
	if(newTimeStamp - _timePicWasTaken > _minTimeBetweenPics){
		console.log("#STEP 1 - run");
		_timePicWasTaken = newTimeStamp;
		
		//take the pic
		exec("isightcapture " + _imageDir + "/" + _timePicWasTaken + _imageType, function(code, output) {
			
			console.log("photo taken");
			//pic is taken, now onto grayscale and sizing
			step2();
		});
		
	}
}

function step2(){
	console.log("#STEP 2");
	var command = "convert ";
	command += _imageDir + "/" + _timePicWasTaken + _imageType;
	command += " -resize 384x384^ -gravity center -extent 384x384";
	command += " -fx '(r+g+b)/3'";
	command += " -level 0%,100%,2.0 " + _imageDir + "/" + _timePicWasTaken + _imageType;

	//make the pic b&w and size down
	exec(command, function(code, output) {
		//pic is all set, so now time to upload it
		step3();
	});
}

function step3(){
	console.log("#STEP 3");
	//ftp it up to the server
	var c = new FTPClient();
	
	c.on('error', function(err){
		console.log(err);
	});
	
	c.on('ready', function(err) {
		if (err) throw err;
		
		console.log('connected');
		//if we need to change the dir
		c.cwd(config.ftpInfo.workingDirectory, function(err, currentDir){
			if (err) throw err;
			
			c.put(_imageDir + "/" + _timePicWasTaken + _imageType, _timePicWasTaken + _imageType, function(err) {
			  if (err) throw err;
			  
			  console.log('pushing image');
			  
			  //close out the connection, it's no longer needed
			  c.end();
			  
			  //now call to the little printer
			  step4a();
			  
			  //and...we can remove the image from the local system
			  step4b();
			  
			});//END->put
		});//END->cwd
	});//END->on
	
	//connect it up
	c.connect(config.ftpInfo.connection);
}

function step4a(){
	console.log("#STEP 4a");
	
	//this is the html we will send to the printer
	var html = "<html><body><h1>Someone popped into the lab.</h1><img src=\"" + config.ftpInfo.urlToImageDir + _timePicWasTaken + _imageType + "\"/></body></html>";

	//call the little printer cloud
	exec("curl -X POST -d 'html=" + html + "' http://remote.bergcloud.com/playground/direct_print/" + config.printerConfig.id, function(code, output) {
		console.log('sent to printer');
	});
	
}

function step4b(){
	console.log("#STEP 4b");
	//remove the file from the local system
	fs.unlink(_imageDir + "/" + _timePicWasTaken + _imageType, function (err) {
		if (err) throw err;
		
		console.log('image removed from local system');
	});
}

//lets do this!
console.log(init());