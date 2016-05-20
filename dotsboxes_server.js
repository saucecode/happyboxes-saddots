// dotsboxes_server.js

function randomString(len){
	var s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array(N).join().split(',').map(function() { return s.charAt(Math.floor(Math.random() * s.length)); }).join('');
}

var WebSocketServer = require('ws').Server;
var WebSocket = require('ws').WebSocket;

wss = new WebSocketServer({port:25565});

users = {};
games = {};

wss.on("connection", function(conn) {
	console.log("Jag fick ett samband från " + conn.address);

	wss.on("message", function(message){
		var request = null;
		try{
			request = JSON.parse(message);
		}catch(err){
			console.log(err);
			var response = {type:"error", message:"invalid request", die:false};
			conn.send(JSON.stringify(response));
			return;
		}
		
		switch(request.type){
			case "CREATE":
				if( request.roomname.length() < 4 ){
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
					whose_turn:0,
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
				if( request.username.length() < 4 || request.username.length() > 16){
					var response = {type:"JOIN", ok:false, message:"username too short or long (4-16 characters)"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( !(request.roomname in games) ){
					var response = {type:"JOIN", ok:false, message:"room does not exist or roomname incorrect"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var game = games[request.roomname];
				
				if( !(game.password != "" && request.password == game.password) ){
					var response = {type:"JOIN", ok:false, message:"incorrect password"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				var newplayer = {
					username:request.username,
					conn:conn,
					playerid:PLAYERID_COUNT,
					token:randomString(6),
					roomname:request.roomname,
					isplayer:true
				};
				PLAYERID_COUNT+=1;
				
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
					playerid:newplayer.playerid,
					token:newplayer.token
				};
				
				conn.send(JSON.stringify(response));
				
				conn.send(JSON.stringify( generateBoardPacket() ));
				
				break;
			case "SPECTATE":
				if( request.username.length() < 4 || request.username.length() > 16){
					var response = {type:"SPECTATE", ok:false, message:"username too short or long (4-16 characters)"};
					conn.send(JSON.stringify(response));
					return;
				}
				
				if( !(request.roomname in games) ){
					var response = {type:"SPECTATE", ok:false, message:"room does not exist or roomname incorrect"};
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
				conn.send(JSON.stringify( generateBoardPacket() ));
				break;
			case "BOARD":
				conn.send(JSON.stringify( generateBoardPacket() ));
				break;
		}
	});
});

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
		gamestate:game.state,
		width:game.width,
		height:game.height,
		players:_players,
		spectators,
		lines:game.lines,
		captures:game.captures
	};
}

