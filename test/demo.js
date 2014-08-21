
var startDemo = function(){

	amplify.request.define( "sqliteDemo", "ajax", {
		url: "data.json",
		dataType: "json",
		type: "GET",
		cache: {
			type: "sqlite",
			expires: 15000 //900000
		}
	});

	var elementGet = document.getElementById("get");
	var elementClear = document.getElementById("clear");
	if (elementGet.addEventListener) {
		elementGet.addEventListener("click", requestData, false);
		elementClear.addEventListener("click", clearData, false);
	} else {
		elementGet.attachEvent('onclick', requestData);
		elementClear.addEventListener("click", clearData, false);
	}  

};

function requestData(){
	amplify.request( "sqliteDemo", {}, function( response ) {
		console.log('---------------------');
		console.log("sqliteDemo response",response);
	});
}

function clearData(){
	amplify.sqlite.instance.clear();
	console.log('---------------------');
	console.log("sqliteDemo flushed cache");
}
