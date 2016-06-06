function init(){
	var element = document.getElementById('canvas');
	canvas = element;
	context = element.getContext('2d');
	
	document.addEventListener("mousemove", onMouseMove, false);
	canvas.addEventListener("mousedown", onMouseDown, false);
	
	connect();
	// start the canvas thing only if connection successful
	connection.onopen = function(evt){
		logToPage("Connected to server", true);
		GAME_INTERVAL = setInterval(update, 100);
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
mouseX = 0;
mouseY = 0;

board = {offset:4, gap:24, selected:{idx:0,idy:0,d:false}};
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
	context.clearRect(0,0, canvas.width, canvas.height);
	context.strokeRect(0,0,32,2);
	context.font = "12px Arial";
	context.fillStyle = "black";
	
	context.fillText(mouseX, canvas.width - 40, 16);
	context.fillText(mouseY, canvas.width - 40, 26);
	
	if( "width" in board && ISPLAYER &&
		(  mouseX > board.offset
		&& mouseY > board.offset
		&& mouseX < (board.width-0.5)*board.gap
		&& mouseY < (board.height-0.5)*board.gap) ){
		var idx = Math.floor((mouseX - board.offset)/board.gap);
		var idy = Math.floor((mouseY - board.offset)/board.gap);

		var nodes = [
			{ x:board.offset + idx*board.gap + board.gap/2, y:board.offset + idy*board.gap },
			{ x:board.offset + idx*board.gap, y:board.offset + idy*board.gap + board.gap/2 },
			{ x:board.offset + (idx+1)*board.gap, y:board.offset + idy*board.gap + board.gap/2 },
			{ x:board.offset + idx*board.gap + board.gap/2, y:board.offset + (idy+1)*board.gap }
		];
	
		var smallestID=-1, smallestDistance=100;
		for( var index=0; index<4; index+=1 ){
			// context.fillRect(nodes[index].x,nodes[index].y,1,1); // DEBUG
			nodes[index].d = Math.hypot(mouseX-nodes[index].x, mouseY-nodes[index].y);
			if( nodes[index].d < smallestDistance ){
				smallestID = index;
				smallestDistance = nodes[index].d;
			}
		}
		var isVertical = smallestID == 1 || smallestID == 2;
		
		try{
			context.fillRect(nodes[smallestID].x,nodes[smallestID].y,1,1); // DEBUG
			if( isVertical ){
				context.fillRect(nodes[smallestID].x, nodes[smallestID].y - board.gap/2, 1, board.gap);
			}else{
				context.fillRect(nodes[smallestID].x - board.gap/2, nodes[smallestID].y, board.gap, 1);
			}
			board.selected.idx = idx;
			board.selected.idy = idy;
			board.selected.d = isVertical;
		}catch(err){}
		context.fillText(idx, canvas.width - 40, 36);
		context.fillText(idy, canvas.width - 40, 46);
		
		context.fillText(JSON.stringify(board.selected), canvas.width-140, 66);
	}
	
	drawBoard();
}

function onMouseDown(e){
	if( e.button == 0 ){
		var packet = {type:"MOVE", x:board.selected.idx, y:board.selected.idy, d:board.selected.d?1:0};
		connection.send(JSON.stringify(packet));
	}
}

function onMouseMove(e) {
	mouseX = Math.floor(e.clientX - canvas.getBoundingClientRect().left);
	mouseY = Math.floor(e.clientY - canvas.getBoundingClientRect().top);
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
	context.fillStyle = "black";
	for( var x=0; x<board.width*board.gap; x+=board.gap ){
		for( var y=0; y<board.height*board.gap; y+=board.gap ){
			context.fillRect(board.offset + x-2, board.offset + y-2, 4, 4);
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

