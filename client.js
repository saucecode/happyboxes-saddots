function init(){
	var element = document.getElementById('canvas');
	context = element.getContext('2d');
	update();
}

function update(){
	context.strokeRect(64,64,32,32);
}

window.addEventListener('load', init, false);

