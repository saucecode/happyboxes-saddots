// dotsboxes_server.js

function randomString(len){
	var s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array(len).join().split(',').map(function() { return s.charAt(Math.floor(Math.random() * s.length)); }).join('');
}

var WebSocketServer = require('ws').Server;
var WebSocket = require('ws').WebSocket;

wss = new WebSocketServer({port:25565});
PLAYERID_COUNT = 0;

games = {};

wss.on("connection", function(conn) {
	console.log("Conneciton opened.");

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
				
				if( (request.roomname in games) ){
					var response = {type:"CREATE", ok:false, message:"room already exists"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( request.width < 5 || request.height < 5 || request.width > 50 || request.height > 50 ){
					var response = {type:"CREATE", ok:false, message:"invalid dimensions"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var newgame = {
					roomname: request.roomname,
					state:'waiting for players',
					players:[],
					whose_turn:-1,
					PLAYERID_COUNT:0,
					password:"",
					admin_token:randomString(12),
					
					width:request.width,
					height:request.height,
					lines:[],
					captures:[]
				};
				
				games[request.roomname] = newgame;
				
				var response = {type:"CREATE", ok:true, admintoken:newgame.admin_token};
				conn.send(JSON.stringify(response));
				
				break;
			case "JOIN":
				if( request.username.length < 4 || request.username.length > 16){
					var response = {type:"JOIN", ok:false, message:"username too short or long (4-16 characters)"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( !(request.roomname in games) ){
					var response = {type:"JOIN", ok:false, message:"room does not exist or roomname incorrect"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( "player" in conn ){
					var response = {type:"JOIN", ok:false, message:"you've already joined a game. reload the page."};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var game = games[request.roomname];
				
				if( game.password != "" ){
					if( request.password != game.password ){
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
				for( var index in game.players ){
					var player = game.players[index];
					player.conn.send(JSON.stringify(add_packet));
				}
				
				game.players.push(newplayer);
				
				var response = {
					type:"JOIN",
					ok:true,
					playerid:newplayer.playerid
				};
				
				conn.send(JSON.stringify(response));
				
				conn.send(JSON.stringify( generateBoardPacket(game.roomname) ));
				
				break;
			case "SPECTATE":
				if( request.username.length < 4 || request.username.length > 16){
					var response = {type:"SPECTATE", ok:false, message:"username too short or long (4-16 characters)"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( !(request.roomname in games) ){
					var response = {type:"SPECTATE", ok:false, message:"room does not exist or roomname incorrect"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( "player" in conn ){
					var response = {type:"SPECTATE", ok:false, message:"you've already joined a game. reload the page."};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var game = games[request.roomname];
				
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
				for( var index in game.players ){
					var player = game.players[index];
					player.conn.send(JSON.stringify(add_packet));
				}
				
				game.players.push(newspectator);
				
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
				
				var room = games[conn.player.roomname];
				conn.player.ready = request.ready;
				
				var json_response = JSON.stringify({ type:"READY", ready:request.ready, playerid:conn.player.playerid });
				sendToRoom(json_response, conn.player.roomname)
				
				// TODO If all players are ready, start a countdown
				console.log(roomPlayerCount(room.roomname))
				if( room.state == "waiting for players" && roomPlayerCount(conn.player.roomname) >= 2 ){
					console.log("Checking players' readiness...");
					var allready = true;
					for( playerid in room.players ){
						if( room.players[playerid].ready == false ){
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
		}
	});
});

function checkGameStart(roomname){
	// check if all players are still ready
	var room = games[roomname];
	var playersReady = true;
	for( playerid in room.players ){
		if( room.players[playerid].ready == false ){
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
		room.whose_turn = getNextTurnPlayerID(room.whose_turn, room.roomname);
		var turnPacket = {type:"TURN", playerid:room.whose_turn};
		sendToRoom(JSON.stringify(turnPacket), room.roomname);
		
	}else{
		// "waiting for players" again
		room.state = "waiting for players";
		var packet = {type:"GAMESTATE", state:room.state};
		sendToRoom(JSON.stringify(packet), roomname);
	}
}

// Returns the ID of the next PLAYER in line, 
function getNextTurnPlayerID(currentTurnID, roomname){
	var room = games[roomname];
	var actual_players = [];
	for( playerid in room.players ){
		actual_players.push(playerid);
	}
	
	if( currentTurnID == -1 ) // first turn of game
		return actual_players[0];
	return actual_players[(actual_players.indexOf(currentTurnID)+1) % actual_players.length];
}

function roomPlayerCount(roomname){
	var room = games[roomname];
	var count = 0;
	for( playerid in room.players ){
		if( room.players[playerid].isplayer ) count += 1;
	}
	return count;
}

function roomSpectatorCount(roomname){
	return games[roomname].players.length - roomPlayerCount(roomname);
}

function sendToRoom(json_string, roomname){
	var room = games[roomname];
	for( playerid in room.players ){
		room.players[playerid].conn.send(json_string);
	}
}

function generateBoardPacket(roomname) {
	var game = games[roomname];
	var _players = {}, _spectators = {};
	for( var index in game.players ){
		var player = game.players[index];
		if( player.isplayer )
			_players[player.playerid] = player.username;
		else
			_spectators[player.playerid] = player.username;
	}
	
	return {
		type:"BOARD",
		roomname:roomname,
		gamestate:game.state,
		width:game.width,
		height:game.height,
		players:_players,
		spectators:_spectators,
		lines:game.lines,
		captures:game.captures
	};
}

