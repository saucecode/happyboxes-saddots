// dotsboxes_server.js

function randomString(len){
	var s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array(len).join().split(',').map(function() { return s.charAt(Math.floor(Math.random() * s.length)); }).join('');
}

var WebSocketServer = require('ws').Server;
var WebSocket = require('ws').WebSocket;

wss = new WebSocketServer({port:25565});
PLAYERID_COUNT = 0;

rooms = {
	// DEBUG DEBUG DEBUG
	asdf: {
	roomname:"asdf",
	state:"waiting for players",
	players:[],
	whose_turn:-1,
	PLAYERID_COUNT:0,
	password:"",
	admin_token:randomString(12),
		
	width:3,
	height:3,
	lines:[[0,0,0]],
	captures:[]
	}
};

wss.on("connection", function(conn) {
	console.log("Conneciton opened.");
	
	conn.on("close", function(){
		console.log("Connection closed.");
		if( !("player" in conn) ) return; // if connection hasn't made a SPECTATE or JOIN request
		
		var room = rooms[conn.player.roomname];
		
		if( conn.player.playerid == room.whose_turn ){
			var playerCount = roomPlayerCount(room.roomname);
			if( playerCount > 2 ){
				gotoNextTurn(room.roomname);
			}
		}
		
		var dropPacket = {type:"REMOVE", playerid:conn.player.playerid, message:"connection was dropped"};
		
		delete rooms[conn.player.roomname].players[conn.player.playerid];
		sendToRoom(JSON.stringify(dropPacket), conn.player.roomname);
		console.log("Deleted player.");
		
		checkGameEnd(room.roomname);
	});
	
	conn.on("message", function(message){
		var request = null;
		try{
			request = JSON.parse(message);
		}catch(err){
			console.log(err);
			var response = {type:"error", message:"invalid request", die:false};
			conn.send(JSON.stringify(response));
			return;
		}
		
		console.log("Packet received: " + message);
		
		switch(request.type){
			case "CREATE":
				if( request.roomname.length < 4 ){
					var response = {type:"CREATE", ok:false, message:"room name too short"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( (request.roomname in rooms) ){
					var response = {type:"CREATE", ok:false, message:"room already exists"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( request.width < 2 || request.height < 2 || request.width > 50 || request.height > 50 ){
					var response = {type:"CREATE", ok:false, message:"invalid dimensions"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var newroom = {
					roomname: request.roomname,
					state:"waiting for players",
					players:[],
					whose_turn:-1,
					PLAYERID_COUNT:0,
					password:request.password,
					admin_token:randomString(12),
					
					width:request.width,
					height:request.height,
					lines:[],
					captures:[]
				};
				
				rooms[request.roomname] = newroom;
				
				var response = {type:"CREATE", ok:true, admintoken:newroom.admin_token};
				conn.send(JSON.stringify(response));
				
				break;
			case "JOIN":
				if( request.username.length < 4 || request.username.length > 16 ){
					var response = {type:"JOIN", ok:false, message:"username too short or long (4-16 characters)"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( !(request.roomname in rooms) ){
					var response = {type:"JOIN", ok:false, message:"room does not exist or roomname incorrect"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( "player" in conn ){
					var response = {type:"JOIN", ok:false, message:"you've already joined a room. reload the page."};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var room = rooms[request.roomname];
				
				if( room.state == "started" ){
					var response = {type:"JOIN", ok:false, message:"the game has already started. join as a spectator."};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( room.password != "" ){
					if( request.password != room.password ){
						var response = {type:"JOIN", ok:false, message:"incorrect password"};
						conn.send(JSON.stringify(response));
						return;
					}
				}
				
				var newplayer = {
					username:request.username,
					conn:conn,
					playerid:PLAYERID_COUNT,
					roomname:request.roomname,
					isplayer:true,
					ready:false
				};
				PLAYERID_COUNT+=1;
				conn.player = newplayer;
				
				// send ADD packet to all existing players in the room
				var add_packet = {
					type:"ADD",
					playerid:newplayer.playerid,
					username:newplayer.username,
					isplayer:newplayer.isplayer
				};
				for( var index in room.players ){
					var player = room.players[index];
					player.conn.send(JSON.stringify(add_packet));
				}
				
				room.players.push(newplayer);
				
				var response = {
					type:"JOIN",
					ok:true,
					playerid:newplayer.playerid
				};
				
				conn.send(JSON.stringify(response));
				
				conn.send(JSON.stringify( generateBoardPacket(room.roomname) ));
				
				break;
			case "SPECTATE":
				if( request.username.length < 4 || request.username.length > 16){
					var response = {type:"SPECTATE", ok:false, message:"username too short or long (4-16 characters)"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( !(request.roomname in rooms) ){
					var response = {type:"SPECTATE", ok:false, message:"room does not exist or roomname incorrect"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( "player" in conn ){
					var response = {type:"SPECTATE", ok:false, message:"you've already joined a room. reload the page."};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var room = rooms[request.roomname];
				
				var newspectator = {
					username:request.username,
					conn:conn,
					playerid:PLAYERID_COUNT,
					roomname:request.roomname,
					isplayer:false
				};
				PLAYERID_COUNT+=1;
				conn.player = newspectator;
				
				// send ADD packet to all existing players in the room
				var add_packet = {
					type:"ADD",
					playerid:newspectator.playerid,
					username:newspectator.username,
					isplayer:newspectator.isplayer
				};
				for( var index in room.players ){
					var player = room.players[index];
					player.conn.send(JSON.stringify(add_packet));
				}
				
				room.players.push(newspectator);
				
				var response = {
					type:"SPECTATE",
					ok:true,
					playerid:newspectator.playerid
				};
				
				conn.send(JSON.stringify(response));
				conn.send(JSON.stringify( generateBoardPacket(request.roomname) ));
				
				break;
			case "BOARD":
				if( !( "player" in conn ) ) return;
				conn.send(JSON.stringify( generateBoardPacket(conn.player.roomname) ));
				
				break;
			case "READY":
				if( !("player" in conn) ) return;
				if( conn.player.isplayer == false ) return;
				
				var room = rooms[conn.player.roomname];
				conn.player.ready = request.ready;
				
				var json_response = JSON.stringify({ type:"READY", ready:request.ready, playerid:conn.player.playerid });
				sendToRoom(json_response, conn.player.roomname)
				
				if( room.state == "waiting for players" && roomPlayerCount(conn.player.roomname) >= 2 ){
					var allready = true;
					for( var index in room.players ){
						if( room.players[index].ready == false ){
							allready = false;
							break;
						}
					}
					
					if( allready ){
						console.log("all players are ready");
						room.state = "about to start";
						var packet = {type:"GAMESTATE", state:room.state};
						sendToRoom(JSON.stringify(packet), room.roomname);
						
						room.start_timer = setTimeout(function(){checkGameStart(room.roomname);}, 5000);
					}
				}
				
				break;
			case "MOVE":
				if( !( "player" in conn ) ) return;
				if( conn.player.isplayer == false ) return;
				
				var room = rooms[conn.player.roomname];
				
				if( room.state != "started" ) return;
				// Check move is in player's turn
				if( conn.player.playerid != room.whose_turn ) return;
				
				// Check move in valid position
				if( request.x < 0 || request.y < 0 ) return;
				if( request.d == 0 && request.x >= room.width - 1 ) return;
				if( request.d == 1 && request.y >= room.height - 1 ) return;
				
				var proposedLine = [request.x, request.y, request.d];
				if( lineExists(proposedLine, room.roomname) ) return;
				
				// Make move and broadcast
				room.lines.push(proposedLine);
				request.playerid = conn.player.playerid;
				sendToRoom(JSON.stringify(request), room.roomname);
				
				var captureTurn = false;
				var captured = []; // to be pushed into room.captures if captureTurn == true.
				// an array because you can capture more than one box in one move
				
				// Check if a capture has happened in x,y & x,y-1 (horizontal turn) or x,y & x-1,y (vertical turn)
				if( !captureExists(proposedLine[0], proposedLine[1], room.roomname) )
					if( checkForCapture(proposedLine[0], proposedLine[1], room.roomname) ){
						captureTurn = true;
						captured.push([proposedLine[0], proposedLine[1]]);
					}
				// Scary proposition arithmetic magic checks one of two squares based on the turn's direction.
				// See expanded version at commit 831fc91, line 268.
				if( !captureExists(proposedLine[0]-proposedLine[2], proposedLine[1]+proposedLine[2]-1, room.roomname) )
					if( checkForCapture(proposedLine[0]-proposedLine[2], proposedLine[1]+proposedLine[2]-1, room.roomname) ){
						captureTurn = true;
						captured.push([proposedLine[0]-proposedLine[2], proposedLine[1]+proposedLine[2]-1]);
					}
				
				// Send the next turn packet (do not send TURN packets on a capture)
				if( captureTurn ){
					console.log("a capture happened! " + JSON.stringify(captured));
					for( var index in captured ){
						captured[index].push(conn.player.playerid);
						room.captures.push(captured[index]);
					
						var capturePacket = {
							type:"CAPTURE",
							x:captured[index][0],
							y:captured[index][1],
							playerid:captured[index][2]
						};
						sendToRoom(JSON.stringify(capturePacket), room.roomname);
					}
					
				}else{
					gotoNextTurn( room.roomname );
				}
				
				if( room.captures.length == (room.width-1)*(room.height-1) ){
					checkGameEnd(room.roomname);
				}
				
				break;
		}
	});
});

function checkGameStart(roomname){
	// check if all players are still ready
	var room = rooms[roomname];
	var playersReady = true;
	for( var index in room.players ){
		if( room.players[index].ready == false ){
			playersReady = false;
			break;
		}
	}
	
	if( playersReady && roomPlayerCount(room.roomname) >= 2 ){
		// start the game
		room.state = "started";
		var packet = {type:"GAMESTATE", state:room.state};
		sendToRoom(JSON.stringify(packet), roomname);
		
		// send the first TURN packet
		gotoNextTurn( room.roomname );
		
	}else{
		// "waiting for players" again
		room.state = "waiting for players";
		var packet = {type:"GAMESTATE", state:room.state};
		sendToRoom(JSON.stringify(packet), roomname);
		
	}
}

function checkGameEnd(roomname){
	// Check 3 conditions: One player left, no players left, all boxes claimed.
	var room = rooms[roomname];
	
	if( room.state != "started" ){
		return;
	}
	
	// no more moves - all boxes claimed
	if( room.captures.length == (room.width-1)*(room.height-1) ){
		var scores = calculateFinalScores(roomname);
		console.log("calculated final scores: " + JSON.stringify(scores));
		if( scores.result == "win" ){
			room.state = "ended";
			var response = {type:"GAMESTATE", state:room.state, winnerid:scores.winnerid};
			sendToRoom(JSON.stringify(response), roomname);
			return;
			
		}else if(scores.result == "tie"){
			room.state = "tied";
			var response = {type:"GAMESTATE", state:room.state, winnerids:scores.winnerids};
			sendToRoom(JSON.stringify(response), roomname);
			return;
			
		}
		
	}
	
	// one player remaining
	if( roomPlayerCount(roomname) == 1 ){
		room.state = "ended";
		var response = {type:"GAMESTATE", state:room.state, winnerid:scores.winnerid};
		sendToRoom(JSON.stringify(response), roomname);
		return;
	}
	
	// TODO no players remaining
}

function calculateFinalScores(roomname){
	// TODO Clean this mess up
	var result = {scores:{}};
	var room = rooms[roomname];
	
	// Add up captures of all players
	for( var index in room.players ){
		result.scores[room.players[index].playerid] = 0;
	}
	
	for( var index in room.captures ){
		var capture = room.captures[index];
		result.scores[capture[2]] += 1;
	}
	
	// Determine highest score
	var highestScore = 0;
	for( var index in result.scores ){
		if( result.scores[index] > highestScore ) highestScore = result.scores[index];
	}
	
	// Array of player IDs with this score
	var winners = [];
	for( var index in result.scores ){
		if( result.scores[index] >= highestScore ) winners.push(index);
	}
	
	if( winners.length == 1 ){
		console.log("one winner to rule them all");
		result.result = "win";
		result.winnerid = winners[0];
	}else{
		console.log("determined winners: " + JSON.stringify(winners));
		result.result = "tie";
		result.winnerids = winners;
	}
	
	return result;
	// return {scores:{playerid:playerscore, 0:4, 1:12, ...}, result:"win|tie", winnerid:1, winnerids:[1,3]}
}

function gotoNextTurn(roomname){
	var room = rooms[roomname];
	room.whose_turn = getNextTurnPlayerID(room.whose_turn, roomname);
	var turnPacket = {type:"TURN", playerid:room.whose_turn};
	sendToRoom(JSON.stringify(turnPacket), roomname);
}

// Returns the ID of the next PLAYER in line, 
function getNextTurnPlayerID(currentTurnID, roomname){
	var room = rooms[roomname];
	var actual_players = [];
	for( var index in room.players ){
		if( room.players[index].isplayer ) actual_players.push(room.players[index].playerid);
	}
	
	if( currentTurnID == -1 ) return actual_players[0]; // -1 indicates first turn of the game
	
	return actual_players[(actual_players.indexOf(currentTurnID)+1) % actual_players.length];
}

function lineExists(proposedLine, roomname){
	var lines = rooms[roomname].lines;
	for( var index in lines ){
		if( lines[index][0] == proposedLine[0]
		&& lines[index][1] == proposedLine[1]
		&& lines[index][2] == proposedLine[2] ) return true;
	}
	return false;
}

// Checks if there is a capture declared at box at x,y
function captureExists(x, y, roomname){
	var captures = rooms[roomname].captures;
	for( var index in captures ){
		if( captures[index][0] == x && captures[index][1] == y ) return true;
	}
	return false;
}

// Check if the box at x,y,x+1,y+1 has four lines connecting
function checkForCapture(x, y, roomname){
	var lines = [
		[x, y, 0],
		[x, y, 1],
		[x+1, y, 1],
		[x, y+1, 0]
	];
	return ( lineExists(lines[0], roomname) && lineExists(lines[1], roomname)
		&& lineExists(lines[2], roomname) && lineExists(lines[3], roomname) );
}

function roomPlayerCount(roomname){
	var room = rooms[roomname];
	var count = 0;
	for( var playerid in room.players ){
		if( room.players[playerid].isplayer ) count += 1;
	}
	return count;
}

function roomSpectatorCount(roomname){
	return rooms[roomname].players.length - roomPlayerCount(roomname);
}

function sendToRoom(json_string, roomname){
	var room = rooms[roomname];
	for( var playerid in room.players ){
		room.players[playerid].conn.send(json_string);
	}
}

function generateBoardPacket(roomname) {
	var room = rooms[roomname];
	var _players = {}, _spectators = {};
	for( var index in room.players ){
		var player = room.players[index];
		if( player.isplayer )
			_players[player.playerid] = player.username;
		else
			_spectators[player.playerid] = player.username;
	}
	
	return {
		type:"BOARD",
		roomname:roomname,
		gamestate:room.state,
		width:room.width,
		height:room.height,
		players:_players,
		spectators:_spectators,
		lines:room.lines,
		captures:room.captures
	};
}

