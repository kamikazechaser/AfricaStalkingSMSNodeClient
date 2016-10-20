var insertRecord = {
	keyspace: "schoolmaster",
	table: "user_profiles",
	record: {
		user_name: "Branson",
		full_names: "Gitomeh kuria",
		other_things: "Gitomeh kuria"
	}
}

var tableRecord = {
	keyspace: "schoolmaster",
	table: "user_profiles",
	record: {
		user_name: "timeuuid",
		full_names: "text",
		other_things: ""
	},
	primary_keys: ["username", "full_names"]
}

var alterRecord = {
	keyspace: "schoolmaster",
	table: "user_profiles",
	collumn: "id",
	type: "uuid"
}

var columnRecord = {
	keyspace: "schoolmaster",
	table: "user_profiles",
	collumn: "id",
	type: "list<uuid>"
}

// console.log(insertMaker(insertRecord))
// console.log(alterCollumnType(alterRecord))
// console.log(addCollumn(columnRecord))
// console.log(dropCollumn(columnRecord))
// console.log(tableMaker(tableRecord))

var test = {
	// create an insert statement from some objects

	// INSERT INTO sms_master.user_profiles (user_name,full_names,id, p_pic, telephone) VALUES (?, ?, ?, ?, ?);
	insertMaker:function(obj) {
		// console.log(Object.keys(obj))
		var string = `Insert into ` + (obj.keyspace ? obj.keyspace : "") + (obj.keyspace ? `.` : "") + obj.table + ` (`
			// keys
		Object.keys(obj.record).map((key) => string = string + key + (Object.keys(obj.record).indexOf(key) + 1 == Object.keys(obj.record).length ? ")" : ","))
			// values section
		string = string + " VALUES ("

		Object.keys(obj.record).map((key) => string = string + "?" + (Object.keys(obj.record).indexOf(key) + 1 == Object.keys(obj.record).length ? ")" : ","))

		// extract the values in order. to an array
		const params = []
		Object.keys(obj.record).map((key) => {
			params.push(obj.record[key])
		})

		return {
			query: string,
			params: params
		};
	},

	tableMaker:function(obj) {
		// console.log(Object.keys(obj))
		var string = `Create table if not exists ` + (obj.keyspace ? obj.keyspace : "") + (obj.keyspace ? `.` : "") + obj.table + ` (`
			// keys
		Object.keys(obj.record).map((key) => {
				string = string + key + " " + obj.record[key] + (Object.keys(obj.record).indexOf(key) + 1 == Object.keys(obj.record).length ? "," : ",")
			})
			// values section
		string = string + " PRIMARY KEY ("

		obj.primary_keys.map((key) => string = string + " " + key + (obj.primary_keys.indexOf(key) + 1 == obj.primary_keys.length ? " ))" : ","))

		// extract the values in order. to an array
		const params = []
		Object.keys(obj.record).map((key) => {
			params.push(obj.record[key])
		})

		return string
	},

	alterCollumnType:function(obj) {
		var string = "ALTER TABLE " +
			(obj.keyspace ? obj.keyspace : "") +
			(obj.keyspace ? `.` : "") +
			obj.table +
			` ALTER ` + obj.collumn + ` TYPE ` + obj.type
		return string
	},

	addCollumn:function(obj) {
		var string = "ALTER TABLE " +
			(obj.keyspace ? obj.keyspace : "") +
			(obj.keyspace ? `.` : "") +
			obj.table +
			` ADD ` + obj.collumn + ` ` + obj.type
		return string
	},

	dropCollumn:function(obj) {
		var string = "ALTER TABLE " +
			(obj.keyspace ? obj.keyspace : "") +
			(obj.keyspace ? `.` : "") +
			obj.table +
			` DROP ` + obj.collumn
		return string
	}

}


// console.log(test)
module.exports = test