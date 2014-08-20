
amplify.sqlite = function(){
	var self = this,
		environment = null,
		userConfiguration = typeof amplify.sqlite.configuration == 'object' ? amplify.sqlite.configuration : {};
    var config = $.extend( {
		expiration: Date.now(),
		db: {
			name: 'amplifyStore.db',
			version: '1.0',
			display: 'Amplify Storage',
			size: 20000
		},
	    table: {
	        store: "amplify_store"
	    }
	}, userConfiguration );

    // private object of prewritten queries used by this class.
    // NOTE: use of the utils sprintf to replace the santatized vars with
    // real data occurs on execution of each script.
    var sql = {
        DROP:             " DROP TABLE IF EXISTS %(table.store)s ",
        CREATE:           " CREATE TABLE IF NOT EXISTS %(table.store)s( key VARCHAR(100), data BLOB, expiration INTEGER ) ",
        INSERT:           " INSERT INTO %(table.store)s VALUES( '%(storage.key)s', '%(storage.data)s', %(storage.expiration)d ) ",
        UPDATE:           " UPDATE %(table.store)s SET data ='%(storage.data)s', expiration = %(storage.expiration)d WHERE key = '%(storage.key)s' ",
        EXPIRED:          " DELETE FROM %(table.store)s WHERE expiration < %(expiration)d AND expiration > 0 ",
        DELETE:           " DELETE FROM %(table.store)s WHERE key = '%(storage.key)s' ",
        SELECT:           " SELECT * FROM %(table.store)s WHERE key = '%(storage.key)s' "
    };

    self.instance = function(){
    	return this;
    };

	self.get = function( key ){

		var deferred = $.Deferred(),
			error = {
				'message' : '',
				'code' : 200,
				'key' : key
				};

		if( isEmpty(key) ){
			error.message = 'Key must be supplied to retrieve results.';
			error.code = 400;
            deferred.reject( error );
        }

        var options = $.extend({}, config, {
            storage: {
                key: key
            }
        });

        execute( self.sprintf( sql.SELECT, options ) ).done(function( result, sql ){

        	// return first raw result
        	var response = "";
        	// always assume that we only want the first row
            if( result.rows.length > 0 ){
            	var row = parseRow( result.rows.item(0) );
            	if( row.expiration > Date.now() || row.expiration == 0 ) {
	            	response = row.data;
            	}
            }

            // TODO consider refactoring to include multiple rows if available/desired
            // var response = [];
            // for(var i=0;i<result.rows.length;i++){
            //     var row = parseRow( result.rows.item(i) );
            //     response.push( row.data );
            // }  
            if( response != "" ){
	            deferred.resolve( response );
	        } else {
	        	error.message = 'No data found.';
				error.code = 404;
	        	deferred.reject( error );
	        }
        }).fail(function(error){
	    	deferred.reject( error );
    	});

		return deferred.promise();
    };


    self.put = function( key, data, expiration ){
        expiration = expiration || 0;

        var deferred = $.Deferred();

        // prevent unset key or data from being saved
        if (isEmpty(key) || isEmpty(data)){
			error.message = 'Key and data must be supplied to retrieve results.';
			error.code = 400;
            deferred.reject( error );
        }

        // TODO explore alt caching expiration 
        // if (utils.isNumber(expiration)) {
        //     expiration = Number(expiration);
        // } else if (utils.isBoolean(expiration) && !expiration) {
        //     expiration = 0;
        // } else {
        //     expiration = Date.now();
        // }

		data = typeof data == 'undefined' ? '' : data;

        var options = $.extend({}, config, {
            storage: {
                key: key,
                data: sanitize(data),
                expiration: expiration
            }
        });
        // console.log("put options", options, Date.now(),self.sprintf( sql.UPDATE, options ));

		flushExpired().done(function(){

	        self.get( key ).done(function (response) {
	        	// update existing record
	            execute(self.sprintf( sql.UPDATE, options )).done(function ( result, sql ) {
	                deferred.resolve(result, sql);
	            });
	        }).fail(function( error ){

	        	if( error.code == 404 ) {
			    	// insert since no record found
			    	execute(self.sprintf( sql.INSERT, options )).done(function ( result, sql ) {
			            deferred.resolve(result, sql);
			        });
			    } else {
			    	deferred.reject( error );
			    }

	        });

	    });

        return deferred.promise();
    };

    self.delete = function( key ){
    	var deferred = $.Deferred(),
			error = {
				'message' : '',
				'code' : 200,
				'key' : key
				};

		if( isEmpty(key) ){
			error.message = 'Key must be supplied to delete stored items.';
			error.code = 400;
            deferred.reject( error );
        }

        var options = $.extend({}, config, {
            storage: {
                key: key
            }
        });

        execute( self.sprintf( sql.DELETE, options ) ).done(function ( result, sql ) {
            deferred.resolve(result, sql);
        }).fail(function(error){
	    	deferred.reject( error );
    	});

		return deferred.promise();
    };

    function flushExpired(){
    	var deferred = $.Deferred();
		config.expiration = Date.now();
        execute( self.sprintf( sql.EXPIRED, config ) ).done(function(request){
            deferred.resolve( request );
        });
        return deferred.promise();
    }

	function execute( executeSQL ){
	    var deferred = $.Deferred();
	    var error = {
			'message' : '',
			'code' : 200,
			'sql' : executeSQL
			};

		if( environment == null ){
    		environment = window.openDatabase( config.db.name, config.db.version, config.db.display, config.db.size, initEnvironment );
		    initEnvironment();
    	}

	    if( environment !== null ) {

	        environment.transaction(function (tx) {
	            tx.executeSql( executeSQL, [], function(tx, results){
	                deferred.resolve( results, executeSQL, tx );
	            }, function(err) {
	            	error.message = err.message;
	            	error.code = err.code;
	                deferred.reject( error );
	            });
	        }, function(err) {
	        	error.message = err.message;
	        	error.code = err.code;
	            deferred.reject( error );
	        });

	    } else {

        	error.message = 'No environment found';
        	error.code = 501;
	        deferred.reject( error );

	    }

	    return deferred.promise();
	}

	function parseRow( row ){
        return {
                key:        row.key,
                data:       desanitize( row.data ),
                expiration: Number( row.expiration )
            };
    }

    function initEnvironment(){
    	execute( self.sprintf( sql.CREATE, config ) ).done(function(){
    		flushExpired();
    	});
    }

    /*** UTILITY MECHANISMS ***/


    /**
    * [isEmpty description]
    * @param  {[type]}  mixed_var [description]
    * @return {Boolean}           [description]
    */
    function isEmpty(mixed_var) {
        var undef, key, i, len;
        var emptyValues = [undef, null, false, 0, '', '0'];

        for (i = 0, len = emptyValues.length; i < len; i++) {
            if (mixed_var === emptyValues[i]) {
                return true;
            }
        }

        if (typeof mixed_var === 'object') {
            for (key in mixed_var) {
                // TODO: should we check for own properties only?
                //if (mixed_var.hasOwnProperty(key)) {
                return false;
                //}
            }
            return true;
        }

        return false;
    }

    function isNumber(s) {
        return /^\d+$/.test(s);
    }

    /**
	* [sprintf description]
	* hat tip to alexei for sprintf function
	* @link https://github.com/alexei/sprintf.js
	* @return {[type]} [description]
	*/
	self.sprintf = function () {
	    if (!self.sprintf.cache.hasOwnProperty(arguments[0])) {
	        self.sprintf.cache[arguments[0]] = self.sprintf.parse(arguments[0]);
	    }
	    return self.sprintf.format.call(null, self.sprintf.cache[arguments[0]], arguments);
	};

	/**
	* [format description]
	* @param  {[type]} parse_tree [description]
	* @param  {[type]} argv       [description]
	* @return {[type]}            [description]
	*/
	self.sprintf.format = function (parse_tree, argv) {
	    var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
	    for (i = 0; i < tree_length; i++) {
	        node_type = getType(parse_tree[i]);
	        if (node_type === 'string') {
	            output.push(parse_tree[i]);
	        } else if (node_type === 'array') {
	            match = parse_tree[i]; // convenience purposes only
	            if (match[2]) { // keyword argument
	                arg = argv[cursor];
	                for (k = 0; k < match[2].length; k++) {
	                    if (!arg.hasOwnProperty(match[2][k])) {
	                        throw (self.sprintf('utils.sprintf property "%s" does not exist', match[2][k]));
	                    }
	                    arg = arg[match[2][k]];
	                }
	            } else if (match[1]) { // positional argument (explicit)
	                arg = argv[match[1]];
	            } else { // positional argument (implicit)
	                arg = argv[cursor++];
	            }

	            if (/[^s]/.test(match[8]) && (getType(arg) != 'number')) {
	                throw (self.sprintf('utils.sprintf expecting number but found %s', getType(arg)));
	            }
	            switch (match[8]) {
	                case 'b': arg = arg.toString(2); break;
	                case 'c': arg = String.fromCharCode(arg); break;
	                case 'd': arg = parseInt(arg, 10); break;
	                case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
	                case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
	                case 'o': arg = arg.toString(8); break;
	                case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
	                case 'u': arg = arg >>> 0; break;
	                case 'x': arg = arg.toString(16); break;
	                case 'X': arg = arg.toString(16).toUpperCase(); break;
	            }
	            arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+' + arg : arg);
	            pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
	            pad_length = match[6] - String(arg).length;
	            pad = match[6] ? stringRepeat(pad_character, pad_length) : '';
	            output.push(match[5] ? arg + pad : pad + arg);
	        }
	    }
	    return output.join('');
	};

	self.sprintf.cache = {};

	self.sprintf.parse = function (fmt) {
	    var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
	    while (_fmt) {
	        if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
	            parse_tree.push(match[0]);
	        } else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
	            parse_tree.push('%');
	        } else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
	            if (match[2]) {
	                arg_names |= 1;
	                var field_list = [], replacement_field = match[2], field_match = [];
	                if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
	                    field_list.push(field_match[1]);
	                    while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
	                        if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
	                            field_list.push(field_match[1]);
	                        } else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
	                            field_list.push(field_match[1]);
	                        } else {
	                            throw ('utils.sprintf incorrectly matched or no targets found.');
	                        }
	                    }
	                } else {
	                    throw ('utils.sprintf incorrectly matched or no targets found.');
	                }
	                match[2] = field_list;
	            } else {
	                arg_names |= 2;
	            }
	            if (arg_names === 3) {
	                throw ('utils.sprintf incorrectly mixing positional and named placeholders is not (yet) supported.');
	            }
	            parse_tree.push(match);
	        } else {
	            throw ('utils.sprintf incorrectly matched or no targets found.');
	        }
	        _fmt = _fmt.substring(match[0].length);
	    }
	    return parse_tree;
	};

	function sanitize( data ){
		data = JSON.stringify( data );
		return data.replace(/'/g, "&#39;");
    }

    function desanitize( data ){
    	return JSON.parse( data.replace("&#39;", "'") );
    }

	function getType(variable) {
        return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }

    function stringRepeat(input, multiplier) {
        for (var output = []; multiplier > 0; output[--multiplier] = input) { /* do nothing */ }
        return output.join('');
    }

};

