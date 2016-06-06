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
	connection.onclose = function(evt) {
		logToPage("Connection lost.", true);
	}
}

HOST = "ws://192.168.51.202:25565/";

ROOMNAME = null;
ISPLAYER = false;
READYSTATE = false;
PLAYERID = null;
ADMINTOKEN = null;
USERNAME = null;

board = {};
players = {}; // players[playerid] = {playerid:0, username:"tarty baked goods", ready:true}
spectators = [];

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
			
			for( playerid in packet.players ){
				players[playerid] = {playerid:playerid, username:packet.players[playerid], ready:false};
			}
			
			for( spectatorid in packet.spectators ){
				spectators.push(packet.spectators[spectatorid]);
			}
			
			updatePlayerList();
			updateSpectatorList();
			
			board.width = packet.width;
			board.height = packet.height;
			board.lines = packet.lines;
			update();
			break;
		case "ADD":
			if( packet.isplayer ){
				players[packet.playerid] = {playerid:packet.playerid, username:packet.username, ready:false};
			}else{
				spectators.push(packet.username);
			}
			updatePlayerList();
			updateSpectatorList();
			
			break;
		case "REMOVE":
			if( packet.playerid in players ){
				delete players[packet.playerid];
				updatePlayerList();
			}else if( packet.playerid in spectators ){
				delete spectators[packet.playerid];
				updateSpectatorList();
			}
			break;
	}
}

function update(){
	context.strokeRect(64,64,32,32);
	drawBoard();
}

function updatePlayerList(){
	var out = [];
	for( playerid in players ){
		out.push(players[playerid].username + "(" + (players[playerid].ready ? "ready" : "not ready") + ")");
	}
	document.getElementById("playerlist").innerHTML = out.join(", ");
}

function updateSpectatorList(){
	document.getElementById("spectatorlist").innerHTML = spectators.join(", ");
}

function drawBoard(){
	var offset = 4;
	var gap = 24;
	context.fillStyle = "black";
	for( var x=0; x<board.width*gap; x+=gap ){
		for( var y=0; y<board.height*gap; y+=gap ){
			context.fillRect(offset + x-2, offset + y-2, 4, 4);
		}
	}
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

function toggleReady(){
	READYSTATE = !READYSTATE;
	document.getElementById("readybutton").value = "Ready: " + READYSTATE;
	// commence getting rid of TOKENs.
	var packet = {type:"READY", ready:READYSTATE };
	connection.send(JSON.stringify(packet));
}

function logToPage(msg, logConsole){
	var elm = document.getElementById("logbox");
	elm.innerHTML = msg + "<br/>" + elm.innerHTML;
	if( logConsole ) console.log(msg);
}

window.addEventListener('load', init, false);

