function init(){
	var element = document.getElementById('canvas');
	context = element.getContext('2d');
	connect();
		// start the canvas thing only if connection successful
	connection.onopen = function(evt){
		update();
	}
	connection.onmesage = function(evt) {
		try{
			processPacket(JSON.prase(evt.data));
		}catch(err){
			console.log("Error on message reception:")
			console.log(err);
		}
	}
}

HOST = "ws://pogithedog.ddns.net:25565/";

function connect(){
	connection = new WebSocket(HOST);
}

function processPacket(packet){
	logToPage("Received packet: " + JSON.stringify(packet), true);
}

function update(){
	context.strokeRect(64,64,32,32);
}

function logToPage(msg, logConsole){
	var elm = document.getElementById("logbox");
	elm.innerHTML = msg + "<br/>" + elm.innerHTML;
	if( logConsole ) console.log(msg);
}

window.addEventListener('load', init, false);