// ensure the instance runs as a singleton to minimize memory usage since 
// sqlite can only run on one thread in modern browsers
amplify.sqlite.instance = new amplify.sqlite();

// define custom caching approach for amplify when data is requested
amplify.request.cache.sqlite = function( resource, request, ajax, ampXHR ){


    // console.log('---------------------');
    // console.log("resource",resource);
    // console.log("request",request);
    // console.log("ajax",ajax);
    // console.log("ampXHR",ampXHR);
    // console.log('---------------------');

    
    var cacheKey = amplify.request.cache._key( request.resourceId, ajax.cacheURL(), ajax.data );

	if(  typeof request == 'object' && request.hasOwnProperty('getRemote') && request.getRemote == true ) {

		var ampXHRsuccess = ampXHR.success;
		ampXHR.success = function( data, status ) {

	        var expiration = typeof resource.cache == 'object' ? Number( resource.cache.expires ) + Date.now() : 0; 
	        amplify.sqlite.instance.put( cacheKey, data, expiration ).done(function(){
				if ( typeof resource.cache == 'object' && typeof resource.cache.expires == "number" && resource.cache.expires > 0 ) {
					setTimeout(function() {
						amplify.sqlite.instance.delete( cacheKey );
					}, Number( resource.cache.expires ) );
				}
	        });
	        ampXHRsuccess.apply( this, arguments );

	    };

	} else {

		amplify.sqlite.instance.get( cacheKey ).done(function( dataFromCache ){

			if( typeof dataFromCache == 'object' )
				dataFromCache.fromCache = true;

	        ampXHR.success( dataFromCache );

		}).fail(function(error){

			request.getRemote = true;
			amplify.request(request);

		});
		return false;
	}

};
