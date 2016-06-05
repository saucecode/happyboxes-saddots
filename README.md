# happyboxes-saddots
Node.js server for a 2+ multiplayer dots &amp; boxes game.

## TODO

 - Implement chat.
 - Implement admin's kicking function.
 - Handle players leaving.
 - Start drawing the board.
 - Implement readying up.
 - And so much more!

## DONE
 - Write a proper testing client.
 - Get rid of player tokens.

## Network Protocol

Transmission of JSON strings back and forth, over a websocket (due to the recent shortage of messenger pigeons).

First, someone must create a room with a `CREATE` packet. This sets the room's dimensions and name. The name is the identifier. Players or spectators can then join that room with a `JOIN` or `SPECTATE` packet. The server's response, if successful, will be followed by a `BOARD` packet, detailing the current room's state. Spectators can join at any time. Players can only join if there is space, and they know the password (if set).

The initial gamestate is set as "waiting for players" (to ready up). Players must send a `READY` packet to update their ready-state. When all players are ready, a `GAMESTATE` packet is broadcast with state "about to start" and a 5 second countdown is started. Players may unready themselves in this time. At the end of the 5 seconds, the state is changed to "started".

A player can join/leave at any time. When this occurs, the server sends an `ADD` or `REMOVE` packet, respectively.

When the game starts, a `TURN` packet is broadcast, with the playerid whose turn it is. This player now must make a turn by sending a valid `MOVE` packet. Once a valid move is made, it is broadcast to all players/spectators, and a `TURN` packet is broadcast again, for the next player.

When a player captures a box, a `CAPTURE` packet is broadcast. It continues to be that player's turn - they must go again.

If all boxes have been captured, the scores are calculated, and a new `GAMESTATE` is sent with either "ended" or "tied" as `state`. The winner's playerid is also sent. Nothing can happen until the admin sends a reset command with an `ADMIN` packet.

The admin can kick any player at any time. If the player count falls below 2, the gamestate declares the last person the victor.

### CREATE

To create a private room, one sends a CREATE packet, which looks like so. Password (if used) is required to `JOIN` the room.

    Request:
	{ type:"CREATE", password:"optional password", roomname:"my-game-room", width:7, height:7 }

    Response:
	{ type:"CREATE", ok:true|false, admin_token:"randomtext", message:"error message if ok == false" }

### JOIN & SPECTATE

Used to join a room.

    Request:
	{ type:"JOIN", roomname:"my-game-room", username:"a chubby deer" }

	{ type:"SPECTATE", roomname:"my-game-room", username:"a chubby deer" }

	Response:
	{ type:"JOIN", ok:true|false, token:"randomtext", playerid:2, message:"error message if ok == false" }

	{ type:"SPECTATE", ok:true|false, playerid:3 }

The server will send a `token` if you are joining as a player.  
This token is used to make moves on the board. Don't share it!  
Spectators and players get a `playerid`. This should point to their usernames.

### ADD & REMOVE

Add or remove players. This is a server broadcast only, to declare the adding or removing of new players/spectators.  
`isplayer` indicates if new user is a player or spectator.

    Broadcast:
    { type:"ADD", playerid:4, username:"John Cena", isplayer:false }
    
    { type:"REMOVE", playerid:4, message:"Remove reason." }

### CHAT

Used to publicly shower your friends with compliments and love. `fromid` is the sender's `playerid`.

    Request:
	{ type:"CHAT", msg:"Your move, Mr. Bond." }

	Broadcast:
	{ type:"CHAT", msg:"Your move, Mr. Bond.", fromid:2 }

### READY

Toggle your ready state.

    Request:
	{ type: "READY", ready:true|false, token:"randomtext" }
	
	Broadcast:
	{ type: "READY", ready:true|false, playerid:2 }

### MOVE

Make a move on the board.  
The board is made up of a grid of dots with integer coordinates from 0 to 50.  
A request must send the coordinate of one of these dots, and indicate if they wish to draw a line right (`d:0`), or a line down (`d:1`).  
If an invalid move (outside of board, or line exists) no response is sent. Players know what moves are valid.  
A separate packet is sent if a move results in a capture.

    Request:
	{ type:"MOVE", x:3, y:2, d:0|1 }

	Broadcast:
	{ type:"MOVE", x:3, y:2, d:0|1, playerid:1 }

### CAPTURE

A player has captured a box. It is this player's turn again.

    Broadcast:
	{ type:"CAPTURE", x:3, y:3, playerid:1 }

### BOARD

Request the state of the board, and the scores.  
`lines` is an array of the lines placed, defined by a set of arrays like `[x,y,d]`.  
`captures` is an array of owned/captured boxes, defined by a set of arrays like `[x,y,playerid]`.

    Request:
	{ type:"BOARD", roomname:"theoffice" }

	Response:
	{
	    type:"BOARD",
	    roomname:"theoffice",
	    gamestate:"waiting for players",
	    width:7,
	    height:7,
	    players:{
	        2:"a chubby deer",
	        3:"two blind mice",
	        1:"The Claw!"
	    },
	    spectators:{
	        4:"John Cena",
	        0:"lazy-spectator"
	    },
	    lines:[
	    	[3,2,1], [3,2,0], [3,3,0], [4,2,1]
	    ],
	    captures:[
	        [3,2,2]
	    ]
	}

### TURN

Broadcast declaring whose turn it is.

    Broadcast:
    { type:"TURN", playerid:1 }

### ADMIN

An admin command. Can be used to `reset` or `terminate` the game or kick a `playerid`.

    Request:
    { type:"ADMIN", admintoken:"randomtext", cmd:"reset|kick|terminate", playerid:4 }

### GAMESTATE

Updates the state of the game. This is only sent by the server. `winnerid` only sent if state is "ended".

    Broadcast:
	{ type:"GAMESTATE", "state":"waiting for players|about to start|started|ended|tied", winnerid:2 }
