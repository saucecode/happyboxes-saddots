// dotsboxes_server.js

function randomString(len){
	var s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return Array(N).join().split(',').map(function() { return s.charAt(Math.floor(Math.random() * s.length)); }).join('');
}

var WebSocketServer = require('ws').Server;
var WebSocket = require('ws').WebSocket;

wss = new WebSocketServer({port:45954});

users = {};
games = {};

wss.on("connection", function(conn) {
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
					
					width:request.width,
					height:request.height,
					lines:[],
					captures:[]
				};
					
				games[request.roomname] = newgame;
				
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
					roomname:request.roomname
				};
				PLAYERID_COUNT+=1;
				
				var response = {
					type:"JOIN",
					ok:true,
					playerid:newplayer.playerid,
					token:newplayer.token
				};
				
				conn.send(JSON.stringify(response));
				break;
		}
	});
});
