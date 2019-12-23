let isMeteor1_8 = (Meteor.release=='none' ? "1.8" : Meteor.release).match(/(\d+)\.(\d+)/);
isMeteor1_8 = (isMeteor1_8[1]*100 + isMeteor1_8[2]*1) >= 108;

function getCache(collection, _id) {
	var instance = DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get();

	if (!instance || !instance.userId || !instance.connection) {
		return;
	}

	const result = {_id}; // ensure the _id field is included https://github.com/msavin/userCache/issues/9

	try {
		var connectionId = instance.connection.id;
		var doc = isMeteor1_8
			? Meteor.default_server.sessions.get(connectionId).collectionViews.get(collection).documents.get(_id)
			: Meteor.default_server.sessions[connectionId].collectionViews[collection].documents[_id];
		var data = doc && doc.dataByKey || [];
		var source = isMeteor1_8 ? Array.from(data.entries()) : Object.keys(data);

		source.forEach(isMeteor1_8
			? (item) => result[item[0]] = item[1][0].value
			: (item) => result[item] = data[item][0].value
		);
	} catch(e) {
		// console.log('getCache error');
		// console.log(e);
		return;
	}

	return result;
}

function hasField(doc, field) {
	field = field.split('.');

	for (var i = 0; i < field.length; i++) {
		if (Array.isArray(doc)) {
			// https://github.com/msavin/userCache/issues/8
			if (!doc.length) {
				return;
			}
			if (field[i] === "[]") {
				// Skip to next field, only required if requested field is eg "emails.[].address"
				continue;
			}
			doc = doc[0];
		}
		if (!doc[field[i]]) {
			return;
		}
		doc = doc[field[i]];
	}

	return !!doc;
}

Mongo.Collection.prototype.findOneOriginal = Mongo.Collection.prototype.findOne;
Mongo.Collection.prototype.updateOriginal = Mongo.Collection.prototype.update;
const updatedCollections = new Meteor.EnvironmentVariable();

Mongo.Collection.prototype.update = function(...args) {
	const uc = updatedCollections.get() || [];
	uc.push(this._name);
	updatedCollections.set(uc);
	return this.updateOriginal.apply(this, args);
}

Mongo.Collection.prototype.findOne = function(query, options) {
	// check if we are in an autorun so instead of looking at the cache we need to use the original reactive version...
	if (Tracker && Tracker.active) {
		return this.findOneOriginal.apply(this, arguments);
	}

	if ((updatedCollections.get()||[]).indexOf(this._name)!=-1) {
		// console.log('findOne', 'collection updated', this._name, query, options);
		return this.findOneOriginal.apply(this, arguments);
	}

	// check we have a valid _id and only an _id query
	const _id =
		(typeof query == 'string') ? query
		: (typeof query == 'object' && typeof query._id == 'string' && Object.keys(query).length==1) ? query._id
		: null;
	if (!_id) {
		// console.log('findOne', 'no _id', this._name, query, options);
		return this.findOneOriginal.apply(this, arguments);
	}

	// check there is at least one positive field selector and they are all +ve
	if (!options || !options.fields || !Object.keys(options.fields).every(f => options.fields[f]===1 || options.fields[f]===true)) {
		// console.log('findOne', 'not all fields selectors are +ve', this._name, query, options);
		return this.findOneOriginal.apply(this, arguments);
	}
	const cache = getCache(this._name, _id);
	if (!cache) {
		// console.log('findOne', 'no cache', this._name, query, options);
		return this.findOneOriginal.apply(this, arguments);
	}

	// check the cache contains all the required fields...
	if (Object.keys(options.fields).every(field => hasField(cache, field))) {
		// console.log('findOne', 'CACHE HIT! ', this._name, query, options);
		return cache;
	}
	// console.log('findOne', 'cache miss', this._name, query, options);
	return this.findOneOriginal.apply(this, arguments);
};
