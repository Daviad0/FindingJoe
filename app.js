// setup expressjs server

const express = require('express');
const dotenv = require('dotenv');
const app = express();
const port = process.env.PORT || 1111;
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
var Datastore = require('nedb');

var allowedPreviously = [];
var currentState = {
    room : "electrical",
    sender: "",
    votes: [],
    uuid: ""
}

var lastLocked = {
    by: "server",
    end: new Date("2020-01-01T00:00:00.000Z")

};

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}


dotenv.config();
var db = {};
db.trust = new Datastore({ filename: 'data/trust.db', autoload: true });
db.banished = new Datastore({ filename: 'data/banished.db', autoload: true });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname + '/public'));

app.get("/", function(req, res) {
    res.sendFile(__dirname + "/views/main.html");
});
app.get("/info*", function(req, res) {
    res.sendFile(__dirname + "/views/info.html");
});


function checkIfLocked(){
    var now = new Date();
    
    return now < lastLocked.end;
}


function checkIfInRange(key){
    
    var n = 0;
    try{
        n = parseInt(key);
    }catch(e){
        return false;
    }
    

    var ranges = process.env.ALLOWED_RANGES.split(",");
    for(var i = 0; i < ranges.length; i++){
        if(ranges[i].includes("-")){
            var n1 = parseInt(ranges[i].split("-")[0]);
            var n2 = parseInt(ranges[i].split("-")[1]);
            if(n >= n1 && n <= n2){
                return true;
            }
        }
        if(n == parseInt(ranges[i])){
            return true;
        }
    }
    return false;
}

function attemptLogin(key, cb){

    if (key == process.env.JOE_KEY) {
        
        cb("joe");
        return;
    }
    if(key == process.env.ADMIN_KEY) {
        cb("admin");
        return;
    }

    db.banished.find({ key: key }, function(err, docs) {
        if(docs.length > 0) {
            
            cb("");
        }else{
            
            if(allowedPreviously.includes(key)){
                cb("normal");
            }else if(checkIfInRange(key)){
                allowedPreviously.push(key);
                cb("normal");
            }else{
                    
                cb("");
            }

        }
    });
}

app.post("/api/lock", (req, res) => {
    var key = req.cookies.key;
    attemptLogin(key, function(access){
        if(access == ""){
            res.status(401).send({ status: "error", error: "not_allowed" });
            return;
        }
        if(access == "normal"){
            res.status(401).send({ status: "error", error: "not_allowed" });
            return;
        }
        if(checkIfLocked()){
            res.status(400).send({ status: "error", error: "already_locked" });
            return;
        }

        if(!checkIfLocked()){
            var newDate = new Date();
            if(access == "joe"){
                newDate.setMinutes(newDate.getMinutes() + 10);
                lastLocked.end = newDate;
                lastLocked.by = "Joe";
            }else{
                newDate.setMinutes(newDate.getMinutes() + 60);
                lastLocked.end = newDate;
                lastLocked.by = "Administrator";
            }
        }
        
        
        res.send({ status: "success" });
    });
});

app.post("/api/unlock", (req, res) => {
    var key = req.cookies.key;
    attemptLogin(key, function(access){
        if(access == ""){
            res.status(401).send({ status: "error", error: "not_allowed" });
            return;
        }
        if(access == "normal"){
            res.status(401).send({ status: "error", error: "not_allowed" });
            return;
        }
        if(!checkIfLocked()){
            res.status(400).send({ status: "error", error: "not_locked" });
            return;
        }
        lastLocked.end = new Date("2020-01-01T00:00:00.000Z");
        res.send({ status: "success" });
    });
});

app.post("/api/state", (req, res) => {
    var authKey = req.cookies.key;
    
    attemptLogin(authKey, function(access){
        if(access == ""){
            res.status(401).send({ status: "error", error: "not_allowed" });
            return;
        }
        if(checkIfLocked()){
            res.status(400).send({ status: "error", error: "locked" });
            return;
        }
        
        var previousUpvotes = currentState.votes.filter(v => v.vote == "UPVOTE").length;
        var previousDownvotes = currentState.votes.filter(v => v.vote == "DOWNVOTE").length;
        var sender = currentState.sender;
        db.trust.find({ key: sender }, function(err, docs) {
            if(docs.length > 0){
                docs[0].upvotes += previousUpvotes;
                docs[0].downvotes += previousDownvotes;
                db.trust.update({ key: sender }, docs[0], {}, function(err, numReplaced){

                });
            }else{
                db.trust.insert({ key: sender, upvotes: previousUpvotes, downvotes: previousDownvotes }, function(err, newDoc){

                });
            }
        });

        var room = req.body.room;

        if(authKey == process.env.ADMIN_KEY){
            authKey = "admin";
        }
        if(authKey == process.env.JOE_KEY){
            authKey = "joe";
        }

        currentState = {
            room: room,
            sender: authKey,
            votes: [],
            uuid: generateUUID()
        };
        res.send({ status: "success" });

    });
});


app.post("/api/auth", (req, res) => {
    var authKey = req.body.authKey;
    
    attemptLogin(authKey, function(access){
        if(access == ""){
            res.status(401).send({ status: "error", error: "not_allowed" });
            return;
        }
        res.send({ status: "success", access: access });
    });
    

})

app.get("/api/currentState", (req, res) => {
    var key = req.cookies.key;
    attemptLogin(key, function(access){
        if(access == ""){
            res.status(401).send({ status: "error" });
            return;
        }
    
        var sendBackCurrentState = {
            room: currentState.room,
            sender: currentState.sender,
            vote: currentState.votes.find(v => v.sender == key),
            uuid: currentState.uuid
        }
    
        res.send({ status: "success", currentState: (checkIfLocked() ? undefined : sendBackCurrentState), locked: (checkIfLocked() ? lastLocked : undefined) });
    });

    
});

app.post("/api/vote", (req, res) => {
    var key = req.cookies.key;
    attemptLogin(key, function(access){
        if(access == ""){
            res.status(401).send({ status: "error" });
            return;
        }
    
        // allow for UPVOTE or DOWNVOTE votes
    
        var vote = req.body.vote;
        if(vote != "UPVOTE" && vote != "DOWNVOTE"){
            res.status(400).send({ status: "error", error: "invalid vote" });
            return;
        }

        var pseudoKey = key;
        if(key == process.env.ADMIN_KEY){
            pseudoKey = "admin";
        } else if(key == process.env.JOE_KEY){
            pseudoKey = "joe";
        }
        if(currentState.sender == pseudoKey){
            res.status(400).send({ status: "error", error: "this is your post" });
            return;
        }

        var prevVote = currentState.votes.find(v => v.sender == key);
        if(prevVote != undefined){
            currentState.votes.splice(currentState.votes.indexOf(prevVote), 1);
            currentState.votes.push({ sender: pseudoKey, vote: vote });
        }else{
            currentState.votes.push({ sender: pseudoKey, vote: vote });
        }
        res.send({ status: "success" });
    });

    
});

app.listen(port, function() {
    console.log("Server started @ localhost:" + port);
});