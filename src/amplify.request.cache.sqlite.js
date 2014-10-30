// define custom caching approach for amplify when data is requested
amplify.request.cache.sqlite = function(resource, request, ajax, ampXHR) {
	// console.log('---------------------');
	// console.log("resource",resource);
	// console.log("request",request);
	// console.log("ajax",ajax);
	// console.log("ampXHR",ampXHR);
	// console.log('---------------------');
	var cacheKey = amplify.request.cache._key(request.resourceId, ajax.cacheURL(),
		ajax.data);
	if (typeof request == 'object' && request.hasOwnProperty('getRemote') &&
		request.getRemote == true) {
			
		if( typeof resource.cache != "boolean" || resource.cache !== false ){
			var ampXHRsuccess = ampXHR.success;
			ampXHR.success = function(data, status) {
				var expiration = typeof resource.cache == 'object' ? Number(
					resource.cache.expires) + Date.now() : 0;
				amplify.sqlite.instance.put(cacheKey, data, expiration).done(
					function() {
						if (typeof resource.cache == 'object' && typeof resource
							.cache.expires == "number" && resource.cache
							.expires > 0) {
							setTimeout(function() {
								amplify.sqlite.instance.delete(
									cacheKey);
							}, Number(resource.cache.expires));
						}
					});
				ampXHRsuccess.apply(this, arguments);
			};
		}
	} else {
		amplify.sqlite.instance.get(cacheKey).done(function(dataFromCache) {
			if (typeof dataFromCache == 'object') dataFromCache.fromCache =
				true;
			ampXHR.success(dataFromCache);
		}).fail(function(error) {
			request.getRemote = true;
			amplify.request(request);
		});
		return false;
	}
};
