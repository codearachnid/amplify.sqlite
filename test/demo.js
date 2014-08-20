
var startDemo = function(){

	amplify.request.define( "sqliteDemo", "ajax", {
		url: "data.json",
		dataType: "json",
		type: "GET",
		cache: {
			type: "sqlite",
			expires: 15000 // store for 15 seconds
		}
	});

	var el = document.getElementById("getData");
	if (el.addEventListener) {
		el.addEventListener("click", requestData, false);
	} else {
		el.attachEvent('onclick', requestData);
	}  

};

function requestData(){
	amplify.request( "sqliteDemo", {}, function( response ) {
		console.log('---------------------');
		console.log("sqliteDemo response",response);
	});
}
