const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');


console.log("starting school engine".blue)
console.log({
	cassandra_host: process.env.OPENSHIFT_CASSANDRA_DB_HOST,
	cassandra_port: process.env.OPENSHIFT_CASSANDRA_DB_PORT,
	cassandra_log_dir: process.env.OPENSHIFT_CASSANDRA_DB_LOG_DIR,
	cassandra_native_transport_port: process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT
})

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now


const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
	contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
	keyspace: 'schoolmaster'
};

var client = new cassandra.Client(connectionOptions);

// Authentication and Authorization Middleware
var auth = function(req, res, next) {
	if (req.session)
		return next();
	else
		return res.redirect("/")
};

module.exports = function (app) {
	app.get("/admins", auth, (req, res) => {

		const query = `select * from sms_master.admins`;

		client.execute(query, function(err, result) {
			assert.ifError(err);
			console.log(result.rows[0])
			var rows = []

			result.rows.map((row) => {
				row.view_link = ("/bulkSMS/admins/" + row.user_name)
				row.edit_link = ("/bulkSMS/contacts/edit/" + row.username),
				row.delete_link = ("/bulkSMS/admins/delete/" + row.user_name)
			})

			console.log(req.session.user)

			var renderData = {
				layout: "bulkSMS",
				session: req.session,
				status: "Online",
				page: "Admins",
				back: "Dashboard",
				fields: ["name", "phone number"],
				branches: result.rows,
				new: "/bulkSMS/admins/new",
				admins: result.rows
			}

			res.render('bulkSMS/admins/list', renderData);
		});

	})

	app.get("/admins/delete/:admin_id", auth, (req, res) => {

		const query = `delete from sms_master.admins where user_name=?`;

		client.execute(query,[req.params.admin_id], function(err, result) {
			assert.ifError(err);
			console.log(result)
			res.redirect("/bulkSMS/admins")
		});

	})

	app.route("/admins/new")
	.get(function(req, res) {
		res.render('bulkSMS/admins/new', {
			layout: "bulkSMS",
			session: req.session,
			status: "Online",
			page: "Registration",
			back: "Front Office",
			new: "/branches/new",
			form: {
				title: "Add new admin",
				action: "",
				method: "post",
				fields: [{
					name: "user_name",
					placeholder: "What is the email of the admin?",
					type: "text"
				}, {
					name: "password",
					placeholder: "What is the admin called?",
					type: "text"
				}, {
					name: "phone_number",
					placeholder: "What is the phone number of the contact?",
					type: "text"
				}]
			}
		});
	})
	.post(function(req, res) {
		console.log(req.body)
			// save to the db, return to the list
			console.log(req.body)

		// read the values and validate, post to the db or reply with errors

		client.batch([{
			query: `INSERT INTO sms_master.admins (user_name, password, phone_number) VALUES (?, ?, ?);`,
			params: [req.body.user_name, req.body.password, req.body.phone_number]
		}], function(err, result) {
			res.redirect("/bulkSMS/admins")
		})


	})

	app.route("/admins/:admin_id")
	.get(function(req, res) {

		const query = `select * from sms_master.admins where user_name=?`,
		params = [req.params.admin_id]

		client.execute(query, params, function(err, result) {
			assert.ifError(err)
			admin = result.rows[0]
			res.render('bulkSMS/admins/new', {
				layout: "bulkSMS",
				session: req.session,
				status: "Online",
				page: "Registration",
				back: "Front Office",
				new: "/branches/new",
				form: {
					title: "Add new admin",
					action: "",
					method: "post",
					fields: [{
						name: "user_name",
						placeholder: "What is the email of the admin?",
						type: "text",
						value: admin.user_name
					}, {
						name: "password",
						placeholder: "What is the admin called?",
						type: "text",
						value: admin.password
					}, {
						name: "phone_number",
						placeholder: "What is the phone number of the contact?",
						type: "text",
						value: admin.phone_number
					}]
				}
			});

		})

	})
	.post(function(req, res) {

		client.batch([{
			query: `INSERT INTO sms_master.admins (user_name, password, phone_number) VALUES (?, ?, ?);`,
			params: [req.body.user_name, req.body.password, req.body.phone_number]
		}], function(err, result) {
			res.redirect("/bulkSMS/admins")
		})


	})

}