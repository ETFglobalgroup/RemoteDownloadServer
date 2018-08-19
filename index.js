const http = require("http");
const https = require("https");
const fs = require("fs");
var io = require('socket.io')(http);
var url = require("url");
var status='standby';
var preB=0;
var readline = require('readline');
var concount=0;
var id=0;
var progress=0;
var speed='0B/s';

var server = http.createServer(function(req, res) {
    var path = url.parse(req.url).pathname;
    console.log("Client request file:"+path);
    if(path.includes('.mp4')) {
        vplayer(res,req,__dirname + '/data' + path,'mp4',function (err) {
           if(err) errorlog(res,err);
        });
    }else if(path.includes('.ogg')) {
        vplayer(res,req,__dirname + '/data' + path,'ogg',function (err) {
           if(err) errorlog(res,err);
        });
    }else if(path.includes('.webm')) {
        vplayer(res,req,__dirname + '/data' + path,'webm',function (err) {
           if(err) errorlog(res,err);
        });
    }else{
        fs.readFile(__dirname + path, function (error, data) {
            if (error) {
                errorlog(res,error)
            } else {
                res.writeHead(200, {"Content-Type": "text/html"});
                res.write(data, "utf8");
            }
            res.end();
        });
    }
});

var httpdownload = function(url, fname, cb) {
    var file = fs.createWriteStream(fname);
    var request = http.get(url, function(response) {
        var length=response.headers[ 'content-length'];
        response.pipe(file);
        var filesize=setInterval(function () {
            fs.readFile(fname, function(err, content){
                var size = content.length;
                progress=Math.round(size*100/length,1);
                speed=change_unit(size-preB)+'/s';
                status='Downloading';
                preB=size;
            });
        },1000);
        file.on('finish', function() {
            clearInterval(filesize);
            status='Finish';
            file.close(cb);  // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (err) cb(err.message);
    });
};

var httpsdownload = function(url, fname, cb) {
    var file = fs.createWriteStream(fname);
    var request = https.get(url, function(response) {
        var length=response.headers[ 'content-length'];
        response.pipe(file);
        status='Downloading';
        var filesize=setInterval(function () {
            fs.readFile(fname, function(err, content){
                var size = content.length;
                progress=Math.round(size*100/length,0);
                speed=change_unit(size-preB)+'/s';
                preB=size;
            });
        },1000);
        file.on('finish', function() {
            clearInterval(filesize);
            status='Finish';
            file.close(cb);  // close() is async, call cb after close completes.
        });
    }).on('error', function(err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (err) cb(err.message);
    });
};

var vplayer = function (res,req,path,format,cb) {
    try {
        const stat = fs.statSync(path);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1]
                ? parseInt(parts[1], 10)
                : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(path, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/'+format,
            };

            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/'+format,
            };
            res.writeHead(200, head);
            fs.createReadStream(path).pipe(res)
        }
    }catch(err){
        cb(err);
    }
};

var errorlog=function (res,err) {
    report(err)
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.write('An ERROR Occurred');
    res.end();
};

var report=function(text){
    console.log('--------------------------------------------------');
    console.error(text);
    console.log('--------------------------------------------------');

};

var change_unit=function(bytes){
    var unit=['B','KB','MB','GB','TB'];
    var count=0;
    while(bytes>1023){
        count++;
        bytes=bytes/1024;
    }
    return bytes.toFixed(1)+unit[count];
};

var  rl = readline.createInterface({
    input:process.stdin,
    output:process.stdout
});

rl.question("想要在哪個port開啟server?",function(answer){
        server.listen(answer);
        console.log("server open on port : "+answer);
    rl.close();
});
var iosocket=io.listen(server);
iosocket.sockets.on('connection', function(socket) {
    setInterval(function () {
        socket.emit('status', {
            'status': status,
            'progress' : progress,
            'speed' : speed
        });
    },1000);
    concount++;
    socket.on('url_data', function(data) {
        report('Client request url:'+data.url+' for file:'+data.fname);
        if(data.url.includes('https')){
            httpsdownload(data.url , __dirname + '/data/' + data.fname , function (fin) {
                if(fin) status=fin;
            });
        }else{
            httpdownload(data.url , __dirname + '/data/' + data.fname , function (fin) {
                if(fin) status=fin;
            });
        }
    });
    socket.on('disconnect', () => {
        concount--;
    });
});