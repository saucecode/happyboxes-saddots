function init(){
	var element = document.getElementById('canvas');
	context = element.getContext('2d');
	connect();
	// start the canvas thing only if connection successful
	connection.onopen = function(evt){
		logToPage("Connected to server", true);
		update();
	}
	connection.onmessage = function(evt) {
		try{
			processPacket(JSON.parse(evt.data));
		}catch(err){
			console.log("Error on message reception:")
			console.log(err);
		}
	}
}

HOST = "ws://192.168.51.202:25565/";

ROOMNAME = null;
TOKEN = null;
ISPLAYER = false;
PLAYERID = null;
AUTHTOKEN = null;
USERNAME = null;

function connect(){
	connection = new WebSocket(HOST);
}

function processPacket(packet){
	logToPage("Received packet: " + JSON.stringify(packet), true);
	
	switch(packet.type){
		case "CREATE":
			if( packet.ok ){
				ADMINTOKEN = packet.admintoken;
			}
			
			break;
		case "JOIN":
			if( packet.ok ){
				ISPLAYER = true;
				TOKEN = packet.token;
				PLAYERID = packet.playerid;
			}
			
			break;
		
		case "SPECTATE":
			if( packet.ok ){
				ISPLAYER = false;
				PLAYERID = packet.playerid;
			}
			
			break;
		
		case "BOARD":
			document.getElementById("roomstatus").innerHTML = packet.gamestate;
			document.getElementById("roomname").innerHTML = packet.roomname + " - " + (ISPLAYER ? "playing" : "spectating");
			ROOMNAME = packet.roomname;
			break;
	}
}

function update(){
	context.strokeRect(64,64,32,32);
}

function createRoom(){
	var roomname = document.getElementById("c_roomname").value;
	var width = parseInt(document.getElementById("c_width").value);
	var height = parseInt(document.getElementById("c_height").value);
	var password = document.getElementById("c_password").value;
	var packet = {
		type:"CREATE",
		roomname:roomname,
		password:password,
		width:width,
		height:height
	};
	connection.send( JSON.stringify(packet) );
}

function joinRoom(asPlayer){
	var roomname = document.getElementById("j_roomname").value;
	var username = document.getElementById("j_username").value;
	var password = document.getElementById("j_password").value;
	
	logToPage("Attempting to join room " + roomname + " as " + username + "...");
	
	var packet = {
		type: asPlayer ? "JOIN" : "SPECTATE",
		roomname: roomname,
		username:username,
		password:password
	};
	
	connection.send(JSON.stringify( packet ));
	USERNAME = username;
}

function logToPage(msg, logConsole){
	var elm = document.getElementById("logbox");
	elm.innerHTML = msg + "<br/>" + elm.innerHTML;
	if( logConsole ) console.log(msg);
}

window.addEventListener('load', init, false);

