document.addEventListener('DOMContentLoaded', async function() {
    // read key cookie
    var key = "";
    try{
        key = document.cookie.split('; ').find(row => row.startsWith('key=')).split('=')[1];
    }catch(e){

    }
    if(key == ""){
        switchToScreen(1);
        return;
    }
    
    var loginResult = await postData('/api/auth', {authKey: key});
    if(loginResult.success && loginResult.data.status != "error"){
        myKey = key;
        switchToScreen(2);
        document.querySelector("#loggedin").style.display = "";
        document.querySelector("#authkey").innerHTML = key
        document.getElementById("lock").style.display = "none";
        if(loginResult.data.access == "admin"){
            document.querySelector("#authkey").innerHTML = "Administrator"
            document.getElementById("lock").style.display = "";
            myKey = "admin";
        }else if(loginResult.data.access == "joe"){
            document.querySelector("#authkey").innerHTML = "Joe"
            document.getElementById("lock").style.display = "";
            myKey = "joe";
        }
        
        
        refreshState();
    }else{
        switchToScreen(1);
    }
});

var myKey = "";

// create a function to POST data to a server
const postData = async ( url = '', data = {})=>{
    const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json',
        },
        // Body data type must match "Content-Type" header        
        body: JSON.stringify(data), // body data type must match "Content-Type" header
    });

    try {
        const newData = await response.json();
        return {success: true, data: newData};
    }catch(error) {
        console.log("error", error);
        // appropriately handle the error
    }
    return {success: false};
}

const getData = async ( url = '', data = {})=>{
    const response = await fetch(url, {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json',
        }
    });

    try {
        const newData = await response.json();
        return {success: true, data: newData};
    }catch(error) {
        console.log("error", error);
        // appropriately handle the error
    }
    return {success: false};
}

var currentState = undefined;

async function logout(){
    // clear cookie
    document.cookie = "key=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    // refresh page
    document.querySelector("#key").value = "";
    document.querySelector("#loggedin").style.display = "none";
    switchToScreen(1);
}

async function lock(){
    if(lockedUntil != undefined){
        var result = await postData('/api/unlock', {});
        refreshState();
    }else{
        var result = await postData('/api/lock', {});
        refreshState();
    }
    
}

async function submitRoom(){
    const room = document.getElementById("roomselect").value;
    if(room == ""){
        alert("Please select a room");
        return;
    }
    if(room == currentState.room){
        return;
    }

    var result = await postData('/api/state', {room: room});
    if(result.success){
        refreshState();
    }
}

var lockedUntil = undefined;

async function refreshState(){
    var result = await getData('/api/currentState');
    if(result.success){
        
        currentState = result.data.currentState;

        if(currentState == undefined){
            // then the environment is locked
            lockedUntil = new Date(result.data.locked.end);
            document.getElementById("subtitle").innerHTML = "Locked by " + result.data.locked.by + " for...";
            document.getElementById("upvote").style.display = "none";
            document.getElementById("downvote").style.display = "none";
            document.getElementById("submitnewstatus").style.display = "none";
            document.getElementById("lock").style.color = "#ffbbbb";

        }else{
            
            lockedUntil = undefined;
            document.getElementById("subtitle").innerHTML = "Joe is currently in...";
            document.getElementById("upvote").style.display = "";
            document.getElementById("downvote").style.display = "";
            document.getElementById("lock").style.color = "";
            document.getElementById("submitnewstatus").style.display = "";
            document.getElementById("votes").innerHTML = currentState.upvotes + " / " + currentState.downvotes;
            if(currentState.room == ""){
                document.getElementById("room").innerText = "UNKNOWN";
                document.querySelector("#upvote").style.color = "#cccccc";
            }else{
                document.getElementById("room").innerText = currentState.room.substring(0, 1).toUpperCase() + currentState.room.substring(1);
                document.querySelector("#upvote").style.color = "";
                
                
                if(currentState.vote != undefined){
                    document.querySelector("#" + currentState.vote.vote.toLowerCase()).style.color = (currentState.vote.vote == "UPVOTE") ? "#bbffbb" : "#ffbbbb";
                }
                if(currentState.sender == myKey){
                    document.querySelector("#upvote").style.color = "#cccccc";
                    document.querySelector("#downvote").style.color = "#cccccc";
    
                }
            }
        }

        

        
        
    }
}

async function submitVote(vote){

    if(currentState == undefined || currentState.room == "")
        return;

    document.querySelector("#upvote").style.color = "";
    document.querySelector("#downvote").style.color = "";

    var result = await postData('/api/vote', {vote: vote});
    refreshState();
    if(result.success && result.data.status != "error"){
        document.querySelector("#" + vote.toLowerCase()).style.color = (vote == "UPVOTE") ? "#bbffbb" : "#ffbbbb";
    }else{
        document.querySelector("#" + vote.toLowerCase()).style.color = "#cccccc";
        setTimeout(function(){
            document.querySelector("#" + vote.toLowerCase()).style.color = "";
        }, 1000);
    }
}

async function tryLogin(){

    const key = document.getElementById("key").value;
    if(key == ""){
        alert("Please enter a key");
        return;
    }

    const data = {authKey: key};
    var result = await postData('/api/auth', data);
    if(result.success){
        // save key to cookie
        if(result.data.status == "error"){
            document.querySelector("#login").style.color = "#ffbbbb";
        }else{
            myKey = key;
            document.cookie = "key=" + key;
            document.querySelector("#login").style.color = "";
            document.querySelector("#loggedin").style.display = "";
            document.querySelector("#authkey").innerHTML = key
            document.getElementById("lock").style.display = "none";
            if(result.data.access == "admin"){
                myKey = "admin";
                document.getElementById("lock").style.display = "";
                document.querySelector("#authkey").innerHTML = "Administrator"
            }else if(result.data.access == "joe"){
                myKey = "joe";
                document.getElementById("lock").style.display = "";
                document.querySelector("#authkey").innerHTML = "Joe"
            }
            
    
            refreshState();
            switchToScreen(2);
        }
        
    }
}

function switchToScreen(screen){
    const screens = document.getElementsByClassName("screen");
    for(var i = 0; i < screens.length; i++){
        screens[i].style.display = "none";
    }
    document.querySelector(".screen[data-id='" + screen +"']").style.display = "block";
}

setInterval(refreshState, 5000);
setInterval(function(){
    if(lockedUntil != undefined){
        // UPDATE LOCK UNTIL;
        var diff = lockedUntil - new Date();
        var seconds = Math.floor(diff / 1000);
        var minutes = Math.floor(seconds / 60);
        var showSeconds = (seconds % 60).toString().padStart(2, "0");

        document.getElementById("room").innerText = minutes + ":" + showSeconds; 
    }
}, 200);